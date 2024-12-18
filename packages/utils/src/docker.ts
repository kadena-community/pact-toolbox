import { statSync } from "node:fs";
import Docker from "dockerode";

import { logger } from "./logger";

export const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

export function isDockerInstalled(): boolean {
  const socket = DOCKER_SOCKET;
  try {
    const stats = statSync(socket);
    return stats.isSocket();
  } catch (e) {
    logger.error(`Docker is not installed or the socket is not accessible: ${e}`);
    return false;
  }
}

export interface PortMapping {
  hostPort: number | string;
  containerPort: number | string;
}

export interface VolumeMapping {
  hostPath: string;
  containerPath: string;
}

export interface DockerContainerConfig {
  name?: string;
  image: string;
  tag?: string;
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
}

export type DockerContainer = Docker.Container;

export class DockerService {
  public docker: Docker;

  constructor(private socket = DOCKER_SOCKET) {
    this.docker = new Docker({ socketPath: this.socket });
  }

  // Pull an image with progress feedback
  async pullImage(image: string, onProgress?: (event: any) => void) {
    try {
      const stream = await this.docker.pull(image);
      return new Promise((resolve, reject) => {
        this.docker.modem.followProgress(
          stream,
          (error, output) => {
            if (error) {
              reject(error);
            } else {
              resolve(output);
            }
          },
          onProgress,
        );
      });
    } catch (e) {
      logger.error(`Error pulling image ${image}: ${e}`);
      throw e;
    }
  }

  // Ensure the image exists locally, pull if not
  async pullImageIfNotExists(image: string) {
    try {
      await this.docker.getImage(image).inspect();
    } catch (e: any) {
      if (e.statusCode === 404) {
        logger.info(`Image ${image} not found locally. Pulling...`);
        await this.pullImage(image, (event) => {
          logger.info(`${event.status} ${event.progress || ""}`);
        });
      } else {
        logger.error(`Error inspecting image ${image}: ${e}`);
        throw e;
      }
    }
  }

  // Ensure the volume exists, create if not
  async createVolumeIfNotExists(volumeName: string) {
    const volume = this.docker.getVolume(volumeName);
    try {
      await volume.inspect();
      logger.info(`Volume ${volumeName} already exists.`);
    } catch (e: any) {
      if (e.statusCode === 404) {
        logger.info(`Volume ${volumeName} does not exist. Creating...`);
        await this.docker.createVolume({ Name: volumeName });
      } else {
        logger.error(`Error inspecting volume ${volumeName}: ${e}`);
        throw e;
      }
    }
  }

  // Remove a container if it exists
  async removeContainerIfExists(containerNameOrId: string) {
    try {
      const container = this.docker.getContainer(containerNameOrId);
      await container.inspect();

      const containerInfo = await container.inspect();

      if (containerInfo.State.Running) {
        logger.info(`Container ${containerNameOrId} is running. Stopping...`);
        await container.stop();
      }

      logger.info(`Removing container ${containerNameOrId}`);
      await container.remove({ force: true });
    } catch (e: any) {
      if (e.statusCode === 404) {
        // logger.info(`Container ${containerNameOrId} does not exist.`);
      } else {
        logger.error(`Error removing container ${containerNameOrId}: ${e}`);
        throw e;
      }
    }
  }

  // Create a container with the given configuration
  async createContainer(config: DockerContainerConfig, env: Record<string, string> = {}) {
    const imageName = `${config.image}:${config.tag || "latest"}`;

    try {
      // Ensure the image exists
      await this.pullImageIfNotExists(imageName);

      // Remove existing container with the same name
      if (config.name) {
        await this.removeContainerIfExists(config.name);
      }

      // Build ExposedPorts and PortBindings
      const ExposedPorts: Docker.ContainerCreateOptions["ExposedPorts"] = {};
      const PortBindings: Docker.HostConfig["PortBindings"] = {};

      if (config.ports) {
        for (const { hostPort, containerPort } of config.ports) {
          ExposedPorts[`${containerPort}/tcp`] = {};
          PortBindings[`${containerPort}/tcp`] = [{ HostPort: `${hostPort}` }];
        }
      }

      // Build volume bindings
      const Binds = config.volumes?.map(({ hostPath, containerPath }) => `${hostPath}:${containerPath}`) || [];

      const container = await this.docker.createContainer({
        Image: imageName,
        name: config.name,
        Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
        ExposedPorts,
        HostConfig: {
          Binds,
          PortBindings,
          AutoRemove: true,
        },
      });

      logger.info(`Container ${config.name || container.id} created successfully.`);
      return container;
    } catch (e) {
      logger.error(`Error creating container ${imageName}: ${e}`);
      throw e;
    }
  }
  // Start a container and optionally attach to its output
  async startContainer(container: DockerContainer, attach = false) {
    try {
      await container.start();
      logger.info(`Container ${container.id} started successfully.`);

      if (attach) {
        const stream = await container.attach({
          stream: true,
          stdout: true,
          stderr: true,
        });
        stream.on("data", (data: Buffer) => {
          logger.info(`[Container ${container.id}] ${data.toString()}`);
        });
      }
    } catch (e) {
      logger.error(`Error starting container ${container.id}: ${e}`);
      throw e;
    }
  }

  // Stop a running container
  async stopContainer(container: DockerContainer) {
    try {
      await container.stop();
      logger.info(`Container ${container.id} stopped successfully.`);
    } catch (e) {
      logger.error(`Error stopping container ${container.id}: ${e}`);
      throw e;
    }
  }

  // Remove a container
  async removeContainer(container: DockerContainer) {
    try {
      await container.remove({ force: true });
      logger.info(`Container ${container.id} removed successfully.`);
    } catch (e) {
      logger.error(`Error removing container ${container.id}: ${e}`);
      throw e;
    }
  }
}
