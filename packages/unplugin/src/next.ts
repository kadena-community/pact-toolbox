import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { NextConfig } from "next";
import type { ChildProcess } from "node:child_process";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

import type { PluginOptions } from "./plugin/types";
import { createPactToolboxNetwork } from "./plugin/utils";
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
      const { client: passedClient, startNetwork = true } = options;
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
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const workerPath = path.resolve(__dirname, "network-worker.js");

          state.networkProcess = fork(workerPath, [], {
            detached: true,
            stdio: "inherit",
          });

          state.networkProcess.on("error", (err) => {
            logger.error("Network worker process error:", err);
          });
        } catch (error) {
          logger.error("[withPactToolbox] Error starting network:", error);
          // Don't throw here - allow the plugin to continue working even if network fails
          state.error = error instanceof Error ? error : new Error(String(error));
        }
      }

      state.isInitialized = true;
    } catch (error) {
      state.error = error instanceof Error ? error : new Error(String(error));
      logger.error("[withPactToolbox] Initialization failed:", state.error);
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
          return;
        }
        state.isCleaningUp = true;
        logger.info(`\n${signal} received. Shutting down network...`);
        try {
          if (state.networkProcess) {
            state.networkProcess.kill();
          }
          await state.network?.stop();
          logger.info("Network stopped");
        } catch (error) {
          console.error(`Error during graceful shutdown:`, error);
        }
        process.exit(0);
      };

      process.on("SIGINT", () => handleShutdown("SIGINT"));
      process.on("SIGTERM", () => handleShutdown("SIGTERM"));

      return enhancedConfig;
    } catch (error) {
      logger.error("[withPactToolbox] Failed to enhance Next.js configuration:", error);
      // Return the original config if enhancement fails
      return nextConfig;
    }
  };
}

export default withPactToolbox;
