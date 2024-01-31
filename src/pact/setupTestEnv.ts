import { PactToolboxClient } from '../client';
import { PactToolboxConfigObj, resolveConfig } from '../config';
import { startLocalNetwork } from './startLocalNetwork';

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  config: PactToolboxConfigObj;
}
export async function setupPactTestEnv(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
  client?: PactToolboxClient,
): Promise<PactTestEnv> {
  const config = typeof configOverrides === 'object' ? await resolveConfig(configOverrides) : await resolveConfig();
  const networkName = (typeof configOverrides === 'string' ? configOverrides : config.defaultNetwork) || 'local';
  config.defaultNetwork = networkName;
  if (!client) {
    client = new PactToolboxClient(config);
  }
  const processWrapper = await startLocalNetwork(config, {
    client,
    showLogs: false,
    logAccounts: false,
  });
  return {
    stop: async () => processWrapper?.stop(),
    client,
    config,
  };
}
