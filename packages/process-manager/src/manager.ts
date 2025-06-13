import { EventEmitter } from "node:events";
import { execa } from "execa";
import pidtree from "pidtree";
import type {
  ProcessConfig,
  ProcessState,
  ProcessEvents,
  ProcessMetrics,
} from "./types";

export class ProcessManager extends EventEmitter<ProcessEvents> {
  private processes = new Map<string, {
    config: ProcessConfig;
    state: ProcessState;
    subprocess?: any;
    killTimeout?: NodeJS.Timeout;
  }>();

  async start(config: ProcessConfig): Promise<void> {
    if (this.processes.has(config.id)) {
      throw new Error(`Process '${config.id}' is already managed`);
    }

    const state: ProcessState = {
      id: config.id,
      status: "starting",
      restartCount: 0,
      startTime: new Date(),
    };

    this.processes.set(config.id, { config, state });

    try {
      const subprocess = execa(config.command, config.args || [], {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
        shell: config.shell,
        detached: config.detached,
        uid: config.uid,
        gid: config.gid,
        timeout: config.timeout,
        killSignal: config.killSignal || "SIGTERM",
        maxBuffer: config.maxBuffer,
        stdio: config.stdio || "pipe",
        cleanup: true,
        reject: false, // We'll handle errors manually
      });

      const processInfo = this.processes.get(config.id)!;
      processInfo.subprocess = subprocess;
      processInfo.state.pid = subprocess.pid;
      processInfo.state.status = "running";

      this.emit("started", config.id, processInfo.state);

      // Handle process completion
      subprocess.then((result) => {
        const currentState = this.processes.get(config.id)?.state;
        if (!currentState) return;

        currentState.endTime = new Date();
        currentState.exitCode = result.exitCode;
        currentState.signal = result.signal as NodeJS.Signals;

        if (result.failed && result.exitCode !== 0) {
          currentState.status = "failed";
          const error = new Error(`Process exited with code ${result.exitCode}: ${result.stderr}`);
          currentState.error = error;
          this.emit("failed", config.id, error, currentState);
        } else {
          currentState.status = "stopped";
          this.emit("stopped", config.id, currentState);
        }

        // Clean up subprocess reference
        const processInfo = this.processes.get(config.id);
        if (processInfo) {
          processInfo.subprocess = undefined;
        }
      }).catch((error) => {
        const currentState = this.processes.get(config.id)?.state;
        if (!currentState) return;

        currentState.status = "crashed";
        currentState.error = error;
        currentState.endTime = new Date();
        this.emit("failed", config.id, error, currentState);
      });

    } catch (error) {
      const processInfo = this.processes.get(config.id);
      if (processInfo) {
        processInfo.state.status = "failed";
        processInfo.state.error = error as Error;
        processInfo.state.endTime = new Date();
      }
      this.emit("failed", config.id, error as Error, state);
      throw error;
    }
  }

  async stop(id: string, force = false): Promise<void> {
    const processInfo = this.processes.get(id);
    if (!processInfo || !processInfo.subprocess) {
      return;
    }

    const { subprocess, state } = processInfo;
    state.status = "stopping";

    try {
      if (force) {
        // Force kill immediately
        subprocess.kill("SIGKILL");
      } else {
        // Graceful shutdown
        subprocess.kill("SIGTERM");
        
        // Set up force kill timeout
        processInfo.killTimeout = setTimeout(() => {
          if (subprocess.killed === false) {
            subprocess.kill("SIGKILL");
          }
        }, 10000); // 10 second timeout
      }

      // Wait for process to exit
      await subprocess;
    } catch {
      // Process might have already exited or been killed
    } finally {
      if (processInfo.killTimeout) {
        clearTimeout(processInfo.killTimeout);
        processInfo.killTimeout = undefined;
      }
    }
  }

  async restart(id: string): Promise<void> {
    const processInfo = this.processes.get(id);
    if (!processInfo) {
      throw new Error(`Process '${id}' not found`);
    }

    await this.stop(id);
    
    // Wait for process to fully stop
    await new Promise<void>((resolve) => {
      const checkStopped = () => {
        const currentState = this.processes.get(id)?.state;
        if (currentState && (currentState.status === "stopped" || currentState.status === "failed")) {
          resolve();
        } else {
          setTimeout(checkStopped, 100);
        }
      };
      checkStopped();
    });

    processInfo.state.restartCount++;
    this.emit("restarted", id, processInfo.state);
    
    await this.start(processInfo.config);
  }

  async remove(id: string): Promise<void> {
    await this.stop(id, true);
    this.processes.delete(id);
  }

  async stopAll(force = false): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map(id => 
      this.stop(id, force).catch(() => {}) // Ignore errors during bulk stop
    );
    
    await Promise.all(stopPromises);
  }

  getProcess(id: string): ProcessState | undefined {
    return this.processes.get(id)?.state;
  }

  getAllProcesses(): Map<string, ProcessState> {
    const result = new Map<string, ProcessState>();
    for (const [id, info] of this.processes) {
      result.set(id, info.state);
    }
    return result;
  }

  isRunning(id: string): boolean {
    const state = this.processes.get(id)?.state;
    return state?.status === "running";
  }

  async getMetrics(id: string): Promise<ProcessMetrics | undefined> {
    const processInfo = this.processes.get(id);
    if (!processInfo || !processInfo.state.pid || !processInfo.state.startTime) {
      return undefined;
    }

    try {
      // Get process list to find CPU and memory info
      const psList = await import("ps-list");
      const processes = await psList.default();
      const processData = processes.find(p => p.pid === processInfo.state.pid);

      if (!processData) {
        return undefined;
      }

      return {
        id,
        pid: processInfo.state.pid,
        cpu: processData.cpu || 0,
        memory: processData.memory || 0,
        uptime: Date.now() - processInfo.state.startTime.getTime(),
        startTime: processInfo.state.startTime,
        restartCount: processInfo.state.restartCount,
      };
    } catch {
      // Return basic metrics if detailed metrics aren't available
      return {
        id,
        pid: processInfo.state.pid,
        cpu: 0,
        memory: 0,
        uptime: Date.now() - processInfo.state.startTime.getTime(),
        startTime: processInfo.state.startTime,
        restartCount: processInfo.state.restartCount,
      };
    }
  }

  async killProcessTree(id: string): Promise<void> {
    const processInfo = this.processes.get(id);
    if (!processInfo?.state.pid) {
      return;
    }

    try {
      // Get all child processes
      const childPids = await pidtree(processInfo.state.pid);
      
      // Kill all child processes first
      for (const childPid of childPids) {
        try {
          process.kill(childPid, "SIGTERM");
        } catch {
          // Process might already be dead
        }
      }
      
      // Wait a bit then force kill any remaining processes
      setTimeout(() => {
        for (const childPid of childPids) {
          try {
            process.kill(childPid, "SIGKILL");
          } catch {
            // Process might already be dead
          }
        }
      }, 5000);
      
      // Kill the main process
      await this.stop(id, true);
    } catch (error) {
      // If pidtree fails, just kill the main process
      await this.stop(id, true);
    }
  }

  getRunningCount(): number {
    return Array.from(this.processes.values()).filter(
      info => info.state.status === "running"
    ).length;
  }

  hasProcess(id: string): boolean {
    return this.processes.has(id);
  }
}