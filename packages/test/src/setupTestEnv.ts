import {
  NetworkConfig,
  PactToolboxConfigObj,
  getCurrentNetworkConfig,
  getNetworkRpcUrl,
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

export function getConfigOverrides(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
): Partial<PactToolboxConfigObj> {
  if (typeof configOverrides === 'string') {
    return {
      defaultNetwork: configOverrides,
    };
  }
  return configOverrides || {};
}

function injectNetworkConfig(config: PactToolboxConfigObj) {
  const network = getCurrentNetworkConfig(config);
  const pickedConfig = {
    networkId: network.networkId,
    chainId: network.chainId,
    rpcUrl: getNetworkRpcUrl(network),
    gasLimit: network.gasLimit,
    gasPrice: network.gasPrice,
    ttl: network.ttl,
    senderAccount: network.senderAccount,
    signers: network.signers,
    type: network.type,
    keysets: network.keysets,
    name: network.name,
  };
  (globalThis as any).__PACT_TOOLBOX_NETWORK__ = pickedConfig;
}
export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  config: PactToolboxConfigObj;
}

export async function setupPactTestEnv(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
  noPersistence: boolean = true,
  client?: PactToolboxClient,
): Promise<PactTestEnv> {
  const config = await resolveConfig(getConfigOverrides(configOverrides));
  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (noPersistence) {
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
