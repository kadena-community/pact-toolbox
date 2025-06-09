import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { resolveConfig } from "@pact-toolbox/config";
import { PactToolboxNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

import { injectNetworkConfig, updatePorts } from "./utils";

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  restart: () => Promise<void>;
  config: PactToolboxConfigObj;
}

export interface CreatePactTestEnvOptions {
  network?: string;
  client?: PactToolboxClient;
  configOverrides?: Partial<PactToolboxConfigObj>;
  config?: Required<PactToolboxConfigObj>;
  isStateless?: boolean;
}
export async function createPactTestEnv({
  network,
  client,
  config,
  configOverrides,
}: CreatePactTestEnvOptions = {}): Promise<PactTestEnv> {
  logger.pauseLogs();
  if (!config) {
    config = await resolveConfig(configOverrides);
  }

  if (network) {
    config.defaultNetwork = network;
  }

  await updatePorts(config);
  injectNetworkConfig(config);

  if (!client) {
    client = new PactToolboxClient(config);
  }

  const localNetwork = new PactToolboxNetwork(config, {
    client,
    isDetached: true,
    logAccounts: false,
    isStateless: true,
  });
  return {
    start: async () => localNetwork.start(),
    stop: async () => localNetwork.stop(),
    restart: async () => localNetwork.restart(),
    client,
    config,
  };
}
