import type { RsbuildPlugin } from "@rsbuild/core";

import { getDefaultNetworkConfig, getSerializableMultiNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME } from "./plugin/utils";
import { PactToolboxNetwork, createNetwork } from "@pact-toolbox/network";
import { logger, startSpinner, stopSpinner } from "@pact-toolbox/node-utils";
import { isLocalNetwork } from "@pact-toolbox/config";

export const pluginPactToolbox = (options?: PluginOptions): RsbuildPlugin => {
  return {
    name: PLUGIN_NAME,
    async setup(api) {
      let toolboxConfig: any;
      let networkConfig: any;
      let client: PactToolboxClient;
      let network: PactToolboxNetwork | null = null;

      try {
        toolboxConfig = await resolveConfig();
        networkConfig = getDefaultNetworkConfig(toolboxConfig);
        client = new PactToolboxClient(toolboxConfig);
      } catch (error) {
        logger.error("Failed to setup PactToolboxClient", error);
        return; // Skip plugin setup if config fails
      }
      api.onCloseDevServer(async () => {
        if (network) {
          try {
            startSpinner("Shutting down network...");
            await network.stop();
            stopSpinner(true, "Network stopped!");
          } catch (error) {
            stopSpinner(false, "Failed to stop network");
            logger.error("Failed to stop network", error);
          }
        }
      });
      api.modifyRsbuildConfig((config) => {
        try {
          if (!config.source) {
            config.source = {};
          }
          if (!config.source.define) {
            config.source.define = {};
          }
          const multiNetworkConfig = getSerializableMultiNetworkConfig(toolboxConfig, {
            isDev: config.mode !== "production",
            isTest: false,
          });

          // Check if globalThis has updated config at build time
          const configValue = (globalThis as any).__PACT_TOOLBOX_NETWORKS__ || JSON.stringify(multiNetworkConfig);

          config.source.define["globalThis.__PACT_TOOLBOX_NETWORKS__"] = configValue;
        } catch (error) {
          logger.error("Failed to inject config", error);
        }
      });
      api.onAfterStartDevServer(async () => {
        if (isLocalNetwork(networkConfig)) {
          try {
            startSpinner("Starting Pact network...");
            network = await createNetwork(toolboxConfig, {
              autoStart: true,
              detached: true,
            });
            stopSpinner(true, "Network started!");

            // Ensure the global context is set
            if (client && !(globalThis as any).__PACT_TOOLBOX_CONTEXT__) {
              (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = {
                network: client.context,
                getNetworkConfig: () => client.getNetworkConfig(),
              };
            }

            if (options?.onReady) {
              await options.onReady(client);
            }
          } catch (error) {
            stopSpinner(false, "Failed to start network");
            logger.error("Failed to start network", error);
          }
        }
      });
    },
  };
};
