import { ProcessOrchestrator, type OrchestratedProcess } from "./orchestrator";
import { tui } from "@pact-toolbox/tui";
import type { OrchestratorConfig, ProcessConfig } from "./types";

let globalOrchestrator: ProcessOrchestrator | null = null;

/**
 * Create a process with monitoring capabilities
 */
export function createProcess(config: OrchestratedProcess): Promise<void> {
  const orchestrator = getOrchestrator();
  return orchestrator.start(config);
}

/**
 * Get or create global orchestrator instance
 */
export function getOrchestrator(config?: OrchestratorConfig): ProcessOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new ProcessOrchestrator({
      enableMetrics: true,
      metricsInterval: 5000,
      ...config,
    });

    // Enable TUI if in interactive environment
    if (process.stdout.isTTY && process.env.NODE_ENV !== "test") {
      tui.start();
    }
  }
  
  return globalOrchestrator;
}

/**
 * Higher-order function to add process monitoring to any function
 */
export function withProcessMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  processConfig: Omit<ProcessConfig, "command" | "args">
): T {
  return (async (...args: any[]) => {
    const orchestrator = getOrchestrator();
    
    // Create a synthetic process for monitoring
    const syntheticConfig: OrchestratedProcess = {
      ...processConfig,
      command: "node", // Placeholder
      args: ["-e", "console.log('synthetic process')"],
    };

    try {
      const result = await fn(...args);
      
      // Log success
      tui.log("info", processConfig.id, "Operation completed successfully");
      
      return result;
    } catch (error) {
      // Log error
      tui.log("error", processConfig.id, `Operation failed: ${error}`);
      throw error;
    }
  }) as T;
}

/**
 * Utility functions for common process patterns
 */
export const processPatterns = {
  /**
   * Create a web server process
   */
  webServer(config: {
    id: string;
    name: string;
    command: string;
    args?: string[];
    port: number;
    healthPath?: string;
    dependencies?: string[];
  }): OrchestratedProcess {
    return {
      ...config,
      healthCheck: {
        type: "http",
        url: `http://localhost:${config.port}${config.healthPath || "/health"}`,
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      dependencies: config.dependencies?.map(id => ({
        id,
        condition: "healthy" as const,
      })),
      autoRestart: true,
      maxRestarts: 3,
      restartDelay: 5000,
    };
  },

  /**
   * Create a database process
   */
  database(config: {
    id: string;
    name: string;
    command: string;
    args?: string[];
    host?: string;
    port: number;
  }): OrchestratedProcess {
    return {
      ...config,
      healthCheck: {
        type: "tcp",
        host: config.host || "localhost",
        port: config.port,
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      autoRestart: true,
      maxRestarts: 5,
      restartDelay: 10000,
    };
  },

  /**
   * Create a background worker process
   */
  worker(config: {
    id: string;
    name: string;
    command: string;
    args?: string[];
    healthCommand?: string;
    dependencies?: string[];
  }): OrchestratedProcess {
    const baseConfig: OrchestratedProcess = {
      ...config,
      dependencies: config.dependencies?.map(id => ({
        id,
        condition: "running" as const,
      })),
      autoRestart: true,
      maxRestarts: 3,
      restartDelay: 5000,
    };

    if (config.healthCommand) {
      baseConfig.healthCheck = {
        type: "command",
        command: config.healthCommand,
        interval: 60000,
        timeout: 10000,
        retries: 2,
      };
    }

    return baseConfig;
  },

  /**
   * Create a blockchain node process
   */
  blockchainNode(config: {
    id: string;
    name: string;
    command: string;
    args?: string[];
    rpcPort: number;
    p2pPort?: number;
    dependencies?: string[];
  }): OrchestratedProcess {
    return {
      ...config,
      healthCheck: {
        type: "tcp",
        host: "localhost",
        port: config.rpcPort,
        interval: 30000,
        timeout: 10000,
        retries: 3,
        initialDelay: 15000, // Blockchain nodes take time to start
      },
      dependencies: config.dependencies?.map(id => ({
        id,
        condition: "healthy" as const,
      })),
      autoRestart: true,
      maxRestarts: 3,
      restartDelay: 15000,
      timeout: 60000, // Longer timeout for blockchain nodes
    };
  },
};

/**
 * Shutdown all processes
 */
export async function shutdownAll(): Promise<void> {
  if (globalOrchestrator) {
    await globalOrchestrator.shutdownAll();
    globalOrchestrator = null;
  }
  
  tui.stop();
}