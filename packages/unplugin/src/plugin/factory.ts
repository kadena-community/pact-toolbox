import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import type { ConfigEnv, UserConfig } from "vite";
import { createUnplugin } from "unplugin";

import {
  getNetworkConfig,
  getSerializableNetworkConfig,
  isLocalNetwork,
  resolveConfig,
  type NetworkConfig,
  type PactToolboxConfigObj,
} from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { spinner, writeFile } from "@pact-toolbox/utils";
import path from "node:path";
import type { CachedTransform, PluginOptions } from "./types";
import { createPactToJSTransformer } from "../transform";
import { PLUGIN_NAME, prettyPrintError, createPactToolboxNetwork } from "./utils";
import type { PactToolboxNetwork } from "@pact-toolbox/network";

/**
 * Factory function to create the Vite plugin.
 * @param options Plugin options including transformation hooks.
 * @returns An instance of the Unplugin.
 */
export const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options = {}) => {
  const { startNetwork = true } = options;
  const cache = new Map<string, CachedTransform>();

  const toolboxConfigPromise = resolveConfig();

  let resolvedConfig: PactToolboxConfigObj;
  let networkConfig: NetworkConfig;
  let client: PactToolboxClient | undefined = options.client;
  let network: PactToolboxNetwork | null = null;

  // Determine environment flags
  let isTest = process.env.NODE_ENV === "test";
  let isServe = false;
  const deploySpinner = spinner({ indicator: "dots" });
  // Initialize the transformer with visitor
  const transformPactToJS = createPactToJSTransformer();

  /**
   * Asynchronous function to handle server configuration.
   */
  const configureServer = async () => {
    try {
      resolvedConfig = await toolboxConfigPromise;
      networkConfig = getNetworkConfig(resolvedConfig);
      client = new PactToolboxClient(resolvedConfig);

      // // Generate TypeScript declaration files for contracts
      // await createDtsFiles(resolvedConfig.contractsDir);
      if (startNetwork) {
        // Start the Pact Toolbox network
        const { network: networkInstance, client: networkClient } = await createPactToolboxNetwork(
          { isServe, isTest, client, networkConfig: networkConfig },
          resolvedConfig,
          options,
        );
        network = networkInstance;
        client = networkClient;
      }
    } catch (error) {
      console.error("Error during server configuration:", error);
    }
  };

  /**
   * Asynchronous function to handle configuration resolution.
   * @param config Vite resolved configuration.
   */
  const onConfig = async (config: UserConfig, { command }: ConfigEnv) => {
    // Replace 'any' with actual Vite config type
    try {
      resolvedConfig = await toolboxConfigPromise;

      // Update environment flags based on Vite command
      //@ts-expect-error
      isTest = command === "test" || isTest;
      isServe = command === "serve";

      if (!isTest) {
        const serializableNetworkConfig = getSerializableNetworkConfig(resolvedConfig);
        config.define = config.define || {};
        config.define["globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__"] = JSON.stringify(serializableNetworkConfig);
      }
    } catch (error) {
      console.error("Error during config resolution:", error);
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

    // Check cache to avoid redundant transformations
    const cached = cache.get(id);
    const shouldTransform = !cached || cached.src !== src;
    const cleanName = path.basename(id);

    if (!shouldTransform) {
      return {
        code: cached!.code,
        map: null,
      };
    }

    try {
      const { code, types, modules } = await transformPactToJS(src);

      // Check if contracts are deployed
      const isDeployed =
        modules.length > 0
          ? (await Promise.all(modules.map((m) => client?.isContractDeployed(m.path)))).every(Boolean)
          : false;

      // Update cache with new transformation data
      cache.set(id, { code, types, src, isDeployed });

      // Handle deployment if required
      if (isLocalNetwork(networkConfig) && network) {
        deployContract(id, src, isDeployed).catch((error) => {
          prettyPrintError(`Failed to deploy contract ${cleanName}`, error);
        });
      }

      return {
        code,
        map: null,
      };
    } catch (error) {
      // Handle errors from the Rust transformer
      if (error instanceof Error && error.message.includes("Pact transformation failed")) {
        console.error(`Transformation error in ${id}:`, error.message);
        return null; // Prevent further processing for invalid files
      }

      // Handle parsing errors (maintain backward compatibility)
      // if (error instanceof ParsingError) {
      //   console.error(`Parsing error in ${id}:`);
      //   // error.errors.forEach((err: ErrorDetail) => {
      //   //   console.error(`  Line ${err.line}, Column ${err.column}: ${err.message}`);
      //   // });
      //   return null; // Prevent further processing for invalid files
      // }

      console.error(`Unexpected error during transformation of ${id}:`, error);
      throw error; // Rethrow to let Vite handle it
    }
  };

  /**
   * Asynchronous function to handle contract deployment.
   * @param id File identifier (path).
   * @param src Source code of the `.pact` file.
   * @param isDeployed Flag indicating if the contract is already deployed.
   */
  const deployContract = async (id: string, src: string, isDeployed: boolean) => {
    if (!client) {
      console.error("PactToolboxClient is not initialized.");
      return;
    }

    deploySpinner.start(`Deploying contract ${path.basename(id)}...`);

    return Promise.all([
      // Write TypeScript declaration file
      writeFile(`${id}.d.ts`, cache.get(id)!.types),
      // Deploy the contract
      client
        .deployCode(src, {
          build: {
            upgrade: isDeployed,
            init: !isDeployed,
          },
        })
        .then(() => {
          // Update deployment status in cache
          const cached = cache.get(id);
          if (cached) {
            cached.isDeployed = true;
            cache.set(id, cached);
          }
          deploySpinner.stop(`Contract ${path.basename(id)} deployed successfully.`);
        }),
    ]);
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
      const serializableNetworkConfig = getSerializableNetworkConfig(resolvedConfig);

      const definePlugin = new DefinePlugin({
        "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(serializableNetworkConfig),
      });

      if (!client) {
        client = new PactToolboxClient(resolvedConfig);
      }

      if (!networkConfig) {
        networkConfig = getNetworkConfig(resolvedConfig);
      }

      definePlugin.apply(compiler);

      if (compiler.options.mode === "development") {
        const { network: networkInstance, client: networkClient } = await createPactToolboxNetwork(
          { isServe: true, isTest: false, client, networkConfig: networkConfig },
          resolvedConfig,
          options,
        );
        network = networkInstance;
        client = networkClient;
      }

      compiler.hooks.shutdown.tap(PLUGIN_NAME, async () => {
        const shutdownSpinner = spinner({ indicator: "timer" });
        if (network) {
          try {
            shutdownSpinner.start("Shutting down network...");
            await Promise.race([network.stop(), new Promise((resolve) => setTimeout(resolve, 10000))]);
          } finally {
            shutdownSpinner.stop("Network stopped!");
          }
        }
      });
    } catch (error) {
      console.error("Error during Rspack configuration:", error);
    }
  };

  /**
   * Sets up Esbuild options for the plugin.
   * @param build Esbuild build instance.
   */
  const setupEsbuild = async (build: any) => {
    // Replace 'any' with actual Esbuild build type
    try {
      const serializableNetworkConfig = getSerializableNetworkConfig(await toolboxConfigPromise);
      build.initialOptions.define = {
        ...build.initialOptions.define,
        "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(serializableNetworkConfig),
      };
    } catch (error) {
      console.error("Error during Esbuild setup:", error);
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
        const shutdownSpinner = spinner({ indicator: "timer" });
        if (error) {
          console.error("Error during Vite bundle:", error);
        }
        if (network) {
          try {
            shutdownSpinner.start("Shutting down network...");
            await Promise.race([network.stop(), new Promise((resolve) => setTimeout(resolve, 10000))]);
          } finally {
            shutdownSpinner.stop("Network stopped!");
          }
        }
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
