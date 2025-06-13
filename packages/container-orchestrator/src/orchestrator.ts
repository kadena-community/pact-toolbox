import { EventEmitter } from "node:events";
import Docker from "dockerode";
import { tui } from "@pact-toolbox/tui";
import type {
  ContainerConfig,
  ContainerState,
  ContainerEvents,
  OrchestratorConfig,
  NetworkConfig,
  VolumeConfig,
} from "./types";

export class ContainerOrchestrator extends EventEmitter<ContainerEvents> {
  private containerManager: ContainerManager;
  private networkManager: NetworkManager;
  private volumeManager: VolumeManager;
  private containers = new Map<string, ContainerConfig>();
  private networks = new Set<string>();
  private volumes = new Set<string>();
  private shutdownInProgress = false;

  constructor(private config: OrchestratorConfig = {}) {
    super();

    this.containerManager = new ContainerManager();
    this.networkManager = new NetworkManager();
    this.volumeManager = new VolumeManager();

    this.setupEvents();
  }

  private setupEvents(): void {
    // Forward container events
    this.containerManager.on("created", (id, state) => {
      this.updateTUI();
      this.emit("created", id, state);
    });

    this.containerManager.on("started", (id, state) => {
      this.updateTUI();
      this.emit("started", id, state);
    });

    this.containerManager.on("stopped", (id, state) => {
      this.updateTUI();
      this.emit("stopped", id, state);
    });

    this.containerManager.on("failed", (id, error, state) => {
      this.updateTUI();
      this.emit("failed", id, error, state);
    });

    this.containerManager.on("healthy", (id, state) => {
      this.updateTUI();
      this.emit("healthy", id, state);
    });

    this.containerManager.on("unhealthy", (id, state) => {
      this.updateTUI();
      this.emit("unhealthy", id, state);
    });

    if (this.config.enableMetrics) {
      this.containerManager.on("metrics", (id, metrics) => {
        this.emit("metrics", id, metrics);
      });
    }
  }

  async createNetwork(config: NetworkConfig): Promise<void> {
    await this.networkManager.create(config);
    this.networks.add(config.name);
    tui.log("info", "orchestrator", `Network '${config.name}' created`);
  }

  async createVolume(config: VolumeConfig): Promise<void> {
    await this.volumeManager.create(config);
    this.volumes.add(config.name);
    tui.log("info", "orchestrator", `Volume '${config.name}' created`);
  }

  async startContainer(config: ContainerConfig): Promise<void> {
    // Store container config
    this.containers.set(config.id, config);

    // Create networks if needed
    if (config.networks) {
      for (const networkName of config.networks) {
        if (!this.networks.has(networkName) && networkName !== this.config.defaultNetwork) {
          await this.createNetwork({ name: networkName });
        }
      }
    }

    // Create volumes if needed
    if (config.volumes) {
      for (const volume of config.volumes) {
        // Check if it's a named volume (not a bind mount)
        if (!volume.host.startsWith("/") && !volume.host.startsWith("./")) {
          if (!this.volumes.has(volume.host)) {
            await this.createVolume({ name: volume.host });
          }
        }
      }
    }

    // Wait for dependencies
    if (config.dependencies) {
      await this.waitForDependencies(config.dependencies);
    }

    // Start the container
    await this.containerManager.start(config);
    
    tui.addContainer({
      id: config.id,
      name: config.name,
      image: `${config.image}:${config.tag || "latest"}`,
      status: "running",
      ports: config.ports?.map(p => `${p.host}:${p.container}/${p.protocol || "tcp"}`) || [],
      logs: [],
    });
  }

  async stopContainer(id: string, force = false): Promise<void> {
    await this.containerManager.stop(id, force);
    tui.removeContainer(id);
  }

  async restartContainer(id: string): Promise<void> {
    await this.containerManager.restart(id);
  }

  async removeContainer(id: string, force = false): Promise<void> {
    await this.containerManager.remove(id, force);
    this.containers.delete(id);
    tui.removeContainer(id);
  }

  async startMany(configs: ContainerConfig[]): Promise<void> {
    // Sort by dependencies
    const sortedConfigs = this.topologicalSort(configs);
    
    for (const config of sortedConfigs) {
      try {
        await this.startContainer(config);
      } catch (error) {
        tui.log("error", "orchestrator", `Failed to start container '${config.id}': ${error}`);
        throw error;
      }
    }
  }

  async stopAll(force = false): Promise<void> {
    this.shutdownInProgress = true;
    
    // Get containers in reverse dependency order for shutdown
    const configs = Array.from(this.containers.values());
    const shutdownOrder = this.topologicalSort(configs).reverse();

    for (const config of shutdownOrder) {
      try {
        await this.containerManager.stop(config.id, force);
      } catch (error) {
        tui.log("warn", "orchestrator", `Error stopping container '${config.id}': ${error}`);
      }
    }

    // Clean up networks and volumes
    await this.cleanup();
    
    tui.log("info", "orchestrator", "All containers stopped");
  }

  async cleanup(): Promise<void> {
    // Remove networks (but not the default one)
    for (const networkName of this.networks) {
      if (networkName !== this.config.defaultNetwork) {
        try {
          await this.networkManager.remove(networkName);
        } catch (error) {
          tui.log("warn", "orchestrator", `Error removing network '${networkName}': ${error}`);
        }
      }
    }

    // Remove volumes (optional - could be kept for data persistence)
    if (this.config.defaultNetwork) {
      for (const volumeName of this.volumes) {
        try {
          await this.volumeManager.remove(volumeName);
        } catch (error) {
          tui.log("warn", "orchestrator", `Error removing volume '${volumeName}': ${error}`);
        }
      }
    }

    this.networks.clear();
    this.volumes.clear();
  }

  private async waitForDependencies(dependencies: string[]): Promise<void> {
    const waitPromises = dependencies.map(depId => this.waitForContainer(depId));
    await Promise.all(waitPromises);
  }

  private async waitForContainer(containerId: string): Promise<void> {
    const timeout = 60000; // 1 minute timeout
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for container '${containerId}'`));
          return;
        }

        const state = this.containerManager.getContainer(containerId);
        if (state?.status === "running") {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      };

      check();
    });
  }

  private topologicalSort(configs: ContainerConfig[]): ContainerConfig[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: ContainerConfig[] = [];
    const configMap = new Map(configs.map(c => [c.id, c]));

    const visit = (configId: string) => {
      if (visited.has(configId)) return;
      if (visiting.has(configId)) {
        throw new Error(`Circular dependency detected: ${configId}`);
      }

      visiting.add(configId);
      
      const config = configMap.get(configId);
      if (config?.dependencies) {
        for (const depId of config.dependencies) {
          if (configMap.has(depId)) {
            visit(depId);
          }
        }
      }

      visiting.delete(configId);
      visited.add(configId);
      
      if (config) {
        result.push(config);
      }
    };

    for (const config of configs) {
      visit(config.id);
    }

    return result;
  }

  private updateTUI(): void {
    const containers = Array.from(this.containerManager.getAllContainers().entries()).map(([id, state]) => {
      const config = this.containers.get(id);
      return {
        id,
        name: config?.name || id,
        image: `${config?.image}:${config?.tag || "latest"}`,
        status: state.status as any,
        ports: state.ports,
        health: state.health,
        logs: [],
      };
    });

    tui.instance?.updateContainers(containers);
  }

  // Getters
  getContainer(id: string): ContainerState | undefined {
    return this.containerManager.getContainer(id);
  }

  getAllContainers(): Map<string, ContainerState> {
    return this.containerManager.getAllContainers();
  }

  isRunning(id: string): boolean {
    return this.containerManager.isRunning(id);
  }

  getRunningCount(): number {
    return this.containerManager.getRunningCount();
  }

  isShuttingDown(): boolean {
    return this.shutdownInProgress;
  }

  getNetworks(): string[] {
    return Array.from(this.networks);
  }

  getVolumes(): string[] {
    return Array.from(this.volumes);
  }
}