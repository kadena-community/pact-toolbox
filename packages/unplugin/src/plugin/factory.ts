import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import { createUnplugin } from "unplugin";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { writeFileAtPath } from "@pact-toolbox/utils";

import type { ErrorDetail } from "../transformer/errors";
import type { CachedTransform, PluginOptions } from "./types";
import { ParsingError } from "../transformer/errors";
import { createPactToJSTransformer } from "../transformer/pactToJS";
import { PLUGIN_NAME, startToolboxNetwork } from "./utils";

/**
 * Factory function to create the Vite plugin.
 * @param options Plugin options including transformation hooks.
 * @returns An instance of the Unplugin.
 */
export const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options = {}) => {
  // Initialize cache to store transformation results
  const cache = new Map<string, CachedTransform>();

  // Resolve Pact Toolbox configuration
  const toolboxConfigPromise = resolveConfig();

  // Initialize variables to hold resolved configuration and network details
  let resolvedConfig: any; // Replace 'any' with actual type from @pact-toolbox/config
  let network: any; // Replace 'any' with actual type from @pact-toolbox/config
  let client: PactToolboxClient | undefined = options.client;

  // Determine environment flags
  let isTest = process.env.NODE_ENV === "test";
  let isServe = false;

  // Initialize the transformer with visitor
  const transformPactToJS = createPactToJSTransformer();

  /**
   * Asynchronous function to handle server configuration.
   */
  const configureServer = async () => {
    try {
      resolvedConfig = await toolboxConfigPromise;
      network = getNetworkConfig(resolvedConfig);
      client = new PactToolboxClient(resolvedConfig);

      // // Generate TypeScript declaration files for contracts
      // await createDtsFiles(resolvedConfig.contractsDir);

      // Start the Pact Toolbox network
      await startToolboxNetwork({ isServe, isTest, client, network }, resolvedConfig, options);
    } catch (error) {
      console.error("Error during server configuration:", error);
    }
  };

  /**
   * Asynchronous function to handle configuration resolution.
   * @param config Vite resolved configuration.
   */
  const onConfigResolved = async (config: any) => {
    // Replace 'any' with actual Vite config type
    try {
      resolvedConfig = await toolboxConfigPromise;

      // Update environment flags based on Vite command
      isTest = config.command === "test" || isTest;
      isServe = config.command === "serve";

      if (!isTest) {
        const networkConfig = getSerializableNetworkConfig(resolvedConfig);
        config.define = config.define || {};
        config.define["globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__"] = JSON.stringify(networkConfig);
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

    if (!shouldTransform) {
      return {
        code: cached!.code,
        map: null,
      };
    }

    try {
      const { code, types, modules } = transformPactToJS(src);

      // Check if contracts are deployed
      const isDeployed =
        modules.length > 0
          ? (await Promise.all(modules.map((m) => client?.isContractDeployed(m)))).every(Boolean)
          : false;

      // Update cache with new transformation data
      cache.set(id, { code, types, src, isDeployed });

      // Handle deployment if required
      if (shouldTransform) {
        deployContract(id, src, isDeployed);
      }

      return {
        code,
        map: null,
      };
    } catch (error) {
      if (error instanceof ParsingError) {
        console.error(`Parsing error in ${id}:`);
        error.errors.forEach((err: ErrorDetail) => {
          console.error(`  Line ${err.line}, Column ${err.column}: ${err.message}`);
        });
        return null; // Prevent further processing for invalid files
      }
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

    try {
      await Promise.all([
        // Write TypeScript declaration file
        writeFileAtPath(`${id}.d.ts`, cache.get(id)!.types),

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
          }),
      ]);
    } catch (error) {
      console.error(`Failed to deploy contract ${id}:`, error);
    }
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
      const networkConfig = getSerializableNetworkConfig(resolvedConfig);

      const definePlugin = new DefinePlugin({
        "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(networkConfig),
      });

      if (!client) {
        client = new PactToolboxClient(resolvedConfig);
      }

      if (!network) {
        network = getNetworkConfig(resolvedConfig);
      }

      definePlugin.apply(compiler);

      if (compiler.options.mode === "development") {
        await startToolboxNetwork({ isServe: true, isTest: false, client, network }, resolvedConfig, options);
      }
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
      const networkConfig = getSerializableNetworkConfig(await toolboxConfigPromise);
      build.initialOptions.define = {
        ...(build.initialOptions.define ?? {}),
        "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(networkConfig),
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
     * Hook called when the Vite configuration is resolved.
     * @param config Vite resolved configuration.
     */
    configResolved: onConfigResolved,

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
