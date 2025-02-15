import type { UnpluginFactory, WebpackPluginInstance } from "unplugin";
import { createWebpackPlugin } from "unplugin";
import webpack from "webpack";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME, startToolboxNetwork } from "./plugin/utils";

const unpluginFactory: UnpluginFactory<PluginOptions | undefined> = (options) => {
  return {
    name: PLUGIN_NAME,
    enforce: "post",
    webpack: async (compiler) => {
      const toolboxConfig = await resolveConfig();
      const network = getNetworkConfig(toolboxConfig);
      const client = new PactToolboxClient(toolboxConfig);
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
          await startToolboxNetwork({ isServe: true, isTest: false, client, network }, toolboxConfig, options!);
        }
      });
    },
  };
};

export default createWebpackPlugin(unpluginFactory) as (options?: PluginOptions) => WebpackPluginInstance;
