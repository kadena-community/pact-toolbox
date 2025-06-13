import { TUIManager } from "./manager";
import type { TUIOptions, ProcessInfo, ContainerInfo, NetworkInfo } from "./types";

let globalTUI: TUIManager | null = null;

/**
 * Higher-order function to add TUI capabilities to any function
 */
export function withTUI<T extends (...args: any[]) => any>(
  fn: T,
  options?: TUIOptions
): T {
  return ((...args: any[]) => {
    const tui = useTUI(options);
    
    try {
      const result = fn(...args);
      
      // If it's a promise, handle it appropriately
      if (result && typeof result.then === "function") {
        return result.finally(() => {
          // Keep TUI running for monitoring, don't auto-stop
        });
      }
      
      return result;
    } catch (error) {
      tui.log("error", "withTUI", `Error in wrapped function: ${error}`);
      throw error;
    }
  }) as T;
}

/**
 * Hook to get or create a global TUI instance
 */
export function useTUI(options?: TUIOptions): TUIManager {
  if (!globalTUI) {
    globalTUI = new TUIManager(options);
    
    // Auto-start if we're in a TTY environment
    if (process.stdout.isTTY && process.env.NODE_ENV !== "test") {
      globalTUI.start();
    }
    
    // Setup global error handlers
    process.on("uncaughtException", (error) => {
      globalTUI?.log("error", "process", `Uncaught exception: ${error.message}`);
    });
    
    process.on("unhandledRejection", (reason) => {
      globalTUI?.log("error", "process", `Unhandled rejection: ${reason}`);
    });
    
    // Cleanup on exit
    process.on("exit", () => {
      globalTUI?.stop();
    });
  }
  
  return globalTUI;
}

/**
 * Convenience functions for common TUI operations
 */
export const tui = {
  /**
   * Get the global TUI instance
   */
  get instance(): TUIManager | null {
    return globalTUI;
  },

  /**
   * Start TUI monitoring
   */
  start(options?: TUIOptions): TUIManager {
    const tuiInstance = useTUI(options);
    tuiInstance.start();
    return tuiInstance;
  },

  /**
   * Stop TUI monitoring
   */
  stop(): void {
    globalTUI?.stop();
    globalTUI = null;
  },

  /**
   * Add a process to monitor
   */
  addProcess(process: ProcessInfo): void {
    globalTUI?.addProcess(process);
  },

  /**
   * Remove a process from monitoring
   */
  removeProcess(processId: string): void {
    globalTUI?.removeProcess(processId);
  },

  /**
   * Add a container to monitor
   */
  addContainer(container: ContainerInfo): void {
    globalTUI?.addContainer(container);
  },

  /**
   * Remove a container from monitoring
   */
  removeContainer(containerId: string): void {
    globalTUI?.removeContainer(containerId);
  },

  /**
   * Update network information
   */
  updateNetwork(network: Partial<NetworkInfo>): void {
    globalTUI?.updateNetwork(network);
  },

  /**
   * Log a message
   */
  log(level: "debug" | "info" | "warn" | "error", source: string, message: string, data?: any): void {
    globalTUI?.log(level, source, message, data);
  },

  /**
   * Update system status
   */
  updateStatus(status: { uptime?: number; systemResources?: { cpu: number; memory: number; disk: number } }): void {
    globalTUI?.updateStatus(status);
  },

  /**
   * Check if TUI is running
   */
  isRunning(): boolean {
    return globalTUI?.isRunning() ?? false;
  },
};

/**
 * Decorator for automatic TUI integration
 */
export function tuiMonitor(options?: TUIOptions) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    return class extends constructor {
      private _tui: TUIManager;

      constructor(...args: any[]) {
        super(...args);
        this._tui = useTUI(options);
      }

      get tui(): TUIManager {
        return this._tui;
      }
    };
  };
}

/**
 * Process monitoring decorator
 */
export function monitorProcess(processInfo: Omit<ProcessInfo, "status" | "logs">) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const tuiInstance = useTUI();
      
      // Add process to monitoring before execution
      tuiInstance.addProcess({
        ...processInfo,
        status: "starting",
        logs: [],
      });

      try {
        const result = originalMethod.apply(this, args);

        if (result && typeof result.then === "function") {
          // Handle async methods
          return result
            .then((value: any) => {
              tuiInstance.addProcess({
                ...processInfo,
                status: "running",
                logs: [],
              });
              return value;
            })
            .catch((error: any) => {
              tuiInstance.addProcess({
                ...processInfo,
                status: "failed",
                logs: [error.message],
              });
              throw error;
            });
        } else {
          // Handle sync methods
          tuiInstance.addProcess({
            ...processInfo,
            status: "running",
            logs: [],
          });
          return result;
        }
      } catch (error) {
        tuiInstance.addProcess({
          ...processInfo,
          status: "failed",
          logs: [error instanceof Error ? error.message : String(error)],
        });
        throw error;
      }
    };

    return descriptor;
  };
}