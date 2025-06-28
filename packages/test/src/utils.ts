import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

import {
  getDefaultNetworkConfig,
  getSerializableNetworkConfig,
  isDevNetworkConfig,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { getRandomNetworkPorts } from "@pact-toolbox/node-utils";

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
  (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = network;
}

export async function updatePorts(config: PactToolboxConfigObj): Promise<NetworkConfig> {
  const ports = await getRandomNetworkPorts();
  const network = getDefaultNetworkConfig(config);
  if (isPactServerNetworkConfig(network)) {
    if (network.serverConfig) {
      network.serverConfig.port = ports.service;
    }
  }
  if (isDevNetworkConfig(network)) {
    if (network.containerConfig) {
      network.containerConfig.port = ports.service;
    }
  }

  return network;
}
