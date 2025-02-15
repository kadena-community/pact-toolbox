import type { RsbuildPlugin } from "@rsbuild/core";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME, startToolboxNetwork } from "./plugin/utils";

export const pluginPactToolbox = (options?: PluginOptions): RsbuildPlugin => ({
  name: PLUGIN_NAME,
  async setup(api) {
    const toolboxConfig = await resolveConfig();
    const network = getNetworkConfig(toolboxConfig);
    const client = new PactToolboxClient(toolboxConfig);
    api.modifyRsbuildConfig((config) => {
      if (!config.source) {
        config.source = {};
      }
      if (!config.source.define) {
        config.source.define = {};
      }
      const networkConfig = getSerializableNetworkConfig(toolboxConfig);
      config.source.define["globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__"] = JSON.stringify(networkConfig);
    });
    api.onAfterStartDevServer(async () => {
      await startToolboxNetwork(
        {
          client,
          network,
          isServe: true,
          isTest: false,
        },
        toolboxConfig,
        options,
      );
    });
  },
});
