import Docker from 'dockerode';
import { statSync } from 'node:fs';

export async function isChainWebNodeOk(port: number | string = 8080) {
  try {
    const res = await fetch(`http://localhost:${port}/health-check`);
    if (res.ok) {
      const message = await res.text();
      if (message.includes('Health check OK.')) {
        return true;
      }
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

export async function pullDockerImage(docker: Docker, imageName: string, onProgress: (event: any) => void) {
  try {
    const stream = await docker.pull(imageName);
    return new Promise((resolve, reject) => {
      docker.modem.followProgress(
        stream,
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        },
        onProgress,
      );
    });
  } catch (e) {
    return Promise.reject(e);
  }
}
export interface MakeBlocksParams {
  count?: number;
  chainIds?: string[];
  onDemandUrl: string;
}
export async function makeBlocks({ count = 1, chainIds = ['0'], onDemandUrl }: MakeBlocksParams) {
  const body = JSON.stringify(chainIds.reduce((acc, chainId) => ({ ...acc, [chainId]: count }), {}));
  const res = await fetch(`${onDemandUrl}/make-blocks`, {
    method: 'POST',
    body: body,
  });
  if (res.ok) {
    const data = await res.json();
    return data;
  } else {
    throw new Error(`Failed to make blocks ${res.status} ${res.statusText}`);
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
