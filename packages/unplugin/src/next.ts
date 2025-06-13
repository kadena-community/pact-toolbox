import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { NextConfig } from "next";
import type { ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { tui } from "@pact-toolbox/tui";
import { processPatterns, getOrchestrator } from "@pact-toolbox/process-manager";

import type { PluginOptions } from "./plugin/types";
import type { PactToolboxNetwork } from "@pact-toolbox/network";

// Global singleton state to track initialization across multiple calls
interface GlobalPactToolboxState {
  isInitialized: boolean;
  isInitializing: boolean;
  initPromise: Promise<void> | null;
  resolvedConfig: PactToolboxConfigObj | null;
  networkConfig: NetworkConfig | null;
  client: PactToolboxClient | null;
  network: PactToolboxNetwork | null;
  networkProcess: ChildProcess | null;
  error: Error | null;
  isCleaningUp: boolean;
}

// Use a Symbol to create a truly global state that persists across module reloads
const GLOBAL_STATE_KEY = Symbol.for("__PACT_TOOLBOX_GLOBAL_STATE__");

function getGlobalState(): GlobalPactToolboxState {
  if (!(globalThis as any)[GLOBAL_STATE_KEY]) {
    (globalThis as any)[GLOBAL_STATE_KEY] = {
      isInitialized: false,
      isInitializing: false,
      initPromise: null,
      resolvedConfig: null,
      networkConfig: null,
      network: null,
      client: null,
      networkProcess: null,
      error: null,
      isCleaningUp: false,
    };
  }
  return (globalThis as any)[GLOBAL_STATE_KEY];
}

async function initializePactToolbox(options: PluginOptions = {}): Promise<void> {
  const isDev = process.argv.includes("dev");
  const state = getGlobalState();

  // If already initialized, return immediately
  if (state.isInitialized && !state.error) {
    return;
  }

  // If currently initializing, wait for the current initialization to complete
  if (state.isInitializing && state.initPromise) {
    await state.initPromise;
    return;
  }

  // Start initialization
  state.isInitializing = true;
  state.error = null;

  const initPromise = (async () => {
    try {
      const { client: passedClient, startNetwork: _startNetwork = true } = options;
      const isTest = process.env.NODE_ENV === "test";
      // Resolve configuration
      if (!state.resolvedConfig) {
        state.resolvedConfig = await resolveConfig();
      }

      // Get network configuration
      if (!state.networkConfig) {
        state.networkConfig = getNetworkConfig(state.resolvedConfig);
      }

      // Create or reuse client
      if (!state.client) {
        state.client = passedClient ?? new PactToolboxClient(state.resolvedConfig);
      }

      // Start network if requested and not in test mode
      if (isDev && !isTest) {
        try {
          tui.log("info", "next-plugin", "Starting network worker process");
          
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const workerPath = path.resolve(__dirname, "enhanced-network-worker.js");

          // Create network worker process using pattern
          const orchestrator = getOrchestrator();
          await orchestrator.start(processPatterns.worker({
            id: "next-network-worker",
            name: "Next.js Network Worker",
            command: process.execPath,
            args: [workerPath],
            healthCommand: `curl -f http://localhost:${state.networkConfig.devnet?.publicPort || 8080}/health`,
          }));

          tui.log("info", "next-plugin", "Network worker process started successfully");
          
          // Update TUI with network information
          tui.updateNetwork({
            id: "next-devnet",
            name: "Next.js DevNet",
            status: "running",
            endpoints: [
              { 
                name: "API", 
                url: `http://localhost:${state.networkConfig.devnet?.publicPort || 8080}`, 
                status: "up" 
              },
            ],
          });
        } catch (error) {
          tui.log("error", "next-plugin", `Error starting network worker: ${error}`);
          // Don't throw here - allow the plugin to continue working even if network fails
          state.error = error instanceof Error ? error : new Error(String(error));
        }
      }

      state.isInitialized = true;
    } catch (error) {
      state.error = error instanceof Error ? error : new Error(String(error));
      console.error("[withPactToolbox] Initialization failed:", state.error);
      throw state.error;
    } finally {
      state.isInitializing = false;
      state.initPromise = null;
    }
  })();

  state.initPromise = initPromise;
  await initPromise;
}

function withPactToolbox(options: PluginOptions = {}) {
  return async (nextConfig: NextConfig = {}): Promise<NextConfig> => {
    try {
      await initializePactToolbox(options);

      const state = getGlobalState();

      if (!state.resolvedConfig) {
        throw new Error("Failed to resolve Pact Toolbox configuration");
      }

      // Define turbopack rules for .pact files
      const rules = {
        "*.pact": {
          loaders: ["@pact-toolbox/unplugin/loader"],
          as: "*.js",
        },
      };

      // Return the enhanced Next.js configuration
      const enhancedConfig: NextConfig = {
        ...nextConfig,
        compiler: {
          ...nextConfig.compiler,
          define: {
            ...nextConfig.compiler?.define,
            "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(
              getSerializableNetworkConfig(state.resolvedConfig),
            ),
          },
        },
        turbopack: {
          ...nextConfig.turbopack,
          rules: {
            ...nextConfig.turbopack?.rules,
            ...rules,
          },
        },
      };

      const handleShutdown = async (signal: string) => {
        const state = getGlobalState();
        if (state.isCleaningUp) {
          tui.log("warn", "next-plugin", "Shutdown already in progress");
          return;
        }
        state.isCleaningUp = true;
        
        tui.log("info", "next-plugin", `${signal} received, shutting down...`);
        
        try {
          // Use process orchestrator for coordinated shutdown
          const orchestrator = getOrchestrator();
          await orchestrator.shutdownAll();
          
          // Fallback: stop network directly if orchestrator didn't handle it
          if (state.network) {
            await state.network.stop();
          }
          
          tui.log("info", "next-plugin", "Shutdown completed successfully");
        } catch (error) {
          tui.log("error", "next-plugin", `Error during shutdown: ${error}`);
          console.error(`Error during graceful shutdown:`, error);
        }
        process.exit(0);
      };

      // Only set up handlers if not already set up
      if (!process.listenerCount("SIGINT")) {
        process.on("SIGINT", () => handleShutdown("SIGINT"));
      }
      if (!process.listenerCount("SIGTERM")) {
        process.on("SIGTERM", () => handleShutdown("SIGTERM"));
      }

      return enhancedConfig;
    } catch (error) {
      console.error("[withPactToolbox] Failed to enhance Next.js configuration:", error);
      // Return the original config if enhancement fails
      return nextConfig;
    }
  };
}

export default withPactToolbox;
