import { DevNetContainerConfig, DevNetworkConfig } from '@pact-toolbox/config';
import {
  DockerContainer,
  DockerService,
  cleanUpProcess,
  didMakeBlocks,
  isChainWebAtHeight,
  isChainWebNodeOk,
  isDockerInstalled,
  logger,
  pollFn,
} from '@pact-toolbox/utils';
import { PactToolboxNetworkApi } from '../types';
import { getUuid } from '../utils';

export const dockerService = new DockerService();
export class LocalDevNetNetwork implements PactToolboxNetworkApi {
  public id = getUuid();
  private container?: DockerContainer;
  private containerConfig: Required<DevNetContainerConfig>;

  constructor(
    private network: DevNetworkConfig,
    private silent: boolean,
    private isStateless: boolean = false,
  ) {
    this.containerConfig = {
      port: 8080,
      name: 'devnet',
      image: 'kadena/devnet',
      tag: 'latest',
      volume: null,
      ...this.network.containerConfig,
    };
    this.containerConfig.name = this.isStateless
      ? `${this.containerConfig.name}-${this.id}`
      : this.containerConfig.name;
  }

  get image() {
    return `${this.containerConfig.image}:${this.containerConfig.tag}`;
  }

  get volume() {
    return this.containerConfig.volume;
  }

  getServicePort() {
    return this.containerConfig.port;
  }

  isOnDemandMining() {
    return !!this.network.onDemandMining;
  }

  getOnDemandUrl() {
    return `http://localhost:${this.containerConfig.port}`;
  }

  getServiceUrl(): string {
    return `http://localhost:${this.containerConfig.port}`;
  }

  async isOk() {
    return isChainWebNodeOk(this.getServiceUrl());
  }

  private async prepareContainer() {
    if (!isDockerInstalled()) {
      throw new Error(
        'Seems like Docker is not installed or running, please make sure Docker is installed and running',
      );
    }

    await dockerService.pullImageIfNotExists(this.image);
    if (this.volume) {
      await dockerService.createVolumeIfNotExists(this.volume);
    }
    await dockerService.removeContainerIfExists(this.containerConfig.name ?? 'devnet');

    return dockerService.createContainer(this.containerConfig);
  }

  async start() {
    this.container = await this.prepareContainer();
    await dockerService.startContainer(this.container, !this.silent);
    logger.info(`Started container ${this.container.id} from image ${this.image}`);

    cleanUpProcess(() => this.stop());

    // poll devnet
    try {
      await pollFn(() => isChainWebNodeOk(this.getServiceUrl()), 10000);
      logger.success('DevNet started');
    } catch (e) {
      await this.stop();
      throw new Error('DevNet did not start in time');
    }

    if (this.isOnDemandMining()) {
      try {
        await pollFn(
          () =>
            didMakeBlocks({
              count: 5,
              onDemandUrl: this.getOnDemandUrl(),
            }),
          10000,
        );
      } catch (e) {
        throw new Error('Could not make initial blocks for on-demand mining');
      }
    }

    try {
      await pollFn(() => isChainWebAtHeight(20, this.getServiceUrl()), 10000);
    } catch (e) {
      throw new Error('Chainweb node did not reach height 20');
    }
  }

  public async stop() {
    if (this.container) {
      await this.container.kill();
      logger.info(`Stopped container ${this.container.id}`);
    }
  }

  public async restart() {
    await this.stop();
    await this.start();
  }
}

export async function startDevNetNetwork(networkConfig: DevNetworkConfig, silent = true) {
  const network = new LocalDevNetNetwork(networkConfig, silent);
  await network.start();
  return network;
}
