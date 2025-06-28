import type { NextConfig } from "next";

import { getSerializableMultiNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { logger } from "@pact-toolbox/node-utils";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PactToolboxNetwork, createNetwork } from "@pact-toolbox/network";

// Unique symbol to prevent conflicts with other plugins
const NETWORK_KEY = Symbol.for("pact-toolbox-next-network");
const INIT_FLAG_KEY = Symbol.for("pact-toolbox-next-initialized");

// Use global registry to manage instances across hot reloads
interface GlobalNetworkRegistry {
  [NETWORK_KEY]?: PactToolboxNetwork;
  [INIT_FLAG_KEY]?: boolean;
}

const getGlobalRegistry = (): GlobalNetworkRegistry => {
  if (typeof globalThis !== "undefined") {
    return globalThis as any;
  }
  return global as any;
};

async function cleanupExistingNetwork(): Promise<void> {
  const registry = getGlobalRegistry();
  const existingNetwork = registry[NETWORK_KEY];

  if (existingNetwork) {
    try {
      logger.info("[next-plugin] Cleaning up existing network...");
      await existingNetwork.stop();
      registry[NETWORK_KEY] = undefined;
      registry[INIT_FLAG_KEY] = false;
      // Reset environment flag
      delete process.env["_PACT_TOOLBOX_NEXT"];
    } catch (error) {
      logger.error(`[next-plugin] Error cleaning up existing network: ${error}`);
    }
  }
}

async function startNetwork(): Promise<void> {
  const isDev = process.env.NODE_ENV === "development";
  const isTest = process.env.NODE_ENV === "test";
  const registry = getGlobalRegistry();

  // Only start in dev mode and not in test
  if (!isDev || isTest) {
    return;
  }

  // Use environment variable to prevent multiple initialization
  if (process.env["_PACT_TOOLBOX_NEXT"] === "1") {
    logger.info("[next-plugin] Network already initialized, skipping...");
    return;
  }
  process.env["_PACT_TOOLBOX_NEXT"] = "1";

  try {
    // Clean up any existing network first
    await cleanupExistingNetwork();

    logger.info("[next-plugin] Starting Pact network...");

    // Load configuration
    const resolvedConfig = await resolveConfig();

    // Create and start network with Next.js specific settings
    const network = await createNetwork(resolvedConfig, {
      autoStart: true,
      detached: true,
    });

    // Store in global registry to survive hot reloads
    registry[NETWORK_KEY] = network;
    registry[INIT_FLAG_KEY] = true;

    // Setup proper cleanup for Next.js hot reloads
    if (process.env.NODE_ENV === "development") {
      const cleanup = async () => {
        await cleanupExistingNetwork();
      };

      // Register cleanup for graceful shutdown
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("beforeExit", cleanup);

      // Handle Next.js specific cleanup
      if (typeof process.on === "function") {
        process.on("exit", cleanup);
      }
    }
    logger.info("[next-plugin] Pact network started successfully");
  } catch (error) {
    logger.error(`[next-plugin] Failed to start network: ${error}`);
    // Reset flags on failure
    registry[NETWORK_KEY] = undefined;
    registry[INIT_FLAG_KEY] = false;
    // Reset environment flag
    delete process.env["_PACT_TOOLBOX_NEXT"];
    // Don't throw - allow the plugin to continue without network
  }
}

function withPactToolbox(options: PluginOptions = {}) {
  return async (nextConfig: NextConfig = {}): Promise<NextConfig> => {
    // Start network on first load (non-blocking)
    void startNetwork();

    try {
      // Resolve configuration
      const resolvedConfig = await resolveConfig();

      // Initialize client if needed
      const { client: passedClient } = options;
      if (passedClient || options.client !== undefined) {
        // Client provided by user - they manage it
        void (passedClient ?? new PactToolboxClient(resolvedConfig));
      }

      // Return the enhanced Next.js configuration
      const enhancedConfig: NextConfig = {
        ...nextConfig,
        compiler: {
          ...nextConfig.compiler,
          define: {
            ...nextConfig.compiler?.define,
            "globalThis.__PACT_TOOLBOX_NETWORKS__":
              (globalThis as any).__PACT_TOOLBOX_NETWORKS__ ||
              JSON.stringify(
                getSerializableMultiNetworkConfig(resolvedConfig, {
                  isDev: process.env.NODE_ENV !== "production",
                  isTest: process.env.NODE_ENV === "test",
                }),
              ),
          },
        },
        turbopack: {
          ...nextConfig.turbopack,
          rules: {
            ...nextConfig.turbopack?.rules,
            "*.pact": {
              loaders: ["@pact-toolbox/unplugin/loader"],
              as: "*.js",
            },
          },
        },
        webpack: (config, context) => {
          // Add webpack rule for .pact files
          config.module.rules.push({
            test: /\.pact$/,
            use: [
              {
                loader: "@pact-toolbox/unplugin/loader",
                options: {},
              },
            ],
            type: "javascript/auto",
          });

          // Call the original webpack function if it exists
          if (typeof nextConfig.webpack === "function") {
            return nextConfig.webpack(config, context);
          }

          return config;
        },
      };

      return enhancedConfig;
    } catch (error) {
      logger.error("[withPactToolbox] Failed to enhance Next.js configuration:", error);
      // Return the original config if enhancement fails
      return nextConfig;
    }
  };
}

/**
 * Manual cleanup function for testing or explicit shutdown
 */
export async function cleanup(): Promise<void> {
  await cleanupExistingNetwork();
}

/**
 * Get the current network instance
 */
export function getNetwork(): PactToolboxNetwork | undefined {
  const registry = getGlobalRegistry();
  return registry[NETWORK_KEY];
}

/**
 * Check if the network is initialized
 */
export function isNetworkInitialized(): boolean {
  const registry = getGlobalRegistry();
  return !!registry[INIT_FLAG_KEY];
}

export default withPactToolbox;
