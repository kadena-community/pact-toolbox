import type { RsbuildPlugin } from "@rsbuild/core";

import { getNetworkConfig, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME, createPactToolboxNetwork } from "./plugin/utils";
import type { PactToolboxNetwork } from "@pact-toolbox/network";
import { spinner } from "@pact-toolbox/utils";

export const pluginPactToolbox = (options?: PluginOptions): RsbuildPlugin => ({
  name: PLUGIN_NAME,
  async setup(api) {
    const toolboxConfig = await resolveConfig();
    const networkConfig = getNetworkConfig(toolboxConfig);
    let client = new PactToolboxClient(toolboxConfig);
    let network: PactToolboxNetwork | null = null;
    api.onCloseDevServer(async () => {
      if (network) {
        const shutdownSpinner = spinner({ indicator: "timer" });
        try {
          shutdownSpinner.start("Shutting down network...");
          await Promise.race([network?.stop(), new Promise((resolve) => setTimeout(resolve, 10000))]);
        } finally {
          shutdownSpinner.stop("Network stopped!");
        }
      }
    });
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
      const { network: networkInstance, client: networkClient } = await createPactToolboxNetwork(
        {
          client,
          networkConfig,
          isServe: true,
          isTest: false,
        },
        toolboxConfig,
        options,
      );
      network = networkInstance;
      client = networkClient;
    });
  },
});
