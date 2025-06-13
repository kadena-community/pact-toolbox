import { resolveConfig } from "@pact-toolbox/config";
import { createPactToolboxNetwork, type PactToolboxNetwork } from "@pact-toolbox/network";
import { tui } from "@pact-toolbox/tui";
import { getOrchestrator } from "@pact-toolbox/process-manager";

class NetworkWorker {
  private network: PactToolboxNetwork | undefined;
  private isInitialized = false;
  private isShuttingDown = false;
  private shutdownTimeout?: NodeJS.Timeout;
  private maxShutdownTime = 30000; // 30 seconds

  constructor() {
    this.setupSignalHandlers();
    this.setupErrorHandlers();
  }

  private setupSignalHandlers(): void {
    const handleShutdown = async (signal: NodeJS.Signals) => {
      if (this.isShuttingDown) {
        tui.log("warn", "network-worker", "Shutdown already in progress, forcing exit");
        process.exit(1);
      }

      tui.log("info", "network-worker", `Received ${signal}, shutting down network...`);
      await this.gracefulShutdown();
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
    process.on("SIGHUP", handleShutdown);

    process.on("exit", (code) => {
      tui.log("info", "network-worker", `Process exiting with code ${code}`);
      if (!this.isShuttingDown) {
        this.forceShutdown();
      }
    });
  }

  private setupErrorHandlers(): void {
    process.on("uncaughtException", async (error) => {
      tui.log("error", "network-worker", `Uncaught exception: ${error.message}`, {
        stack: error.stack,
      });

      await this.gracefulShutdown();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      tui.log("error", "network-worker", `Unhandled rejection: ${reason}`, {
        promise: promise.toString(),
      });

      await this.gracefulShutdown();
      process.exit(1);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      tui.log("warn", "network-worker", "Network worker already initialized");
      return;
    }

    try {
      tui.log("info", "network-worker", "Initializing network worker");

      const resolvedConfig = await resolveConfig();

      tui.log("debug", "network-worker", "Creating network instance");

      this.network = await createPactToolboxNetwork(resolvedConfig, {
        autoStart: false,
        cleanup: false,
        logAccounts: true,
        conflictStrategy: "replace",
      });

      // Register network with process orchestrator
      const orchestrator = getOrchestrator();
      await orchestrator.start({
        id: "pact-network",
        name: "Pact Toolbox Network",
        command: "internal", // Not a real command since this is the network itself
        args: [],
        autoRestart: false,
        healthCheck: {
          type: "http",
          url: `http://localhost:${resolvedConfig.networks?.devnet?.containerConfig?.port || 8080}/health`,
          interval: 30000,
          timeout: 5000,
          retries: 3,
        },
      });

      this.isInitialized = true;
      tui.log("info", "network-worker", "Network worker initialized successfully");
    } catch (error) {
      tui.log("error", "network-worker", `Failed to initialize network worker: ${error}`);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.network) {
      throw new Error("Network not initialized");
    }

    try {
      tui.log("info", "network-worker", "Starting Pact network");

      const startTime = Date.now();
      await this.network.start();
      const duration = Date.now() - startTime;

      tui.log("info", "network-worker", `Pact network started successfully in ${duration}ms`, {
        networkId: this.network.id,
        duration,
      });

      // Update TUI with network status
      tui.updateNetwork({
        id: this.network.id,
        name: "Pact Toolbox Network",
        status: "running",
        endpoints: [
          { name: "RPC", url: `http://localhost:8080`, status: "up" },
        ],
      });

      // Monitor network health
      this.startHealthMonitoring();
    } catch (error) {
      tui.log("error", "network-worker", `Failed to start network: ${error}`, {
        networkId: this.network?.id,
      });

      throw error;
    }
  }

  private startHealthMonitoring(): void {
    if (!this.network) return;

    const checkHealth = async () => {
      try {
        const isHealthy = await this.checkNetworkHealth();

        if (!isHealthy) {
          tui.log("warn", "network-worker", "Network health check failed");
          tui.updateNetwork({
            id: this.network!.id,
            status: "failed",
          });
        } else {
          tui.log("debug", "network-worker", "Network health check passed");
        }
      } catch (error) {
        tui.log("error", "network-worker", `Error during health check: ${error}`);
      }
    };

    // Initial health check after 10 seconds
    setTimeout(checkHealth, 10000);

    // Regular health checks every 30 seconds
    setInterval(checkHealth, 30000);
  }

  private async checkNetworkHealth(): Promise<boolean> {
    if (!this.network) return false;

    try {
      // Implement actual health check logic
      // This could include checking if containers are running,
      // if endpoints are responding, etc.
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.network) {
      tui.log("warn", "network-worker", "No network to stop");
      return;
    }

    try {
      tui.log("info", "network-worker", "Stopping Pact network", {
        networkId: this.network.id,
      });

      const stopTime = Date.now();
      await this.network.stop();
      const duration = Date.now() - stopTime;

      tui.log("info", "network-worker", `Pact network stopped successfully in ${duration}ms`);

      // Update TUI
      tui.updateNetwork({
        id: this.network.id,
        status: "stopped",
      });
    } catch (error) {
      tui.log("error", "network-worker", `Error stopping network: ${error}`);
      throw error;
    }
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    tui.log("info", "network-worker", "Starting graceful shutdown");

    // Set maximum shutdown time
    this.shutdownTimeout = setTimeout(() => {
      tui.log("warn", "network-worker", "Graceful shutdown timeout, forcing exit");
      this.forceShutdown();
    }, this.maxShutdownTime);

    try {
      // Stop the network
      await this.stop();

      // Stop process orchestrator
      const orchestrator = getOrchestrator();
      await orchestrator.shutdownAll();

      tui.log("info", "network-worker", "Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      tui.log("error", "network-worker", `Error during graceful shutdown: ${error}`);
      this.forceShutdown();
    } finally {
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }
    }
  }

  private forceShutdown(): void {
    tui.log("warn", "network-worker", "Force shutdown initiated");

    // Force stop network immediately
    if (this.network) {
      // Don't await this, just trigger it
      this.network.stop().catch(() => {});
    }

    process.exit(1);
  }

  getNetworkId(): string | undefined {
    return this.network?.id;
  }

  isNetworkRunning(): boolean {
    return this.isInitialized && !!this.network && !this.isShuttingDown;
  }
}

// Create and start the network worker
async function main(): Promise<void> {
  const worker = new NetworkWorker();

  try {
    // Enable TUI for better monitoring
    tui.start();

    await worker.start();

    tui.log("info", "network-worker", "Network worker is running", {
      pid: process.pid,
      networkId: worker.getNetworkId(),
    });

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    tui.log("error", "network-worker", "Network worker failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error("Failed to start network worker:", error);
    process.exit(1);
  });
}

export { NetworkWorker };
