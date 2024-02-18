import { PactToolboxConfigObj, getNetworkConfig, isLocalNetwork } from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxRuntime } from '@pact-toolbox/runtime';
import { Options } from './options';

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
  const runtime = new PactToolboxRuntime(toolboxConfig);
  if (isServe && !isTest && isLocalNetwork(network) && startNetwork) {
    await startLocalNetwork(toolboxConfig, {
      runtime,
      isStateless: false,
      enableProxy: true,
      logAccounts: true,
    });
  }

  if (isServe && !isTest && onReady) {
    await onReady(runtime);
  }
}

export const PLUGIN_NAME = 'pact-toolbox';
