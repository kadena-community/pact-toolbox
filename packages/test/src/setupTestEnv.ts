import {
  NetworkConfig,
  PactToolboxConfigObj,
  getCurrentNetworkConfig,
  isChainwebLocalNetworkConfig,
  isDevNetworkConfig,
  isPactServerNetworkConfig,
  resolveConfig,
} from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxClient } from '@pact-toolbox/runtime';

function disablePersistance(network: NetworkConfig) {
  if (isPactServerNetworkConfig(network) && network.serverConfig?.persistDir) {
    network.serverConfig.persistDir = undefined;
  }

  if (isDevNetworkConfig(network) && network.containerConfig?.volume) {
    network.containerConfig.volume = undefined;
  }

  if (isChainwebLocalNetworkConfig(network) && network.nodeConfig?.persistDb) {
    network.nodeConfig.persistDb = false;
  }

  return network;
}

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  config: PactToolboxConfigObj;
}

export async function setupPactTestEnv(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
  shouldDisablePersistence: boolean = true,
  client?: PactToolboxClient,
): Promise<PactTestEnv> {
  const config = typeof configOverrides === 'object' ? await resolveConfig(configOverrides) : await resolveConfig();
  const networkName = (typeof configOverrides === 'string' ? configOverrides : config.defaultNetwork) || 'local';
  config.defaultNetwork = networkName;
  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (shouldDisablePersistence) {
    const network = getCurrentNetworkConfig(config);
    if (network) {
      disablePersistance(network);
    }
  }
  const processWrapper = await startLocalNetwork(config, {
    client,
    silent: true,
    logAccounts: false,
  });
  return {
    stop: async () => processWrapper?.stop(),
    client,
    config,
  };
}
