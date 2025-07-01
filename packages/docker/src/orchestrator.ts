import { logger, type Logger } from "@pact-toolbox/node-utils";
import Docker from "dockerode";
import { DockerService } from "./service";
import type { DockerServiceConfig, OrchestratorConfig } from "./types";

export class ContainerOrchestrator {
  #docker: Docker = new Docker();
  #networkName: string;
  #networkId?: string;
  #runningServices: Map<string, DockerService[]>;
  #logger: Logger;
  #volumes: string[];
  #healthMonitorInterval?: NodeJS.Timeout;
  #recoveryEnabled: boolean = true;
  #maxRestartAttempts: number = 3;

  constructor(config: OrchestratorConfig) {
    this.#networkName = config.networkName;
    this.#runningServices = new Map();
    this.#logger = config.logger ?? logger.create({ level: 3 }); // Use info level (3) to match default logger
    this.#volumes = config.volumes || [];
  }

  async #getOrCreateNetwork(): Promise<void> {
    try {
      const network = this.#docker.getNetwork(this.#networkName);
      const inspectInfo = await network.inspect();
      this.#networkId = inspectInfo.Id;
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.#logger.start(`Creating network '${this.#networkName}'...`);
        const createdNetwork = await this.#docker.createNetwork({
          Name: this.#networkName,
          Driver: "bridge",
        });
        this.#networkId = createdNetwork.id;
        this.#logger.success(`Network '${this.#networkName}' created (ID: ${this.#networkId}).`);
      } else {
        this.#logger.error(`Error inspecting/creating network ${this.#networkName}:`, error.message || error);
        throw error;
      }
    }
    if (!this.#networkId) {
      throw new Error(`Failed to obtain network ID for '${this.#networkName}'`);
    }
  }

  async #createVolumes(): Promise<void> {
    for (const volume of this.#volumes) {
      try {
        this.#docker.getVolume(volume);
      } catch (error: any) {
        if (error.statusCode === 404) {
          await this.#docker.createVolume({ Name: volume });
        }
      }
    }
  }

  #resolveServiceOrder(services: DockerServiceConfig[]): string[] {
    const serviceMap = new Map(services.map((s) => [s.containerName, s]));
    const dependencies = new Map<string, Set<string>>();

    for (const service of services) {
      const serviceGroupName = service.containerName!;
      if (!dependencies.has(serviceGroupName)) {
        dependencies.set(serviceGroupName, new Set());
      }
      if (service.dependsOn) {
        const deps = dependencies.get(serviceGroupName)!;
        Object.keys(service.dependsOn).forEach((depGroupName) => {
          if (serviceMap.has(depGroupName)) {
            deps.add(depGroupName);
          } else {
            this.#logger.warn(
              `Dependency '${depGroupName}' for service '${serviceGroupName}' not found in defined services. It will be ignored.`,
            );
          }
        });
      }
    }

    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (serviceGroupName: string): void => {
      if (visited.has(serviceGroupName)) return;
      if (visiting.has(serviceGroupName)) {
        throw new Error(`Circular dependency detected: ${serviceGroupName}`);
      }
      visiting.add(serviceGroupName);
      const serviceDeps = dependencies.get(serviceGroupName);
      if (serviceDeps) {
        for (const dep of serviceDeps) {
          visit(dep);
        }
      }
      visiting.delete(serviceGroupName);
      visited.add(serviceGroupName);
      sorted.push(serviceGroupName);
    };

    for (const service of services) {
      const serviceGroupName = service.containerName!;
      if (!visited.has(serviceGroupName)) {
        visit(serviceGroupName);
      }
    }
    return sorted;
  }

  /**
   * Handle graceful shutdown signals
   */
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.#logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.stopAllServices();
        process.exit(0);
      } catch (error) {
        this.#logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      this.#logger.error("Uncaught exception:", error);
      try {
        await this.stopAllServices();
      } catch (shutdownError) {
        this.#logger.error("Error during emergency shutdown:", shutdownError);
      }
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", async (reason, promise) => {
      this.#logger.error("Unhandled promise rejection at:", promise, "reason:", reason);
      try {
        await this.stopAllServices();
      } catch (shutdownError) {
        this.#logger.error("Error during emergency shutdown:", shutdownError);
      }
      process.exit(1);
    });
  }

  async startServices(serviceConfigs: DockerServiceConfig[]): Promise<void> {
    this.#logger.start(`Starting services...`);
    await this.#getOrCreateNetwork();
    await this.#createVolumes();
    const orderedServiceGroupNames = this.#resolveServiceOrder(serviceConfigs);
    this.#logger.debug(`Service startup order: ${orderedServiceGroupNames.join(", ")}`);

    for (const serviceGroupName of orderedServiceGroupNames) {
      const config = serviceConfigs.find((s) => s.containerName === serviceGroupName)!;
      if (!config) {
        this.#logger.warn(`Config for service group '${serviceGroupName}' not found. Skipping.`);
        continue;
      }

      const replicaCount = config.deploy?.replicas || 1;
      const serviceInstances: DockerService[] = [];

      this.#logger.debug(`Preparing to start ${replicaCount} instance(s) of service group '${serviceGroupName}'...`);

      for (let i = 0; i < replicaCount; i++) {
        const instanceName = replicaCount > 1 ? `${serviceGroupName}-${i + 1}` : serviceGroupName;
        const instanceConfig = { ...config, containerName: instanceName };

        const service = new DockerService(instanceConfig, {
          serviceName: instanceName,
          docker: this.#docker,
          networkName: this.#networkName,
          logger: this.#logger,
        });

        if (config.dependsOn) {
          for (const depGroupName of Object.keys(config.dependsOn)) {
            const depServiceGroupInstances = this.#runningServices.get(depGroupName);
            if (!depServiceGroupInstances || depServiceGroupInstances.length === 0) {
              throw new Error(
                `Dependency group '${depGroupName}' for '${instanceName}' not started or has no instances.`,
              );
            }
            if (config.dependsOn[depGroupName]?.condition === "service_healthy") {
              this.#logger.start(
                `Instance '${instanceName}' waiting for all instances of '${depGroupName}' to be healthy...`,
              );
              try {
                await Promise.all(depServiceGroupInstances.map((depInstance) => depInstance.waitForHealthy()));
                this.#logger.debug(`All instances of '${depGroupName}' are healthy for '${instanceName}'.`);
              } catch (healthError: any) {
                this.#logger.error(
                  `Health check failed for at least one instance of dependency group '${depGroupName}' for '${instanceName}': ${healthError.message}`,
                );
                throw new Error(`Dependency group '${depGroupName}' for '${instanceName}' failed to become healthy.`);
              }
            }
          }
        }

        try {
          this.#logger.debug(`Starting instance '${instanceName}' of service group '${serviceGroupName}'...`);
          await service.start();
          serviceInstances.push(service);
        } catch (startError: any) {
          this.#logger.error(
            `Failed to start instance '${instanceName}' of service group '${serviceGroupName}': ${startError.message}`,
          );
          throw startError;
        }
      }
      this.#runningServices.set(serviceGroupName, serviceInstances);
      this.#logger.success(
        `All ${replicaCount} instance(s) of service group '${serviceGroupName}' attempted to start.`,
      );
    }

    // Start health monitoring
    this.startHealthMonitoring();

    this.#logger.debug(`All provided service groups attempted to start.`);
  }

  private startHealthMonitoring(): void {
    if (this.#healthMonitorInterval) {
      clearInterval(this.#healthMonitorInterval);
    }

    if (!this.#recoveryEnabled) return;

    let isChecking = false;
    this.#healthMonitorInterval = setInterval(() => {
      // Prevent overlapping checks
      if (isChecking) return;
      isChecking = true;

      this.checkHealthAndRecover().finally(() => {
        isChecking = false;
      });
    }, 30000); // Check every 30 seconds
  }

  private async checkHealthAndRecover(): Promise<void> {
    for (const [_groupName, services] of this.#runningServices.entries()) {
      for (const service of services) {
        try {
          const healthy = await service.isHealthy();
          if (!healthy && service.restartCount < this.#maxRestartAttempts) {
            this.#logger.warn(`Service '${service.serviceName}' is unhealthy. Attempting recovery...`);
            await this.recoverService(service);
          }
        } catch (err: any) {
          this.#logger.debug(`Health check error for ${service.serviceName}: ${err.message}`);
        }
      }
    }
  }

  private async recoverService(service: DockerService): Promise<void> {
    try {
      // Calculate backoff delay
      const baseDelay = 5000; // 5 seconds
      const delay = baseDelay * Math.pow(2, service.restartCount);

      this.#logger.info(`Waiting ${delay}ms before restart attempt ${service.restartCount + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      await service.restart();

      // Wait for service to become healthy
      try {
        await service.waitForHealthy(60000); // 1 minute timeout
        this.#logger.success(`Service '${service.serviceName}' recovered successfully`);
      } catch {
        this.#logger.error(`Service '${service.serviceName}' failed to become healthy after restart`);
      }
    } catch (err: any) {
      this.#logger.error(`Failed to recover service '${service.serviceName}': ${err.message}`);
    }
  }

  async streamAllLogs(): Promise<void> {
    for (const serviceInstances of this.#runningServices.values()) {
      for (const service of serviceInstances) {
        service.streamLogs().catch((err) => {
          this.#logger.error(`Error starting log stream for ${service.serviceName}: ${err.message}`);
        });
      }
    }
  }

  stopAllLogStreams(): void {
    for (const serviceInstances of this.#runningServices.values()) {
      for (const service of serviceInstances) {
        service.stopLogStream();
      }
    }
  }

  async isServiceHealthy(serviceName: string): Promise<boolean> {
    const services = this.#runningServices.get(serviceName);
    if (!services || services.length === 0) {
      return false;
    }
    return services[0].isHealthy();
  }

  async getServiceLogs(serviceName: string, tail: number = 100): Promise<string[]> {
    const services = this.#runningServices.get(serviceName);
    if (!services || services.length === 0) {
      return [];
    }
    return services[0].getLogs(tail);
  }

  getService(serviceName: string): DockerService | undefined {
    const services = this.#runningServices.get(serviceName);
    return services?.[0];
  }

  async stopAllServices(): Promise<void> {
    this.#logger.start(`Gracefully shutting down all services...`);

    // Stop health monitoring
    if (this.#healthMonitorInterval) {
      clearInterval(this.#healthMonitorInterval);
      this.#healthMonitorInterval = undefined;
    }

    this.stopAllLogStreams();

    // Stop services in reverse order of their startup (group-wise)
    const serviceGroupNamesToStop = Array.from(this.#runningServices.keys()).reverse();

    for (const serviceGroupName of serviceGroupNamesToStop) {
      const serviceInstances = this.#runningServices.get(serviceGroupName);
      if (serviceInstances) {
        this.#logger.debug(`Stopping ${serviceInstances.length} instance(s) of service group '${serviceGroupName}'...`);
        // Stop instances of a group in parallel for faster shutdown
        await Promise.all(
          serviceInstances.map(async (service) => {
            try {
              await service.stop();
              await service.remove();
            } catch (err: any) {
              this.#logger.warn(`Error stopping/removing ${service.serviceName}: ${err.message}`);
            }
          }),
        );
        this.#logger.debug(`All instances of service group '${serviceGroupName}' stopped and removed.`);
      }
    }
    this.#runningServices.clear();

    // Cleanup orphaned containers with our label
    await this.cleanupOrphanedContainers();

    // Cleanup network
    await this.cleanupNetwork();

    this.#logger.success(`Service cleanup complete.`);
  }

  private async cleanupOrphanedContainers(): Promise<void> {
    try {
      const containers = await this.#docker.listContainers({
        all: true,
        filters: {
          label: [`com.pact-toolbox.network=${this.#networkName}`]
        }
      });

      for (const container of containers) {
        try {
          this.#logger.debug(`Removing orphaned container: ${container.Names[0]}`);
          await this.#docker.getContainer(container.Id).remove({ force: true });
        } catch (err: any) {
          this.#logger.debug(`Could not remove orphaned container ${container.Id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.#logger.debug(`Error during orphan cleanup: ${err.message}`);
    }
  }

  private async cleanupNetwork(): Promise<void> {
    if (!this.#networkId) return;

    try {
      const network = this.#docker.getNetwork(this.#networkId);
      const netInfo = await network.inspect().catch(() => null);

      if (!netInfo) {
        this.#logger.info(`Network '${this.#networkName}' not found, likely already removed.`);
        this.#networkId = undefined;
        return;
      }

      // Check if network has containers
      const hasContainers = netInfo.Containers && Object.keys(netInfo.Containers).length > 0;

      if (hasContainers) {
        // Try to disconnect containers first
        for (const [containerId, containerInfo] of Object.entries(netInfo.Containers)) {
          try {
            await network.disconnect({ Container: containerId, Force: true });
            this.#logger.debug(`Disconnected container ${(containerInfo as any).Name} from network`);
          } catch (err: any) {
            this.#logger.debug(`Could not disconnect container ${containerId}: ${err.message}`);
          }
        }

        // Try to remove network again
        try {
          await network.remove();
          this.#logger.success(`Network '${this.#networkName}' removed after disconnecting containers.`);
        } catch (err: any) {
          this.#logger.warn(`Network '${this.#networkName}' could not be removed: ${err.message}`);
        }
      } else {
        // No containers, remove network
        await network.remove();
        this.#logger.success(`Network '${this.#networkName}' removed.`);
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.#logger.info(`Network '${this.#networkName}' was already removed.`);
      } else {
        this.#logger.warn(`Error removing network '${this.#networkName}':`, error.message || error);
      }
    } finally {
      this.#networkId = undefined;
    }
  }
}
