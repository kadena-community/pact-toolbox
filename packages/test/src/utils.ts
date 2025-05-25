import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

import {
  getNetworkConfig,
  getSerializableNetworkConfig,
  isDevNetworkConfig,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { getRandomNetworkPorts } from "@pact-toolbox/utils";

export function getConfigOverrides(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
): Partial<PactToolboxConfigObj> {
  if (typeof configOverrides === "string") {
    return {
      defaultNetwork: configOverrides,
    };
  }
  return configOverrides || {};
}

export function injectNetworkConfig(config: PactToolboxConfigObj): void {
  const network = getSerializableNetworkConfig(config);
  (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__ = network;
}

export async function updatePorts(config: PactToolboxConfigObj): Promise<NetworkConfig> {
  const ports = await getRandomNetworkPorts();
  config.devProxyPort = config.enableDevProxy ? ports.proxy.toString() : ports.service.toString();
  const network = getNetworkConfig(config);
  if (isPactServerNetworkConfig(network)) {
    if (network.serverConfig) {
      network.serverConfig.port = ports.service.toString();
    }
  }
  if (isDevNetworkConfig(network)) {
    if (network.containerConfig) {
      network.containerConfig.port = ports.service.toString();
    }
  }

  return network;
}
