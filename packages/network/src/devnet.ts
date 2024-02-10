import { DevNetworkConfig } from '@pact-toolbox/config';
import { logger, pollFn } from '@pact-toolbox/utils';
import Docker from 'dockerode';
import { ProxyServer, createProxyServer } from './proxyServer';
import { ProcessWrapper } from './types';
import { didMakeBlocks, isChainWebAtHeight, isChainWebNodeOk, isDockerInstalled, pullDockerImage } from './utils';

export async function startDevNet(network: DevNetworkConfig, silent = true) {
  if (!isDockerInstalled()) {
    logger.fatal('Are you sure the docker is running?');
  }
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  const containerConfig = {
    port: 8080,
    name: 'devnet',
    image: 'kadena/devnet',
    ...network.containerConfig,
  };

  const docker = new Docker({
    socketPath: socket,
  });

  const imageName = `${containerConfig.image}:${containerConfig.tag}`;
  const volumeName = containerConfig.volume;
  // Check if the image exists
  try {
    await docker.getImage(imageName).inspect();
  } catch (e) {
    logger.log(`Image ${imageName} does not exist, pulling...`);
    // Pull the image
    await pullDockerImage(docker, imageName, (event) => {
      logger.info(`${event.status} ${event.progressDetail || ''}`);
    });
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
    const container = docker.getContainer(containerConfig.name);
    const containerInfo = await container.inspect();
    if (containerInfo.State.Running) {
      logger.log(`Container ${containerConfig.name} is running, killing...`);
      await container.kill();
    }
    logger.log(`Container ${containerConfig.name} exists, removing...`);
    await container.remove({
      force: true,
    });
  } catch (e) {
    // ignore
  }
  // Create the container
  const container = await docker.createContainer({
    Image: imageName,
    name: containerConfig.name,
    ExposedPorts: { '8080/tcp': {} },
    HostConfig: {
      Binds: volumeName ? [`${containerConfig.volume}:/data`] : [],
      PortBindings: { '8080/tcp': [{ HostPort: `${containerConfig.port || 8080}`, HostIp: '127.0.0.1' }] },
      PublishAllPorts: true,
      AutoRemove: true,
    },
  });

  // Start the container
  await container.start();

  logger.info(`Started container ${container.id} from image ${containerConfig.image}:${containerConfig.tag}`);

  if (!silent) {
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });
    logStream.on('data', (chunk) => {
      logger.log(chunk.toString());
    });
  }

  const isOnDemand = network.onDemandMining;
  const containerUrl = `http://localhost:${containerConfig.port}`;
  let proxy: ProxyServer | undefined;
  if (isOnDemand) {
    proxy = await createProxyServer({
      detentionUrl: containerUrl,
      onDemandUrl: isOnDemand ? containerUrl : undefined,
      port: network.proxyPort || 8080,
    });
    await proxy.start();
  }

  const stop = async () => {
    await proxy?.stop();
    await container.kill();
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
    await pollFn(() => isChainWebNodeOk(containerConfig.port), 10000);
    logger.success('DevNet started', isOnDemand ? 'with on-demand mining' : '');
    if (isOnDemand) {
      // the mining client starts later than the node
      await pollFn(
        () =>
          didMakeBlocks({
            count: 5,
            onDemandUrl: containerUrl,
          }),
        10000,
      );
    }
    await pollFn(() => isChainWebAtHeight(20, containerConfig.port), 10000);
  } catch (e) {
    await stop();
    logger.fatal('DevNet did not start in time');
  }

  return dockerProcess;
}
