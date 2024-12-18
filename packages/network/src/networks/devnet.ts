import type { DevNetContainerConfig, DevNetMiningConfig, DevNetworkConfig } from "@pact-toolbox/config";
import type { DockerContainer, DockerContainerConfig } from "@pact-toolbox/utils";

import {
  cleanupOnExit,
  didMakeBlocks,
  DockerService,
  getUuid,
  isChainWebAtHeight,
  isChainWebNodeOk,
  isDockerInstalled,
  logger,
  pollFn,
} from "@pact-toolbox/utils";

import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from "../types";

/**
 * Converts the DevNet mining configuration to environment variables for the Docker container.
 * @param miningConfig - The mining configuration object.
 * @returns A record of environment variables.
 */
export function devNetMiningConfigToEnvVars(miningConfig?: DevNetMiningConfig): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (!miningConfig) return envVars;

  for (const [key, value] of Object.entries(miningConfig)) {
    if (value !== undefined) {
      const envKey = `MINING_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
      envVars[envKey] = String(value);
    }
  }

  return envVars;
}

/**
 * Singleton DockerService instance.
 */
export const dockerService: DockerService = new DockerService();

export class LocalDevNetNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  private container?: DockerContainer;
  private containerConfig: DevNetContainerConfig;
  private dockerContainerConfig: DockerContainerConfig;
  private containerEnv: Record<string, string> = {};

  constructor(
    private network: DevNetworkConfig,
    private dockerService: DockerService = new DockerService(),
  ) {
    // Use the correct DevNetContainerConfig
    this.containerConfig = {
      port: 8080,
      image: "kadena/devnet",
      name: "devnet",
      tag: "latest",
      volume: "kadena_devnet",
      ...this.network.containerConfig,
    };

    // Map DevNetContainerConfig to DockerContainerConfig
    this.dockerContainerConfig = this.mapToDockerContainerConfig(this.containerConfig);

    // Convert mining config to environment variables
    this.containerEnv = devNetMiningConfigToEnvVars(this.network.miningConfig);
  }

  private mapToDockerContainerConfig(devConfig: DevNetContainerConfig): DockerContainerConfig {
    const { image, tag, name, port, volume } = devConfig;

    // Build ports mapping
    const ports = port
      ? [
          {
            hostPort: port,
            containerPort: 8080,
          },
        ]
      : [];

    // Build volumes mapping
    const volumes = volume
      ? [
          {
            hostPath: volume,
            containerPath: "/chainweb-db", // Assuming the container expects data at this path
          },
        ]
      : [];

    return {
      image,
      tag,
      name,
      ports,
      volumes,
    };
  }

  get image(): string {
    return `${this.containerConfig.image}:${this.containerConfig.tag}`;
  }

  get volume(): string | undefined {
    return this.containerConfig.volume;
  }

  getServicePort(): number | string {
    return this.containerConfig.port ?? 8080;
  }

  hasOnDemandMining(): boolean {
    return true;
  }

  getOnDemandMiningUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  getServiceUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  async isOk(): Promise<boolean> {
    return isChainWebNodeOk(this.getServiceUrl());
  }

  private async prepareContainer(): Promise<DockerContainer> {
    if (!isDockerInstalled()) {
      throw new Error("Docker is not installed or not running. Please ensure Docker is installed and running.");
    }

    try {
      await this.dockerService.pullImageIfNotExists(this.image);
      logger.info(`Image ${this.image} is ready.`);
    } catch (error) {
      logger.error(`Failed to pull image ${this.image}:`, error);
      throw error;
    }

    if (this.volume) {
      try {
        await this.dockerService.createVolumeIfNotExists(this.volume);
        logger.info(`Volume ${this.volume} is ready.`);
      } catch (error) {
        logger.error(`Failed to create volume ${this.volume}:`, error);
        throw error;
      }
    }

    try {
      await this.dockerService.removeContainerIfExists(this.containerConfig.name ?? "devnet");
      logger.info(`Removed existing container ${this.containerConfig.name}.`);
    } catch (error) {
      logger.warn(`Failed to remove existing container:`, error);
      // Not critical, proceed
    }

    try {
      return await this.dockerService.createContainer(this.dockerContainerConfig, this.containerEnv);
    } catch (error) {
      logger.error(`Failed to create container:`, error);
      throw error;
    }
  }

  async start(options: ToolboxNetworkStartOptions = {}): Promise<void> {
    const { silent = false, isStateless = false } = options;

    // Modify container name if stateless
    if (isStateless) {
      this.containerConfig.name = `devnet-${this.id}`;
      this.dockerContainerConfig.name = this.containerConfig.name;
    }

    try {
      this.container = await this.prepareContainer();
      await this.dockerService.startContainer(this.container, !silent);
      logger.info(`Container ${this.containerConfig.name} started successfully.`);
    } catch (error) {
      logger.error(`Failed to start container ${this.containerConfig.name}:`, error);
      throw error;
    }

    // Ensure container is stopped on exit
    cleanupOnExit(async () => await this.stop());

    // Poll the devnet to ensure it's running
    try {
      await pollFn(() => isChainWebNodeOk(this.getServiceUrl()), {
        timeout: 10000,
        interval: 1000,
      });
      logger.info("Devnet is up and running.");
    } catch (error) {
      await this.stop();
      logger.error("Failed to start devnet within the expected time.", error);
      throw new Error("Failed to start devnet within the expected time.");
    }

    // Make initial blocks if on-demand mining is enabled
    if (this.hasOnDemandMining()) {
      try {
        await pollFn(
          () =>
            didMakeBlocks({
              count: 5,
              onDemandUrl: this.getOnDemandMiningUrl(),
            }),
          {
            timeout: 10000,
            interval: 1000,
          },
        );
        logger.info("Initial blocks created for on-demand mining.");
      } catch (error) {
        logger.error("Could not make initial blocks for on-demand mining.", error);
        throw new Error("Could not make initial blocks for on-demand mining.");
      }
    }

    // Ensure Chainweb node reaches the target height
    try {
      await pollFn(() => isChainWebAtHeight(20, this.getServiceUrl()), {
        timeout: 10000,
        interval: 1000,
      });
      logger.info("Chainweb node reached height 20.");
    } catch (error) {
      logger.error("Chainweb node did not reach height 20 within the expected time.", error);
      throw new Error("Chainweb node did not reach height 20 within the expected time.");
    }
  }

  async stop(): Promise<void> {
    if (this.container) {
      try {
        const inspectData = await this.container.inspect();

        if (inspectData.State.Running) {
          await this.container.kill();
          logger.info(`Container ${this.container.id} stopped.`);
        } else {
          logger.info(`Container ${this.container.id} is not running.`);
        }

        // Check if container still exists before removing
        try {
          const info = await this.container.inspect(); // Throws if container doesn't exist
          // check if the container is currently being removed
          if (info.State.Status === "removing") {
            logger.info(`Container ${this.container.id} is currently being removed.`);
            return;
          }
          await this.container.remove({ force: true });
          logger.info(`Container ${this.container.id} removed.`);
        } catch (removeError: any) {
          if (removeError.statusCode === 404) {
            logger.info(`Container ${this.container.id} already removed.`);
          } else {
            throw removeError;
          }
        }
      } catch (error) {
        logger.error("Error stopping or removing the container:", error);
      }
    }
  }

  async restart(options?: ToolboxNetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }
}

/**
 * Starts a local development network.
 * @param networkConfig - The network configuration.
 * @param startOptions - Options for starting the network.
 * @returns A promise that resolves to a LocalDevNetNetwork instance.
 */
export async function startDevNetNetwork(
  networkConfig: DevNetworkConfig,
  startOptions?: ToolboxNetworkStartOptions,
): Promise<LocalDevNetNetwork> {
  const network = new LocalDevNetNetwork(networkConfig);
  await network.start(startOptions);
  return network;
}
