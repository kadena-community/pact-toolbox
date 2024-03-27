import type { DevNetContainerConfig, DevNetMiningConfig, DevNetworkConfig } from '@pact-toolbox/config';
import type { DockerContainer } from '@pact-toolbox/utils';
import {
  DockerService,
  cleanUpProcess,
  didMakeBlocks,
  getUuid,
  isChainWebAtHeight,
  isChainWebNodeOk,
  isDockerInstalled,
  pollFn,
} from '@pact-toolbox/utils';
import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from '../types';

export function devNetMiningConfigToEnvVars(miningConfig?: DevNetMiningConfig): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (miningConfig?.batchPeriod) {
    envVars['MINING_BATCH_PERIOD'] = miningConfig.batchPeriod.toString();
  }
  if (miningConfig?.confirmationCount) {
    envVars['MINING_CONFIRMATION_COUNT'] = miningConfig.confirmationCount.toString();
  }
  if (miningConfig?.confirmationPeriod) {
    envVars['MINING_CONFIRMATION_PERIOD'] = miningConfig.confirmationPeriod.toString();
  }
  if (miningConfig?.disableConfirmation) {
    envVars['MINING_DISABLE_CONFIRMATION'] = miningConfig.disableConfirmation.toString();
  }
  if (miningConfig?.disableIdle) {
    envVars['MINING_DISABLE_IDLE'] = miningConfig.disableIdle.toString();
  }
  if (miningConfig?.idlePeriod) {
    envVars['MINING_IDLE_PERIOD'] = miningConfig.idlePeriod.toString();
  }

  return envVars;
}

export const dockerService = new DockerService();
export class LocalDevNetNetwork implements ToolboxNetworkApi {
  public id = getUuid();
  private container?: DockerContainer;
  private containerConfig: DevNetContainerConfig;
  private containerEnv: Record<string, string> = {};

  constructor(private network: DevNetworkConfig) {
    this.containerConfig = {
      port: 8080,
      image: 'kadena/devnet',
      name: 'devnet',
      tag: 'latest',
      volume: 'kadena_devnet',
      ...this.network.containerConfig,
    };
    this.containerEnv = devNetMiningConfigToEnvVars(this.network.miningConfig);
  }

  get image() {
    return `${this.containerConfig.image}:${this.containerConfig.tag}`;
  }

  get volume() {
    return this.containerConfig.volume;
  }

  getServicePort() {
    return this.containerConfig.port ?? 8080;
  }

  isOnDemandMining() {
    return !!this.network.onDemandMining;
  }

  getOnDemandUrl() {
    return `http://localhost:${this.containerConfig.port}`;
  }

  getServiceUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
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
    return dockerService.createContainer(this.containerConfig, this.containerEnv);
  }

  async start({ silent = false, isStateless = false, conflict = 'error' }: ToolboxNetworkStartOptions = {}) {
    this.containerConfig.name = isStateless ? `devnet-${this.id}` : this.containerConfig.name;
    this.container = await this.prepareContainer();
    try {
      await dockerService.startContainer(this.container, !silent);
    } catch (e) {
      console.error(e);
    }

    cleanUpProcess(() => this.stop());

    // poll devnet
    try {
      await pollFn(() => isChainWebNodeOk(this.getServiceUrl()), 10000);
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

  async stop() {
    console.log('Stopping devnet');
    if (this.container) {
      await this.container.kill();
    }
  }

  async restart(options?: ToolboxNetworkStartOptions) {
    console.log('Restarting devnet');
    await this.stop();
    await this.start(options);
  }
}

export async function startDevNetNetwork(networkConfig: DevNetworkConfig, startOptions?: ToolboxNetworkStartOptions) {
  const network = new LocalDevNetNetwork(networkConfig);
  await network.start(startOptions);
  return network;
}
