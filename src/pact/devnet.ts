import Docker from 'dockerode';
import { statSync } from 'node:fs';
import { DevNetContainerConfig, DevNetworkConfig } from '../config';
import { logger } from '../logger';
import { ProcessWrapper } from '../types';
import { delay } from '../utils';

export async function isDockerRunning() {
  return true;
}

export async function isDevNetRunning(devNetConfig: DevNetContainerConfig = {}) {
  try {
    const res = await fetch(`http://127.0.0.1:${devNetConfig.port || 8080}/health-check`);
    if (res.ok) {
      const message = await res.text();
      if (message.includes('Health check OK.')) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

export async function pollDevNet(devNetConfig: DevNetContainerConfig = {}, timeout = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    const isStarted = await isDevNetRunning(devNetConfig);
    if (isStarted) {
      return true;
    }
    await delay(100);
  }
  throw new Error('DevNet did not start in time');
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

export async function startDevNet(network: DevNetworkConfig, showLogs = false) {
  if (!isDockerInstalled()) {
    logger.fatal('Are you sure the docker is running?');
  }
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  const devNetConfig = {
    port: 8080,
    // volume: 'kadena_devnet',
    name: 'devnet',
    image: 'kadena/devnet',
    // tag: 'latest',
    ...network.containerConfig,
  };

  const docker = new Docker({
    socketPath: socket,
  });

  const imageName = `${devNetConfig.image}:${devNetConfig.tag}`;
  const volumeName = devNetConfig.volume;
  // Check if the image exists
  try {
    docker.getImage(imageName);
  } catch (e) {
    logger.log(`Image ${imageName} does not exist, pulling...`);
    // Pull the image
    await docker.pull(imageName);
    // ignore
  }

  if (volumeName) {
    // Check if the volume exists
    try {
      docker.getVolume(volumeName);
    } catch (e) {
      logger.log(` Volume ${volumeName} does not exist, creating...`);
      await docker.createVolume({
        Name: volumeName,
      });
    }
  }

  // Remove the container if it exists
  try {
    const container = docker.getContainer(devNetConfig.name);
    const containerInfo = await container.inspect();
    if (containerInfo.State.Running) {
      logger.log(`Container ${devNetConfig.name} is running, killing...`);
      await container.kill();
    }
    logger.log(`Container ${devNetConfig.name} exists, removing...`);
    await container.remove();
  } catch (e) {
    // ignore
  }
  // Create the container
  const container = await docker.createContainer({
    Image: imageName,
    name: devNetConfig.name,
    ExposedPorts: { '8080/tcp': {} },
    HostConfig: {
      Binds: volumeName ? [`${devNetConfig.volume}:/data`] : [],
      PortBindings: { '8080/tcp': [{ HostPort: `${devNetConfig.port || 8080}`, HostIp: '127.0.0.1' }] },
      PublishAllPorts: true,
      AutoRemove: true,
    },
  });

  // Start the container
  await container.start();

  logger.info(`Started container ${container.id} from image ${devNetConfig.image}:${devNetConfig.tag}`);

  if (showLogs) {
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });
    logStream.on('data', (chunk) => {
      logger.log(chunk.toString());
    });
  }
  const stop = async () => {
    await container.kill();
    // await container.remove();
  };

  process.on('exit', async () => {
    await stop();
  });

  process.on('SIGINT', async () => {
    await stop();
    process.exit();
  });

  const dockerProcess: ProcessWrapper = {
    stop,
    id: container.id,
  };

  // poll devnet
  try {
    await pollDevNet(devNetConfig);
    logger.success('DevNet started');
  } catch (e) {
    await stop();
    logger.fatal('DevNet did not start in time');
  }

  await delay(7000);

  // if (client) {
  //   const config = client.getConfig().pact;
  //   logger.start('Deploying preludes');
  //   await deployPreludes(config, client);
  //   logger.success('Deployed preludes');
  // }
  return dockerProcess;
}
