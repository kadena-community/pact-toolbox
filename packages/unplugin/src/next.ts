import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { NextConfig } from "next";

import { getNetworkConfig, getNetworkPort, getSerializableNetworkConfig, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { isPortTaken } from "@pact-toolbox/utils";

import type { PluginOptions } from "./plugin/types";
import { startToolboxNetwork } from "./plugin/utils";

const cache = {
  resolvedConfig: undefined as PactToolboxConfigObj | undefined,
  network: undefined as NetworkConfig | undefined,
  client: undefined as PactToolboxClient | undefined,
  isTest: process.env.NODE_ENV === "test",
};

function withPactToolbox(options: PluginOptions = {}) {
  return async (nextConfig: NextConfig = {}): Promise<NextConfig> => {
    const { client: passedClient, startNetwork = true } = options;

    if (!cache.resolvedConfig) {
      cache.resolvedConfig = await resolveConfig();
    }

    if (!cache.network) {
      cache.network = getNetworkConfig(cache.resolvedConfig);
    }

    if (!cache.client) {
      cache.client = passedClient ?? new PactToolboxClient(cache.resolvedConfig);
    }

    if (startNetwork && !(await isPortTaken(getNetworkPort(cache.network)))) {
      try {
        await startToolboxNetwork(
          {
            isServe: true,
            isTest: cache.isTest,
            client: cache.client,
            network: cache.network,
          },
          cache.resolvedConfig,
          options,
        );
      } catch (error) {
        console.error("[withPactToolbox] Error starting network:", error);
      }
    }

    // 8. Return the Next config
    return {
      ...nextConfig,
      compiler: {
        define: {
          "globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__": JSON.stringify(
            getSerializableNetworkConfig(cache.resolvedConfig),
          ),
        },
      },
      experimental: {
        turbo: {
          rules: {
            "*.pact": {
              loaders: ["@pact-toolbox/unplugin/loader"],
              as: "*.js",
            },
          },
        },
      },
    } as NextConfig;
  };
}

export default withPactToolbox;
