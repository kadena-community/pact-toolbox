import type { PactToolboxConfigObj } from '@pact-toolbox/config';
import { getNetworkConfig, isLocalNetwork } from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import type { Options } from './options';

interface StartOptions {
  isTest: boolean;
  isServe: boolean;
}
export async function startToolboxNetwork(
  { isServe, isTest }: StartOptions,
  toolboxConfig: Required<PactToolboxConfigObj>,
  { startNetwork = true, onReady }: Options = {},
) {
  const network = getNetworkConfig(toolboxConfig);
  const client = new PactToolboxClient(toolboxConfig);
  if (isServe && !isTest && isLocalNetwork(network) && startNetwork) {
    logger.info('Starting local network');
    await startLocalNetwork(toolboxConfig, {
      client,
      isStateless: false,
      logAccounts: true,
    });
  }

  if (isServe && !isTest && onReady) {
    await onReady(client);
  }
}

export const PLUGIN_NAME = 'pact-toolbox';
