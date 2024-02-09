import { DevNetworkConfig } from '@pact-toolbox/config';
import { logger, pollFn } from '@pact-toolbox/utils';
import Docker from 'dockerode';
import { ProcessWrapper } from './types';
import { didMakeBlocks, isChainWebAtHeight, isChainWebNodeOk, isDockerInstalled } from './utils';

export async function startDevNet(network: DevNetworkConfig, silent = true) {
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

  const isOnDemand = network.onDemandMining;
  // const {
  //   app,
  //   stop: stopProxyServer,
  //   start: startProxyServer,
  // } = await createProxyServer({
  //   port: proxyPort,
  //   isOnDemand,
  //   url: `http://localhost:${nodeConfig.servicePort}`,
  // });

  // await startProxyServer();

  // poll devnet
  try {
    await pollFn(() => isChainWebNodeOk(devNetConfig.port), 10000);
    logger.success('DevNet started');
    if (isOnDemand) {
      // the mining client starts later than the node
      await pollFn(
        () =>
          didMakeBlocks({
            count: 5,
            port: devNetConfig.port,
          }),
        10000,
      );
    }
    await pollFn(() => isChainWebAtHeight(20, devNetConfig.port), 10000);
    logger.success('DevNet ready');
  } catch (e) {
    await stop();
    console.log(e);
    logger.fatal('DevNet did not start in time');
  }

  return dockerProcess;
}
