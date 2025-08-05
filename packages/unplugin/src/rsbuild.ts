import type { RsbuildPlugin } from "@rsbuild/core";

import { getDefaultNetworkConfig, getSerializableMultiNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/deployer";

import type { PluginOptions } from "./plugin/types";
import { PLUGIN_NAME } from "./plugin/utils";
import { PactToolboxNetwork, createNetwork } from "@pact-toolbox/network";
import { logger, startSpinner, stopSpinner } from "@pact-toolbox/node-utils";
import { isLocalNetwork } from "@pact-toolbox/config";
import { pluginContextManager, generateBuildId } from "./context";

export const pluginPactToolbox = (options?: PluginOptions): RsbuildPlugin => {
  const buildId = generateBuildId();
  
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
        // Clean up plugin context
        pluginContextManager.remove(buildId);
        
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

          // Define build-time constants
          config.source.define["__PACT_TOOLBOX_BUILD_ID__"] = JSON.stringify(buildId);
          config.source.define["__PACT_TOOLBOX_NETWORKS__"] = JSON.stringify(multiNetworkConfig);
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
              registerCleanup: false, // Rsbuild handles its own cleanup via onCloseDevServer
            });
            stopSpinner(true, "Network started!");

            // Set up plugin context
            if (client) {
              pluginContextManager.register(buildId, {
                getClient: () => client,
                multiNetworkConfig: getSerializableMultiNetworkConfig(toolboxConfig),
              });
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
