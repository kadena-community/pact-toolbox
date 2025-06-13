import { EventEmitter } from "node:events";
import PQueue from "p-queue";
import { ProcessManager } from "./manager";
import { HealthCheck } from "./health-check";
import { tui } from "@pact-toolbox/tui";
import type {
  ProcessConfig,
  ProcessState,
  ProcessEvents,
  OrchestratorConfig,
  DependencyConfig,
  HealthCheckConfig,
  ProcessMetrics,
} from "./types";

export interface OrchestratedProcess extends ProcessConfig {
  dependencies?: DependencyConfig[];
  healthCheck?: HealthCheckConfig;
  autoRestart?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
}

export class ProcessOrchestrator extends EventEmitter<ProcessEvents> {
  private processManager: ProcessManager;
  private healthChecks = new Map<string, HealthCheck>();
  private processConfigs = new Map<string, OrchestratedProcess>();
  private queue: PQueue;
  private metricsInterval?: NodeJS.Timeout;
  private shutdownInProgress = false;

  constructor(private config: OrchestratorConfig = {}) {
    super();

    this.processManager = new ProcessManager();
    this.queue = new PQueue({ 
      concurrency: config.maxConcurrentOperations || 5 
    });

    this.setupProcessManagerEvents();
    this.setupGlobalHandlers();

    if (config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  private setupProcessManagerEvents(): void {
    this.processManager.on("started", (id, state) => {
      this.updateTUI();
      this.emit("started", id, state);
    });

    this.processManager.on("stopped", (id, state) => {
      this.stopHealthCheck(id);
      this.updateTUI();
      this.emit("stopped", id, state);
    });

    this.processManager.on("failed", async (id, error, state) => {
      this.stopHealthCheck(id);
      
      const config = this.processConfigs.get(id);
      if (config?.autoRestart && state.restartCount < (config.maxRestarts || 3)) {
        tui.log("warn", "orchestrator", `Process ${id} failed, scheduling restart`, { 
          restartCount: state.restartCount,
          error: error.message 
        });
        
        setTimeout(() => {
          this.restart(id).catch(err => {
            tui.log("error", "orchestrator", `Failed to restart process ${id}`, { error: err.message });
          });
        }, config.restartDelay || 5000);
      }
      
      this.updateTUI();
      this.emit("failed", id, error, state);
    });

    this.processManager.on("restarted", (id, state) => {
      this.startHealthCheck(id);
      this.updateTUI();
      this.emit("restarted", id, state);
    });
  }

  private setupGlobalHandlers(): void {
    const handleShutdown = async (signal: NodeJS.Signals) => {
      if (this.shutdownInProgress) {
        tui.log("warn", "orchestrator", "Force shutdown");
        process.exit(1);
      }

      this.shutdownInProgress = true;
      tui.log("info", "orchestrator", `Received ${signal}, shutting down gracefully`);
      
      await this.shutdownAll();
      process.exit(0);
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
    process.on("SIGHUP", handleShutdown);

    process.on("uncaughtException", async (error) => {
      tui.log("error", "orchestrator", "Uncaught exception", { error: error.message });
      await this.shutdownAll();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      tui.log("error", "orchestrator", "Unhandled rejection", { reason });
      await this.shutdownAll();
      process.exit(1);
    });
  }

  async start(config: OrchestratedProcess): Promise<void> {
    this.processConfigs.set(config.id, config);

    return this.queue.add(async () => {
      // Check dependencies first
      if (config.dependencies) {
        await this.waitForDependencies(config.dependencies);
      }

      // Start the process
      await this.processManager.start(config);
      
      // Set up health check
      if (config.healthCheck) {
        this.startHealthCheck(config.id);
      }

      tui.addProcess({
        id: config.id,
        name: config.name,
        status: "running",
        command: config.command,
        args: config.args,
        logs: [],
      });
    });
  }

  async stop(id: string, force = false): Promise<void> {
    return this.queue.add(async () => {
      this.stopHealthCheck(id);
      await this.processManager.stop(id, force);
      tui.removeProcess(id);
    });
  }

  async restart(id: string): Promise<void> {
    return this.queue.add(async () => {
      await this.processManager.restart(id);
      
      // Restart health check
      const config = this.processConfigs.get(id);
      if (config?.healthCheck) {
        this.startHealthCheck(id);
      }
    });
  }

  async startMany(configs: OrchestratedProcess[]): Promise<void> {
    // Sort by dependencies to start in correct order
    const sortedConfigs = this.topologicalSort(configs);
    
    for (const config of sortedConfigs) {
      await this.start(config);
    }
  }

  async shutdownAll(): Promise<void> {
    this.shutdownInProgress = true;
    
    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Stop all health checks
    for (const healthCheck of this.healthChecks.values()) {
      healthCheck.stop();
    }
    this.healthChecks.clear();

    // Get shutdown order (reverse of startup order)
    const processes = Array.from(this.processConfigs.values());
    const shutdownOrder = this.topologicalSort(processes).reverse();

    // Stop processes in order
    for (const config of shutdownOrder) {
      try {
        await this.processManager.stop(config.id);
      } catch (error) {
        tui.log("warn", "orchestrator", `Error stopping process ${config.id}`, { error });
      }
    }

    // Force stop any remaining processes
    await this.processManager.stopAll(true);
    
    tui.log("info", "orchestrator", "All processes stopped");
  }

  private async waitForDependencies(dependencies: DependencyConfig[]): Promise<void> {
    const waitPromises = dependencies.map(dep => this.waitForDependency(dep));
    await Promise.all(waitPromises);
  }

  private async waitForDependency(dependency: DependencyConfig): Promise<void> {
    const timeout = dependency.timeout || this.config.defaultTimeout || 30000;
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Dependency '${dependency.id}' timeout after ${timeout}ms`));
          return;
        }

        const state = this.processManager.getProcess(dependency.id);
        if (!state) {
          setTimeout(check, 1000);
          return;
        }

        switch (dependency.condition) {
          case "started":
            if (state.status === "running" || state.status === "stopped") {
              resolve();
            } else {
              setTimeout(check, 1000);
            }
            break;
          case "running":
            if (state.status === "running") {
              resolve();
            } else {
              setTimeout(check, 1000);
            }
            break;
          case "healthy":
            if (state.healthStatus === "healthy") {
              resolve();
            } else {
              setTimeout(check, 1000);
            }
            break;
        }
      };

      check();
    });
  }

  private startHealthCheck(id: string): void {
    const config = this.processConfigs.get(id);
    if (!config?.healthCheck) return;

    const healthCheckConfig = {
      ...this.config.healthCheckDefaults,
      ...config.healthCheck,
    };

    const healthCheck = new HealthCheck(id, healthCheckConfig);
    
    healthCheck.on("healthy", () => {
      const state = this.processManager.getProcess(id);
      if (state) {
        state.healthStatus = "healthy";
        state.lastHealthCheck = new Date();
        this.emit("healthChanged", id, "healthy", state);
      }
    });

    healthCheck.on("unhealthy", () => {
      const state = this.processManager.getProcess(id);
      if (state) {
        state.healthStatus = "unhealthy";
        state.lastHealthCheck = new Date();
        this.emit("healthChanged", id, "unhealthy", state);
      }
    });

    healthCheck.start();
    this.healthChecks.set(id, healthCheck);
  }

  private stopHealthCheck(id: string): void {
    const healthCheck = this.healthChecks.get(id);
    if (healthCheck) {
      healthCheck.stop();
      this.healthChecks.delete(id);
    }
  }

  private topologicalSort(configs: OrchestratedProcess[]): OrchestratedProcess[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: OrchestratedProcess[] = [];
    const configMap = new Map(configs.map(c => [c.id, c]));

    const visit = (configId: string) => {
      if (visited.has(configId)) return;
      if (visiting.has(configId)) {
        throw new Error(`Circular dependency detected: ${configId}`);
      }

      visiting.add(configId);
      
      const config = configMap.get(configId);
      if (config?.dependencies) {
        for (const dep of config.dependencies) {
          if (configMap.has(dep.id)) {
            visit(dep.id);
          }
        }
      }

      visiting.delete(configId);
      visited.add(configId);
      
      if (config) {
        result.push(config);
      }
    };

    for (const config of configs) {
      visit(config.id);
    }

    return result;
  }

  private startMetricsCollection(): void {
    const interval = this.config.metricsInterval || 5000;
    
    this.metricsInterval = setInterval(async () => {
      for (const [id] of this.processConfigs) {
        try {
          const metrics = await this.processManager.getMetrics(id);
          if (metrics) {
            this.emit("metrics", id, metrics);
            
            // Update TUI with metrics
            const processes = tui.instance?.getState().processes || [];
            const processIndex = processes.findIndex(p => p.id === id);
            if (processIndex >= 0) {
              processes[processIndex].cpu = metrics.cpu;
              processes[processIndex].memory = metrics.memory;
              processes[processIndex].uptime = metrics.uptime;
            }
          }
        } catch (error) {
          tui.log("debug", "orchestrator", `Failed to get metrics for ${id}`, { error });
        }
      }
    }, interval);
  }

  private updateTUI(): void {
    const processes = Array.from(this.processManager.getAllProcesses().entries()).map(([id, state]) => {
      const config = this.processConfigs.get(id);
      return {
        id,
        name: config?.name || id,
        status: state.status as any,
        pid: state.pid,
        startTime: state.startTime,
        command: config?.command,
        args: config?.args,
        logs: [],
      };
    });

    tui.instance?.updateProcesses(processes);
  }

  // Getters
  getProcess(id: string): ProcessState | undefined {
    return this.processManager.getProcess(id);
  }

  getAllProcesses(): Map<string, ProcessState> {
    return this.processManager.getAllProcesses();
  }

  isRunning(id: string): boolean {
    return this.processManager.isRunning(id);
  }

  getRunningCount(): number {
    return this.processManager.getRunningCount();
  }

  isShuttingDown(): boolean {
    return this.shutdownInProgress;
  }
}