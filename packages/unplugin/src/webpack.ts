import type { UnpluginFactory, WebpackPluginInstance } from "unplugin";
import { createWebpackPlugin } from "unplugin";
import webpack from "webpack";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME, createPactToolboxNetwork } from "./plugin/utils";
import type { PactToolboxNetwork } from "@pact-toolbox/network";
import { spinner } from "@pact-toolbox/utils";

const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options) => {
  return {
    name: PLUGIN_NAME,
    enforce: "post",
    webpack: async (compiler) => {
      const toolboxConfig = await resolveConfig();
      const networkConfig = getNetworkConfig(toolboxConfig);
      let client = new PactToolboxClient(toolboxConfig);
      let network: PactToolboxNetwork | null = null;
      compiler.hooks.done.tapPromise(PLUGIN_NAME, async () => {
        const networkConfig = getSerializableNetworkConfig(toolboxConfig);
        const define = new webpack.DefinePlugin({
          "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(networkConfig),
        });
        // @ts-ignore
        define.apply(compiler);
      });
      compiler.hooks.afterDone.tap(PLUGIN_NAME, async () => {
        if (compiler.options.mode === "development") {
          const { network: networkInstance, client: networkClient } = await createPactToolboxNetwork(
            { isServe: true, isTest: false, client, networkConfig },
            toolboxConfig,
            options,
          );
          network = networkInstance;
          client = networkClient;
        }
      });
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
    },
  };
};

export default createWebpackPlugin(unpluginFactory) as (options?: PluginOptions) => WebpackPluginInstance;
