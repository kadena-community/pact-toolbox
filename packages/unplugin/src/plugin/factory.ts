import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import type { ConfigEnv, UserConfig } from "vite";
import { createUnplugin } from "unplugin";

import {
  getDefaultNetworkConfig,
  getSerializableMultiNetworkConfig,
  isLocalNetwork,
  resolveConfig,
  type NetworkConfig,
  type PactToolboxConfigObj,
} from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { writeFile, logger } from "@pact-toolbox/node-utils";
import path from "node:path";
import type { PluginOptions } from "./types";
import { createPactToJSTransformer } from "../transform";
import { PactTransformCache, createSourceHash } from "../cache";
import { PLUGIN_NAME, prettyPrintError } from "./utils";
import { PactToolboxNetwork, createNetwork } from "@pact-toolbox/network";
import { cleanupTransformer } from "../transform";

/**
 * Factory function to create the Vite plugin.
 * @param options Plugin options including transformation hooks.
 * @returns An instance of the Unplugin.
 */
export const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options = {}) => {
  const { startNetwork = true } = options;
  const cache = new PactTransformCache(options.cacheSize || 1000);

  const toolboxConfigPromise = resolveConfig();

  let resolvedConfig: PactToolboxConfigObj;
  let networkConfig: NetworkConfig;
  let client: PactToolboxClient | undefined = options.client;
  let network: PactToolboxNetwork | null = null;

  // Update environment flags based on Vite command
  let isTest = process.env.NODE_ENV === "test";
  let isServe = false;
  // Initialize the transformer with visitor
  const transformPactToJS = createPactToJSTransformer({
    generateTypes: true,
    debug: process.env.NODE_ENV === "development",
  });

  /**
   * Sets up the global context for the runtime
   */
  const setupGlobalContext = () => {
    if (client && !(globalThis as any).__PACT_TOOLBOX_CONTEXT__) {
      (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = {
        network: client.context,
        getNetworkConfig: () => client?.getNetworkConfig(),
      };
    }
  };

  /**
   * Asynchronous function to handle server configuration.
   */
  const configureServer = async () => {
    try {
      resolvedConfig = await toolboxConfigPromise;
      networkConfig = getDefaultNetworkConfig(resolvedConfig);
      client = new PactToolboxClient(resolvedConfig);

      if (startNetwork && isLocalNetwork(networkConfig) && (!isTest || isServe)) {
        // Create and start the network using the simplified API
        // Network will automatically register cleanup handlers for Ctrl+C, SIGTERM etc.
        network = await createNetwork(resolvedConfig, {
          autoStart: true,
          detached: true,
          registerCleanup: true,
        });

        // Ensure the global context is set
        setupGlobalContext();

        // Call onReady hook if provided
        if (options.onReady) {
          await options.onReady(client);
        }
      }
    } catch (error) {
      logger.error("Error during server configuration:", error);
    }
  };

  /**
   * Asynchronous function to handle configuration resolution.
   * @param config Vite resolved configuration.
   */
  const onConfig = async (config: UserConfig, { command, mode }: ConfigEnv) => {
    // Replace 'any' with actual Vite config type
    isServe = command === "serve";
    try {
      resolvedConfig = await toolboxConfigPromise;

      if (!isTest) {
        // Inject multi-network configuration
        const multiNetworkConfig = getSerializableMultiNetworkConfig(resolvedConfig, {
          isDev: mode !== "production",
          isTest,
        });

        config.define = config.define || {};
        // Check if globalThis has updated config at build time
        const configValue = (globalThis as any).__PACT_TOOLBOX_NETWORKS__ || JSON.stringify(multiNetworkConfig);
        config.define["globalThis.__PACT_TOOLBOX_NETWORKS__"] = configValue;
      }
    } catch (error) {
      logger.error("Error during config resolution:", error);
    }
  };

  /**
   * Asynchronous function to handle file transformation.
   * @param src Source code of the `.pact` file.
   * @param id File identifier (path).
   * @returns Transformed code and source map.
   */
  const transformFile = async (src: string, id: string) => {
    if (!id.endsWith(".pact")) return null;

    const sourceHash = createSourceHash(src);
    const cleanName = path.basename(id);

    // Check cache to avoid redundant transformations
    const cached = cache.get(id, sourceHash);
    if (cached) {
      return {
        code: cached.code,
        map: cached.sourceMap || null,
      };
    }

    try {
      // Transform with file path for better error messages
      const result = await transformPactToJS(src, id);

      const { code, types, modules, sourceMap, declarationMap } = result;

      // Check if contracts are deployed
      const isDeployed =
        modules.length > 0
          ? (await Promise.all(modules.map((m) => client?.isContractDeployed(m.path)))).every(Boolean)
          : false;

      // Convert modules to ModuleInfo format for cache (simplified since transform module interface is basic)
      const moduleInfos = modules.map((m) => ({
        name: m.name,
        namespace: undefined,
        governance: "",
        doc: undefined,
        functionCount: 0,
        schemaCount: 0,
        capabilityCount: 0,
        constantCount: 0,
      }));

      // Update cache with new transformation data
      cache.set(id, sourceHash, { javascript: code, typescript: types }, moduleInfos, isDeployed);

      // Write TypeScript declaration files immediately
      if (types) {
        writeTypeScriptFiles(id, types, declarationMap).catch((error) => {
          prettyPrintError(`Failed to write TypeScript files for ${cleanName}`, error);
        });
      }

      // Handle deployment if required
      if (isLocalNetwork(networkConfig) && (await network?.isHealthy())) {
        deployContract(id, src, isDeployed).catch((error) => {
          prettyPrintError(`Failed to deploy contract ${cleanName}`, error);
        });
      }

      return {
        code,
        map: sourceMap || null,
      };
    } catch (error) {
      // Handle errors from the Rust transformer
      if (error instanceof Error && error.message.includes("Pact transformation failed")) {
        logger.error(`Transformation error in ${id}:`, error.message);
        return null; // Prevent further processing for invalid files
      }

      logger.error(`Unexpected error during transformation of ${id}:`, error);
      throw error; // Rethrow to let Vite handle it
    }
  };

  /**
   * Asynchronous function to write TypeScript declaration files.
   * @param id File identifier (path).
   * @param types TypeScript definitions to write.
   * @param declarationMap Declaration map to write.
   */
  const writeTypeScriptFiles = async (id: string, types: string, declarationMap?: string) => {
    // Add declaration map comment to TypeScript file if available
    const typesWithComment = declarationMap ? `${types}\n//# sourceMappingURL=${path.basename(id)}.d.ts.map` : types;

    const tasks = [
      // Write TypeScript declaration file
      writeFile(`${id}.d.ts`, typesWithComment),
    ];

    // Write declaration map file if available
    if (declarationMap) {
      tasks.push(writeFile(`${id}.d.ts.map`, declarationMap));
    }

    return Promise.all(tasks);
  };

  /**
   * Asynchronous function to handle contract deployment.
   * @param id File identifier (path).
   * @param src Source code of the `.pact` file.
   * @param isDeployed Flag indicating if the contract is already deployed.
   */
  const deployContract = async (id: string, src: string, isDeployed: boolean) => {
    if (!client) {
      logger.error("PactToolboxClient is not initialized.");
      return;
    }

    const contractName = path.basename(id);
    logger.info(`Deploying contract ${contractName}...`);

    // Deploy the contract
    return client
      .deployCode(src, {
        builder: {
          upgrade: isDeployed,
          init: !isDeployed,
        },
      })
      .then(() => {
        // Update deployment status in cache
        cache.setDeploymentStatus(id, true);
        logger.success(`Contract ${contractName} deployed successfully.`);
      });
  };

  /**
   * Asynchronous function to handle Rspack integration.
   * @param compiler Rspack compiler instance.
   */
  const configureRspack = async (compiler: any) => {
    // Replace 'any' with actual Rspack compiler type
    try {
      const { DefinePlugin } = await import("@rspack/core");
      resolvedConfig = await toolboxConfigPromise;
      const serializableNetworkConfig = getSerializableMultiNetworkConfig(resolvedConfig);

      // Check if globalThis has updated config at build time
      const configValue = (globalThis as any).__PACT_TOOLBOX_NETWORKS__ || JSON.stringify(serializableNetworkConfig);

      const definePlugin = new DefinePlugin({
        "globalThis.__PACT_TOOLBOX_NETWORKS__": configValue,
      });

      if (!client) {
        client = new PactToolboxClient(resolvedConfig);
      }

      if (!networkConfig) {
        networkConfig = getDefaultNetworkConfig(resolvedConfig);
      }

      definePlugin.apply(compiler);

      if (compiler.options.mode === "development" && isLocalNetwork(networkConfig)) {
        network = await createNetwork(resolvedConfig, {
          autoStart: true,
          detached: true,
          registerCleanup: true,
        });

        // Ensure the global context is set
        setupGlobalContext();

        if (options.onReady) {
          await options.onReady(client);
        }
      }

      compiler.hooks.shutdown.tap(PLUGIN_NAME, async () => {
        // Explicit cleanup for immediate bundler shutdown
        // Networks also register their own signal handlers as fallback
        if (network) {
          await network.stop();
        }
        cleanupTransformer();
      });
    } catch (error) {
      logger.error("Error during Rspack configuration:", error);
    }
  };

  /**
   * Sets up Esbuild options for the plugin.
   * @param build Esbuild build instance.
   */
  const setupEsbuild = async (build: any) => {
    // Replace 'any' with actual Esbuild build type
    try {
      resolvedConfig = await toolboxConfigPromise;
      networkConfig = getDefaultNetworkConfig(resolvedConfig);

      const serializableNetworkConfig = getSerializableMultiNetworkConfig(resolvedConfig);
      // Check if globalThis has updated config at build time
      const configValue = (globalThis as any).__PACT_TOOLBOX_NETWORKS__ || JSON.stringify(serializableNetworkConfig);

      build.initialOptions.define = {
        ...build.initialOptions.define,
        "globalThis.__PACT_TOOLBOX_NETWORKS__": configValue,
      };

      // For esbuild in dev mode, start the network
      if (startNetwork && isLocalNetwork(networkConfig) && !isTest) {
        network = await createNetwork(resolvedConfig, {
          autoStart: true,
          detached: true,
          registerCleanup: true,
        });

        // Initialize client if not already done
        if (!client) {
          client = new PactToolboxClient(resolvedConfig);
        }

        // Ensure the global context is set
        if (client && !(globalThis as any).__PACT_TOOLBOX_CONTEXT__) {
          (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = {
            network: client.context,
            getNetworkConfig: () => client?.getNetworkConfig(),
          };
        }

        if (options.onReady) {
          await options.onReady(client);
        }
      }
    } catch (error) {
      logger.error("Error during Esbuild setup:", error);
    }
  };

  /**
   * Main plugin object created by Unplugin.
   */
  return {
    name: PLUGIN_NAME,
    enforce: "post",

    /**
     * Determines if the file should be transformed by the plugin.
     * @param id File identifier (path).
     * @returns Boolean indicating if the file should be transformed.
     */
    transformInclude(id) {
      return id.endsWith(".pact");
    },

    /**
     * Transforms the `.pact` file into JavaScript/TypeScript code.
     * @param src Source code of the `.pact` file.
     * @param id File identifier (path).
     * @returns Transformed code and source map.
     */
    transform: transformFile,

    /**
     * Hook called when the Vite server is being configured.
     */
    configureServer,

    /**
     * Modify Vite config before it's resolved
     * @param config Vite configuration.
     */
    vite: {
      config: onConfig,
      closeBundle: async (error) => {
        if (error) {
          logger.error("Error during Vite bundle:", error);
        }
        // Explicit cleanup for immediate bundler shutdown
        // Networks also register their own signal handlers as fallback
        if (network) {
          await network.stop();
        }
        cleanupTransformer();
      },
    },
    /**
     * Esbuild setup hook to inject global definitions.
     */
    esbuild: {
      setup: setupEsbuild,
    },

    /**
     * Rspack integration hook for defining global variables and starting the network in development mode.
     * @param compiler Rspack compiler instance.
     */
    rspack: configureRspack,

    /**
     * Webpack integration hooks
     */
    webpack(compiler) {
      // Use the rspack configuration for webpack too
      configureRspack(compiler);
    },
  };
};

/**
 * Create and export the Unplugin instance with default options.
 */
export const unplugin: UnpluginInstance<PluginOptions | undefined> = /* #__PURE__ */ createUnplugin(unpluginFactory);

/**
 * Default export of the plugin.
 */
export default unplugin;
