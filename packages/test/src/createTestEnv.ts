import { PactToolboxConfigObj, getNetworkConfig, resolveConfig } from '@pact-toolbox/config';
import { PactToolboxNetwork } from '@pact-toolbox/network';
import { PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { disablePersistance, injectNetworkConfig, updatePorts } from './utils';

export interface PactTestEnv {
  runtime: PactToolboxRuntime;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  restart: () => Promise<void>;
  config: PactToolboxConfigObj;
}

export interface CreatePactTestEnvOptions {
  network?: string;
  runtime?: PactToolboxRuntime;
  configOverrides?: Partial<PactToolboxConfigObj>;
  config?: Required<PactToolboxConfigObj>;
  noPersistence?: boolean;
  enableProxy?: boolean;
}
export async function createPactTestEnv({
  network,
  noPersistence = true,
  runtime,
  config,
  configOverrides,
  enableProxy = true,
}: CreatePactTestEnvOptions = {}): Promise<PactTestEnv> {
  logger.pauseLogs();
  if (!config) {
    config = await resolveConfig(configOverrides);
  }

  if (network) {
    config.defaultNetwork = network;
  }
  const networkConfig = getNetworkConfig(config);
  await updatePorts(networkConfig, enableProxy);

  injectNetworkConfig(config);

  if (!runtime) {
    runtime = new PactToolboxRuntime(config);
  }

  if (noPersistence) {
    if (network) {
      disablePersistance(networkConfig);
    }
  }

  const localNetwork = new PactToolboxNetwork(config, {
    runtime,
    silent: true,
    logAccounts: false,
    enableProxy,
    isStateless: true,
  });
  return {
    start: async () => localNetwork.start(),
    stop: async () => localNetwork.stop(),
    restart: async () => localNetwork.restart(),
    runtime,
    config,
  };
}
