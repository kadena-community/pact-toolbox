import type { PactToolboxConfigObj } from '@pact-toolbox/config';
import { getCurrentNetworkConfig, getNetworkRpcUrl } from '@pact-toolbox/config';
import { delay } from '@pact-toolbox/utils';
import { statSync } from 'node:fs';

export async function isChainWebNodeOk(port: number | string = 8080) {
  try {
    const res = await fetch(`http://localhost:${port}/health-check`);
    if (res.ok) {
      const message = await res.text();
      if (message.includes('Health check OK.')) {
        return true;
      }
      await delay(5);
    }
  } catch (e) {}
  return false;
}

export async function isChainWebAtHeight(targetHeight: number, port: number | string = 8080) {
  try {
    const res = await fetch(`http://localhost:${port}/chainweb/0.0/fast-development/cut`);
    if (res.ok) {
      const data = (await res.json()) as { height: number };
      const height = data.height;
      if (height >= targetHeight) {
        return true;
      }
      return false;
    }
  } catch (e) {}
  return false;
}

export function isDockerInstalled() {
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  try {
    const stats = statSync(socket);
    return stats.isSocket();
  } catch (e) {
    return false;
  }
}

export interface MakeBlocksParams {
  count?: number;
  chainIds?: string[];
  port?: number | string;
}
export async function makeBlocks({ count = 1, chainIds = ['0'], port = 8080 }: MakeBlocksParams) {
  const body = JSON.stringify(chainIds.reduce((acc, chainId) => ({ ...acc, [chainId]: count }), {}));
  const res = await fetch(`http://localhost:${port}/make-blocks`, {
    method: 'POST',
    body: body,
  });
  if (res.ok) {
    const data = await res.json();
    return data;
  } else {
    throw new Error('Failed to make blocks');
  }
}

export async function didMakeBlocks(params: MakeBlocksParams) {
  try {
    await makeBlocks(params);
    return true;
  } catch (e) {
    return false;
  }
}

export function injectGlobals(config: PactToolboxConfigObj) {
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
  (globalThis as any).__pactToolboxNetwork__ = pickedConfig;
}
