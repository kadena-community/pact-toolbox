import { EventEmitter } from "node:events";
import { TUIRenderer } from "./renderer";
import { createDefaultTheme } from "./theme";
import type {
  TUIState,
  TUIOptions,
  TUIEvents,
  ProcessInfo,
  ContainerInfo,
  NetworkInfo,
  LogEntry,
  StatusInfo,
} from "./types";

export class TUIManager extends EventEmitter<TUIEvents> {
  private renderer: TUIRenderer;
  private state: TUIState;
  private options: Required<TUIOptions>;
  private refreshTimer?: NodeJS.Timeout;
  private isActive = false;

  constructor(options: TUIOptions = {}) {
    super();

    this.options = {
      theme: createDefaultTheme(options.theme),
      refreshRate: options.refreshRate ?? 1000,
      maxLogs: options.maxLogs ?? 100,
      enableInteraction: options.enableInteraction ?? true,
      width: options.width ?? (process.stdout.columns || 80),
      height: options.height ?? (process.stdout.rows || 24),
    };

    this.renderer = new TUIRenderer(this.options);
    this.state = this.createInitialState();

    this.setupInputHandling();
    this.setupResizeHandling();
  }

  private createInitialState(): TUIState {
    return {
      processes: [],
      containers: [],
      network: {
        id: "",
        name: "",
        status: "stopped",
        endpoints: [],
      },
      logs: [],
      status: {
        uptime: 0,
        totalProcesses: 0,
        runningProcesses: 0,
        totalContainers: 0,
        runningContainers: 0,
        networkStatus: "down",
      },
      isActive: false,
      lastUpdate: new Date(),
    };
  }

  private setupInputHandling(): void {
    if (!this.options.enableInteraction || !process.stdin.isTTY) {
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (data: string) => {
      const key = data.toString();
      const meta = {
        ctrl: key.charCodeAt(0) < 32,
        shift: key !== key.toLowerCase(),
        alt: key.startsWith("\x1b"),
      };

      // Handle common keys
      switch (key) {
        case "\u0003": // Ctrl+C
        case "q":
        case "Q":
          this.stop();
          this.emit("exit");
          break;
        case "r":
        case "R":
          this.refresh();
          break;
        case "\u001b[A": // Up arrow
        case "\u001b[B": // Down arrow
        case "\u001b[C": // Right arrow
        case "\u001b[D": // Left arrow
          // Handle arrow keys for navigation
          break;
        default:
          this.emit("keypress", key, meta);
      }
    });
  }

  private setupResizeHandling(): void {
    process.stdout.on("resize", () => {
      this.options.width = process.stdout.columns || 80;
      this.options.height = process.stdout.rows || 24;
      this.renderer.updateDimensions(this.options.width, this.options.height);
      this.emit("resize", this.options.width, this.options.height);
      this.render();
    });
  }

  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.state.isActive = true;

    // Hide cursor and clear screen
    this.renderer.hideCursor();
    this.renderer.clearScreen();

    // Start refresh timer
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshRate);

    // Initial render
    this.render();
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.state.isActive = false;

    // Stop refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    // Show cursor and cleanup
    this.renderer.showCursor();

    // Reset input handling
    if (this.options.enableInteraction && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }

  refresh(): void {
    this.state.lastUpdate = new Date();
    this.emit("refresh");
    this.render();
  }

  private render(): void {
    if (!this.isActive) return;

    try {
      const output = this.renderer.render(this.state);
      this.renderer.write(output);
    } catch (error) {
      // Silently handle render errors to prevent crashes
      console.error("TUI render error:", error);
    }
  }

  // State update methods
  updateProcesses(processes: ProcessInfo[]): void {
    this.state.processes = processes;
    this.state.status.totalProcesses = processes.length;
    this.state.status.runningProcesses = processes.filter(p => p.status === "running").length;
  }

  updateContainers(containers: ContainerInfo[]): void {
    this.state.containers = containers;
    this.state.status.totalContainers = containers.length;
    this.state.status.runningContainers = containers.filter(c => c.status === "running").length;
  }

  updateNetwork(network: Partial<NetworkInfo>): void {
    this.state.network = { ...this.state.network, ...network };
    this.state.status.networkStatus = 
      network.status === "running" ? "up" : 
      network.status === "failed" ? "down" : "degraded";
  }

  addLog(entry: LogEntry): void {
    this.state.logs.push(entry);
    
    // Trim logs if they exceed maximum
    if (this.state.logs.length > this.options.maxLogs) {
      this.state.logs = this.state.logs.slice(-this.options.maxLogs);
    }
  }

  updateStatus(status: Partial<StatusInfo>): void {
    this.state.status = { ...this.state.status, ...status };
  }

  // Convenience methods
  addProcess(process: ProcessInfo): void {
    const existingIndex = this.state.processes.findIndex(p => p.id === process.id);
    if (existingIndex >= 0) {
      this.state.processes[existingIndex] = process;
    } else {
      this.state.processes.push(process);
    }
    this.updateProcesses(this.state.processes);
  }

  removeProcess(processId: string): void {
    this.state.processes = this.state.processes.filter(p => p.id !== processId);
    this.updateProcesses(this.state.processes);
  }

  addContainer(container: ContainerInfo): void {
    const existingIndex = this.state.containers.findIndex(c => c.id === container.id);
    if (existingIndex >= 0) {
      this.state.containers[existingIndex] = container;
    } else {
      this.state.containers.push(container);
    }
    this.updateContainers(this.state.containers);
  }

  removeContainer(containerId: string): void {
    this.state.containers = this.state.containers.filter(c => c.id !== containerId);
    this.updateContainers(this.state.containers);
  }

  log(level: LogEntry["level"], source: string, message: string, data?: any): void {
    this.addLog({
      timestamp: new Date(),
      level,
      source,
      message,
      data,
    });
  }

  // Getters
  getState(): Readonly<TUIState> {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getOptions(): Readonly<Required<TUIOptions>> {
    return { ...this.options };
  }
}