import { existsSync, type Logger } from "@pact-toolbox/node-utils";
import Docker from "dockerode";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { Duplex } from "node:stream";
import * as tar from "tar-fs";
import {
  type DockerServiceConfig,
  type VolumeConfig,
  type NetworkAttachConfig,
  type ServiceState,
  ServiceStatus,
} from "./types";
import { getServiceColor } from "./utils";
import { applyResourceLimits, validateResourceLimits } from "./resource-limits";

interface DockerServiceOptions {
  serviceName?: string;
  networkName: string;
  docker: Docker;
  logger: Logger;
}

export class DockerService {
  public readonly serviceName: string;
  public readonly config: DockerServiceConfig;
  public readonly containerName: string;
  public healthCheckFailed: boolean = false;
  #docker: Docker;
  #networkName: string;
  #containerId?: string;
  #logStream: Duplex | null = null;
  #coloredPrefix: string;
  #logger: Logger;

  constructor(config: DockerServiceConfig, options: DockerServiceOptions) {
    this.serviceName = options.serviceName || config.containerName;
    
    // Apply default resource limits
    this.config = applyResourceLimits(config);
    
    // Validate resource limits
    try {
      validateResourceLimits(this.config);
    } catch (error) {
      options.logger.warn(`Resource limit validation warning for ${config.containerName}: ${error}`);
    }
    
    this.containerName = config.containerName;
    this.#docker = options.docker;
    this.#networkName = options.networkName;
    const colorizer = process.stdout.isTTY ? getServiceColor(this.serviceName) : null;
    this.#coloredPrefix = colorizer ? colorizer(this.serviceName) : this.serviceName;
    this.#logger = options.logger.withTag(this.#coloredPrefix);
  }

  async #pullImage(): Promise<void> {
    if (!this.config.image) return;
    try {
      const image = this.#docker.getImage(this.config.image);
      await image.inspect();
      return;
    } catch (error: any) {
      if (error.statusCode !== 404) throw error;
    }
    this.#logger.start(`Pulling image '${this.config.image}'...`);
    try {
      const stream = await this.#docker.pull(this.config.image, {
        platform: this.config.platform,
      });
      await new Promise<void>((resolve, reject) => {
        this.#docker.modem.followProgress(
          stream,
          (err: Error | null) => (err ? reject(err) : resolve()),
          (event: any) => {
            if (event.status && event.progress) {
              this.#logger.debug(`${event.status}: ${event.progress}`);
            }
          },
        );
      });
      this.#logger.success(`Image '${this.config.image}' pulled successfully.`);
    } catch (error) {
      this.#logger.error(`Error pulling image '${this.config.image}':`, error);
      throw error;
    }
  }

  async #buildImage(): Promise<void> {
    if (!this.config.build || !this.config.image) return;
    this.#logger.start(`Building image '${this.config.image}' from context '${this.config.build.context}'...`);

    const buildConfig = this.config.build;
    const dockerfilePath = join(buildConfig.context, buildConfig.dockerfile || "Dockerfile");

    if (!existsSync(dockerfilePath)) {
      throw new Error(`Dockerfile not found at ${dockerfilePath}`);
    }

    const tarStream = tar.pack(buildConfig.context, {
      ignore: (name) => {
        // Basic .dockerignore functionality
        return name.includes("node_modules") || name.includes(".git");
      },
    });

    try {
      const buildOptions: any = {
        t: this.config.image,
        dockerfile: buildConfig.dockerfile || "Dockerfile",
        q: false,
        pull: buildConfig.pull,
        platform: this.config.platform,
        target: buildConfig.target,
        networkmode: buildConfig.network,
        shmsize: buildConfig.shm_size ? this.#parseMemory(buildConfig.shm_size) : undefined,
      };

      // Add build args
      if (buildConfig.args) {
        buildOptions.buildargs = buildConfig.args;
      }

      // Add labels
      if (buildConfig.labels) {
        buildOptions.labels = buildConfig.labels;
      }

      // Add cache options
      if (buildConfig.cache_from) {
        buildOptions.cachefrom = buildConfig.cache_from;
      }

      const buildStream = this.#docker.buildImage(tarStream as any, buildOptions) as unknown as NodeJS.ReadableStream;
      await new Promise<void>((resolve, reject) => {
        this.#docker.modem.followProgress(
          buildStream,
          (err: Error | null, res: any[] | null) => {
            if (err) return reject(err);
            if (res && res.length > 0) {
              const lastMessage = res[res.length - 1];
              if (lastMessage?.errorDetail) {
                return reject(new Error(lastMessage.errorDetail.message));
              }
            }
            resolve();
          },
          (event: any) => {
            if (event.stream) {
              this.#logger.debug(event.stream.trim());
            } else if (event.status) {
              this.#logger.debug(`${event.status}: ${event.progress || ""}`);
            }
          },
        );
      });

      this.#logger.success(`Image '${this.config.image}' built successfully.`);
    } catch (error) {
      this.#logger.error(`Error building image '${this.config.image}':`, error);
      throw error;
    }
  }

  async prepareImage(): Promise<void> {
    if (this.config.build && this.config.image) {
      await this.#buildImage();
    } else if (this.config.image) {
      await this.#pullImage();
    }
  }

  #parsePorts(): Docker.PortMap | undefined {
    if (!this.config.ports) return undefined;
    const portBindings: Docker.PortMap = {};
    this.config.ports.forEach((p) => {
      const protocol = p.protocol || "tcp";
      const hostPort = String(p.published);
      const containerPort = `${p.target}/${protocol}`;

      portBindings[containerPort] = [
        {
          HostPort: hostPort,
          HostIp: p.mode === "host" ? "0.0.0.0" : undefined,
        },
      ];
    });
    return portBindings;
  }

  #parseVolumes(): string[] | undefined {
    if (!this.config.volumes) return undefined;

    const volumes: string[] = [];

    for (const volume of this.config.volumes) {
      if (typeof volume === "string") {
        volumes.push(volume);
      } else {
        // Handle VolumeConfig objects
        const volumeConfig = volume as VolumeConfig;
        let volumeString = "";

        if (volumeConfig.type === "bind" || volumeConfig.type === "volume") {
          volumeString = `${volumeConfig.source}:${volumeConfig.target}`;
          if (volumeConfig.readOnly) {
            volumeString += ":ro";
          }
          if (volumeConfig.bind?.propagation) {
            volumeString += `:${volumeConfig.bind.propagation}`;
          }
        } else if (volumeConfig.type === "tmpfs") {
          // tmpfs volumes are handled differently in Docker API
          continue;
        }

        if (volumeString) {
          volumes.push(volumeString);
        }
      }
    }

    return volumes.length > 0 ? volumes : undefined;
  }

  #parseTmpfs(): { [path: string]: string } | undefined {
    if (!this.config.tmpfs && !this.config.volumes) return undefined;

    const tmpfs: { [path: string]: string } = {};

    // Handle tmpfs from config.tmpfs
    if (this.config.tmpfs) {
      const tmpfsList = Array.isArray(this.config.tmpfs) ? this.config.tmpfs : [this.config.tmpfs];
      tmpfsList.forEach((path) => {
        tmpfs[path] = "";
      });
    }

    // Handle tmpfs from volumes
    if (this.config.volumes) {
      for (const volume of this.config.volumes) {
        if (typeof volume === "object" && (volume as VolumeConfig).type === "tmpfs") {
          const volumeConfig = volume as VolumeConfig;
          let options = "";
          if (volumeConfig.tmpfs?.size) {
            options += `size=${volumeConfig.tmpfs.size}`;
          }
          if (volumeConfig.tmpfs?.mode) {
            options += options ? `,mode=${volumeConfig.tmpfs.mode}` : `mode=${volumeConfig.tmpfs.mode}`;
          }
          tmpfs[volumeConfig.target] = options;
        }
      }
    }

    return Object.keys(tmpfs).length > 0 ? tmpfs : undefined;
  }

  #parseEnvironment(): string[] | undefined {
    const env: string[] = [];

    // Handle environment from config.environment
    if (this.config.environment) {
      if (Array.isArray(this.config.environment)) {
        env.push(...this.config.environment);
      } else {
        env.push(...Object.entries(this.config.environment).map(([k, v]) => `${k}=${v}`));
      }
    }

    // Handle environment from env files
    if (this.config.envFile) {
      const envFiles = Array.isArray(this.config.envFile) ? this.config.envFile : [this.config.envFile];
      for (const envFile of envFiles) {
        try {
          if (existsSync(envFile)) {
            const content = readFileSync(envFile, "utf-8");
            const lines = content.split("\n").filter((line) => line.trim() && !line.startsWith("#"));
            env.push(...lines);
          }
        } catch (error) {
          this.#logger.warn(`Failed to read env file ${envFile}:`, error);
        }
      }
    }

    return env.length > 0 ? env : undefined;
  }

  #parseMemory(memory?: string): number | undefined {
    if (!memory) return undefined;

    const units: { [key: string]: number } = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = memory.toLowerCase().match(/^(\d+)([bkmg])?$/);
    if (!match) return undefined;

    const value = parseInt(match[1]);
    const unit = match[2] || "b";

    return value * units[unit];
  }

  #parseNetworkingConfig(): any {
    if (!this.config.networks) {
      return { EndpointsConfig: { [this.#networkName]: {} } };
    }

    const endpointsConfig: any = {};

    if (Array.isArray(this.config.networks)) {
      // Simple array of network names
      this.config.networks.forEach((networkName) => {
        endpointsConfig[networkName] = {};
      });
      // Also include the default network
      endpointsConfig[this.#networkName] = {};
    } else {
      // Object with network configurations
      Object.entries(this.config.networks).forEach(([networkName, config]) => {
        const networkConfig = config as NetworkAttachConfig;
        endpointsConfig[networkName] = {
          Aliases: networkConfig.aliases,
          IPAMConfig: {
            IPv4Address: networkConfig.ipv4Address,
            IPv6Address: networkConfig.ipv6Address,
          },
          Links: [],
          NetworkID: undefined, // Will be resolved by Docker
        };
      });
    }

    return { EndpointsConfig: endpointsConfig };
  }

  async start(): Promise<void> {
    // Log resource limits
    const resourceInfo = [];
    if (this.config.memLimit) resourceInfo.push(`Memory: ${this.config.memLimit}`);
    if (this.config.cpus) resourceInfo.push(`CPUs: ${this.config.cpus}`);
    if (resourceInfo.length > 0) {
      this.#logger.debug(`Resource limits: ${resourceInfo.join(", ")}`);
    }
    
    this.#logger.start(`Starting service instance...`);
    await this.prepareImage();
    try {
      const existingContainer = this.#docker.getContainer(this.containerName);
      const inspectInfo = await existingContainer.inspect();
      this.#logger.warn(
        `Container '${this.containerName}' already exists (State: ${inspectInfo.State.Status}). Attempting to remove it.`,
      );
      if (inspectInfo.State.Running) {
        await existingContainer
          .stop({ t: this.config.stopGracePeriod || 10 })
          .catch((err: Error) => this.#logger.warn(`Could not stop existing container: ${err.message}`));
      }
      await existingContainer
        .remove()
        .catch((err: Error) => this.#logger.warn(`Could not remove existing container: ${err.message}`));
      this.#logger.debug(`Existing container '${this.containerName}' removed.`);
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.#logger.error(`Error checking for existing container:`, error.message || error);
        throw error;
      }
    }

    let restartPolicy: Docker.HostRestartPolicy | undefined = undefined;
    const deployRestartPolicy = this.config.deploy?.restartPolicy;
    const topLevelRestart = this.config.restart;

    if (deployRestartPolicy) {
      let dockerodeConditionName: Docker.HostRestartPolicy["Name"] = "no"; // Default to 'no'
      const composeCondition = deployRestartPolicy.condition;

      if (composeCondition === "none") {
        dockerodeConditionName = "no";
      } else if (
        composeCondition === "on-failure" ||
        composeCondition === "unless-stopped" ||
        composeCondition === "always"
      ) {
        dockerodeConditionName = composeCondition;
      } else if (composeCondition) {
        this.#logger.warn(`Unsupported deploy.restart_policy.condition: '${composeCondition}'. Defaulting to 'no'.`);
      }

      restartPolicy = {
        Name: dockerodeConditionName,
        MaximumRetryCount: deployRestartPolicy.maxAttempts,
      };
    } else if (topLevelRestart) {
      if (
        topLevelRestart === "on-failure" ||
        topLevelRestart === "unless-stopped" ||
        topLevelRestart === "always" ||
        topLevelRestart === "no"
      ) {
        restartPolicy = { Name: topLevelRestart };
      } else {
        this.#logger.warn(`Unsupported top-level restart value: '${topLevelRestart}'. Defaulting to 'no'.`);
        restartPolicy = { Name: "no" };
      }
    }

    const createOptions: Docker.ContainerCreateOptions = {
      name: this.containerName,
      Image: this.config.image!,
      Cmd: this.config.command,
      Entrypoint: typeof this.config.entrypoint === "string" ? [this.config.entrypoint] : this.config.entrypoint,
      Env: this.#parseEnvironment(),
      ExposedPorts: {},
      Labels: this.config.labels,
      User: this.config.user,
      WorkingDir: this.config.workingDir,
      Hostname: this.config.hostname,
      Domainname: this.config.domainName,
      MacAddress: this.config.macAddress,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      HostConfig: {
        RestartPolicy: restartPolicy,
        PortBindings: this.#parsePorts(),
        Binds: this.#parseVolumes(),
        NetworkMode: this.#networkName,
        Ulimits: this.config.ulimits,
        Privileged: this.config.privileged,
        CapAdd: this.config.capAdd,
        CapDrop: this.config.capDrop,
        Devices: this.config.devices?.map((device) => ({
          PathOnHost: device,
          PathInContainer: device,
          CgroupPermissions: "rwm",
        })),
        Dns: Array.isArray(this.config.dns) ? this.config.dns : this.config.dns ? [this.config.dns] : undefined,
        DnsSearch: Array.isArray(this.config.dnsSearch)
          ? this.config.dnsSearch
          : this.config.dnsSearch
            ? [this.config.dnsSearch]
            : undefined,
        DnsOptions: this.config.dnsOpt,
        ExtraHosts: this.config.extraHosts,
        IpcMode: this.config.ipc,
        PidMode: this.config.pid,
        // CgroupnsMode: this.config.cgroupns,
        Init: this.config.init,
        Isolation: this.config.isolation,
        Memory: this.#parseMemory(this.config.memLimit),
        MemoryReservation: this.#parseMemory(this.config.memReservation),
        MemorySwap: this.#parseMemory(this.config.memSwapLimit),
        MemorySwappiness: this.config.memSwappiness,
        OomKillDisable: this.config.oomKillDisable,
        OomScoreAdj: this.config.oomScoreAdj,
        NanoCpus: this.config.cpus ? this.config.cpus * 1e9 : undefined, // Convert CPU count to nano CPUs
        CpuShares: this.config.cpuShares,
        CpuQuota: this.config.cpuQuota,
        CpuPeriod: this.config.cpuPeriod,
        CpusetCpus: this.config.cpusetCpus,
        CpusetMems: this.config.cpusetMems,
        BlkioWeight: this.config.blkioWeight,
        BlkioWeightDevice: undefined, // Not directly supported in current config
        BlkioDeviceReadBps: this.config.deviceReadBps?.map((d) => ({ Path: d.path, Rate: parseInt(d.rate) })),
        BlkioDeviceWriteBps: this.config.deviceWriteBps?.map((d) => ({ Path: d.path, Rate: parseInt(d.rate) })),
        BlkioDeviceReadIOps: this.config.deviceReadIops?.map((d) => ({ Path: d.path, Rate: d.rate })),
        BlkioDeviceWriteIOps: this.config.deviceWriteIops?.map((d) => ({ Path: d.path, Rate: d.rate })),
        LogConfig: this.config.logging
          ? {
              Type: this.config.logging.driver || "json-file",
              Config: this.config.logging.options || {},
            }
          : undefined,
        Tmpfs: this.#parseTmpfs(),
      },
      NetworkingConfig: this.#parseNetworkingConfig(),
      StopSignal: this.config.stopSignal,
      StopTimeout: this.config.stopGracePeriod,
      Healthcheck: this.config.healthCheck,
      platform: this.config.platform,
    };
    // Handle exposed ports
    if (this.config.expose) {
      this.config.expose.forEach((p) => {
        createOptions.ExposedPorts![`${p}/tcp`] = {};
      });
    }

    // Also expose ports from port bindings
    if (this.config.ports) {
      this.config.ports.forEach((p) => {
        const protocol = p.protocol || "tcp";
        createOptions.ExposedPorts![`${p.target}/${protocol}`] = {};
      });
    }

    // Handle CPU limits from deploy.resources
    if (this.config.deploy?.resources?.limits?.cpus) {
      const cpus = parseFloat(this.config.deploy.resources.limits.cpus);
      createOptions.HostConfig!.CpuQuota = Math.floor(cpus * 100000);
      createOptions.HostConfig!.CpuPeriod = 100000;
    }

    // Handle memory limits from deploy.resources
    if (this.config.deploy?.resources?.limits?.memory) {
      createOptions.HostConfig!.Memory = this.#parseMemory(this.config.deploy.resources.limits.memory);
    }
    try {
      this.#logger.start(`Creating container '${this.containerName}' with image '${this.config.image}'...`);
      const container = await this.#docker.createContainer(createOptions);
      this.#containerId = container.id;
      this.#logger.debug(`Container '${this.containerName}' (ID: ${this.#containerId}) created. Starting...`);
      await container.start();
      this.#logger.debug(`Service started (Container: ${this.containerName}).`);
    } catch (error: any) {
      this.#logger.error(
        `Error starting service:`,
        error.message || error,
        error.json ? JSON.stringify(error.json) : "",
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      this.#logger.warn(`No container ID or name to stop.`);
      return;
    }

    try {
      const container = this.#docker.getContainer(containerRef);
      const inspectInfo = await container.inspect().catch(() => null);

      if (!inspectInfo) {
        this.#logger.debug(`Container '${containerRef}' not found for stopping.`);
        return;
      }

      if (inspectInfo.State.Status !== "running") {
        this.#logger.log(`Container '${this.containerName}' is not running (Status: ${inspectInfo.State.Status}).`);
        return;
      }

      this.#logger.log(`Stopping container '${this.containerName}' (ID: ${inspectInfo.Id})...`);

      // Send stop signal with custom grace period
      const stopTimeout = this.config.stopGracePeriod || 10;
      const stopSignal = this.config.stopSignal || "SIGTERM";

      try {
        // First try graceful stop
        await container.stop({ t: stopTimeout, signal: stopSignal });
        this.#logger.log(`Container '${this.containerName}' stopped gracefully.`);
      } catch (stopError: any) {
        if (stopError.statusCode === 304) {
          this.#logger.log(`Container '${this.containerName}' was already stopped.`);
        } else {
          // If graceful stop fails, try force kill
          this.#logger.warn(`Graceful stop failed, attempting force kill...`);
          await container.kill();
          this.#logger.log(`Container '${this.containerName}' force killed.`);
        }
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.#logger.log(`Container '${containerRef}' not found during stop.`);
      } else {
        this.#logger.warn(`Error stopping container '${this.containerName}':`, error.message || error);
        throw error;
      }
    }
  }

  async remove(): Promise<void> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      this.#logger.warn(`No container ID or name to remove.`);
      return;
    }
    try {
      const container = this.#docker.getContainer(containerRef);
      await container.inspect().catch((err: any) => {
        if (err.statusCode === 404)
          this.#logger.log(`Container '${containerRef}' not found before removal, attempting removal anyway.`);
        else throw err;
      });
      this.#logger.log(`Removing container '${this.containerName}'...`);
      await container.remove({ force: true });
      this.#logger.log(`Container '${this.containerName}' removed.`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        this.#logger.log(`Container '${containerRef}' was already removed.`);
      } else {
        this.#logger.warn(`Error removing container '${this.containerName}':`, error.message || error);
      }
    }
  }

  async isHealthy(): Promise<boolean> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      return false;
    }

    try {
      const data = await this.#docker.getContainer(containerRef).inspect();

      // If no health check is defined, consider it healthy if running
      if (!data.State.Health) {
        return data.State.Running;
      }

      return data.State.Health.Status === "healthy";
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.#logger.error(`Error checking health for container '${containerRef}':`, error.message || error);
      }
      return false;
    }
  }

  async getState(): Promise<ServiceState> {
    const containerRef = this.#containerId || this.containerName;

    try {
      const data = await this.#docker.getContainer(containerRef).inspect();

      let status: ServiceStatus = "stopped";
      if (data.State.Running) {
        status = "running";
      } else if (data.State.Status === "created") {
        status = "creating";
      } else if (data.State.Status === "exited") {
        status = "stopped";
      }

      // Override with health status if available
      if (data.State.Health?.Status === "healthy") {
        status = "healthy";
      } else if (data.State.Health?.Status === "unhealthy") {
        status = "unhealthy";
      }

      const state: ServiceState = {
        id: this.serviceName,
        status,
        containerId: data.Id,
        startTime: data.State.StartedAt ? new Date(data.State.StartedAt) : undefined,
        endTime: data.State.FinishedAt ? new Date(data.State.FinishedAt) : undefined,
        restartCount: data.RestartCount || 0,
        health: data.State.Health?.Status as any,
        ports: this.config.ports?.map((p) => `${p.published}:${p.target}/${p.protocol || "tcp"}`) || [],
      };

      return state;
    } catch (error: any) {
      return {
        id: this.serviceName,
        status: "failed",
        restartCount: 0,
        error: error,
        ports: [],
      };
    }
  }

  async waitForHealthy(timeoutMs = 120000, intervalMs = 1000): Promise<void> {
    if (!this.config.healthCheck) {
      this.#logger.debug(`No health check defined for '${this.containerName}'. Assuming healthy.`);
      return;
    }

    this.#logger.log(
      `Waiting for container '${this.containerName}' to become healthy (timeout: ${timeoutMs}ms, interval: ${intervalMs}ms)...`,
    );

    const startTime = Date.now();
    let lastStatus = "";

    while (Date.now() - startTime < timeoutMs) {
      try {
        const containerRef = this.#containerId || this.containerName;
        const data = await this.#docker.getContainer(containerRef).inspect();

        if (!data.State.Running) {
          throw new Error(`Container '${this.containerName}' is not running (Status: ${data.State.Status})`);
        }

        const healthStatus = data.State.Health?.Status;

        if (healthStatus !== lastStatus) {
          this.#logger.debug(`Health status for '${this.containerName}': ${healthStatus}`);
          lastStatus = healthStatus || "";
        }

        if (healthStatus === "healthy") {
          this.#logger.debug(`Container '${this.containerName}' is healthy.`);
          this.healthCheckFailed = false;
          return;
        }

        if (healthStatus === "unhealthy") {
          const lastLog = data.State.Health?.Log?.[data.State.Health.Log.length - 1];
          const errorMsg = lastLog ? ` Last health check output: ${lastLog.Output}` : "";
          throw new Error(`Container '${this.containerName}' became unhealthy.${errorMsg}`);
        }
      } catch (error: any) {
        if (error.statusCode === 404) {
          throw new Error(`Container '${this.containerName}' not found during health check`);
        }
        if (error.message.includes("unhealthy") || error.message.includes("not running")) {
          throw error;
        }
        this.#logger.warn(`Health check attempt failed for '${this.containerName}': ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    this.healthCheckFailed = true;
    throw new Error(`Timeout waiting for container '${this.containerName}' to become healthy after ${timeoutMs}ms.`);
  }

  async streamLogs(): Promise<void> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      this.#logger.warn(`No container ID or name to stream logs from.`);
      return;
    }

    try {
      const container = this.#docker.getContainer(containerRef);
      const inspectInfo = await container.inspect().catch(() => null);
      if (!inspectInfo || !inspectInfo.State.Running) {
        this.#logger.warn(`Container '${containerRef}' is not running. Cannot stream logs.`);
        return;
      }

      this.#logger.log(`Attaching to logs of container '${this.containerName}'...`);
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true,
      });

      this.#logStream = stream as Duplex;

      this.#logStream.on("data", (chunk) => {
        let logLine = chunk.toString("utf8");
        const potentiallyPrefixed = /^[^a-zA-Z0-9\s\p{P}]*(?=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/u;
        logLine = logLine.replace(potentiallyPrefixed, "");
        logLine = logLine.replace(/[^\x20-\x7E\n\r\t]/g, "");
        const trimmedMessage = logLine.trimEnd();

        if (trimmedMessage) {
          trimmedMessage.split("\n").forEach((line: string) => {
            if (line.trim()) {
              console.log(`${this.#coloredPrefix} ${line}`);
            }
          });
        }
      });

      this.#logStream.on("end", () => {
        this.#logger.log(`Log stream ended for container '${this.containerName}'.`);
        this.#logStream = null;
      });

      this.#logStream.on("error", (err) => {
        this.#logger.error(`Error in log stream for container '${this.containerName}':`, err);
        this.#logStream = null;
      });
    } catch (error: any) {
      this.#logger.error(`Error attaching to logs for container '${this.containerName}':`, error.message || error);
      this.#logStream = null;
    }
  }

  stopLogStream(): void {
    if (this.#logStream) {
      this.#logger.log(`Detaching from logs of container '${this.containerName}'.`);
      try {
        if (typeof this.#logStream.destroy === "function") {
          this.#logStream.destroy();
        } else if (typeof (this.#logStream as any).end === "function") {
          (this.#logStream as any).end();
        }
      } catch (error) {
        this.#logger.warn(`Error stopping log stream for '${this.containerName}':`, error);
      } finally {
        this.#logStream = null;
      }
    }
  }

  /**
   * Get container logs without streaming
   */
  async getLogs(tail: number = 100): Promise<string[]> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      return [];
    }

    try {
      const container = this.#docker.getContainer(containerRef);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      return logs
        .toString()
        .split("\n")
        .filter((line) => line.trim());
    } catch (error: any) {
      this.#logger.error(`Error getting logs for container '${containerRef}':`, error.message || error);
      return [];
    }
  }

  /**
   * Execute a command in the running container
   */
  async exec(command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerRef = this.#containerId || this.containerName;
    if (!containerRef) {
      throw new Error("No container to execute command in");
    }

    try {
      const container = this.#docker.getContainer(containerRef);
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      return new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";

        stream.on("data", (chunk: Buffer) => {
          const header = chunk.readUInt8(0);
          const data = chunk.slice(8).toString();

          if (header === 1) {
            stdout += data;
          } else if (header === 2) {
            stderr += data;
          }
        });

        stream.on("end", async () => {
          try {
            const inspectResult = await exec.inspect();
            resolve({
              stdout,
              stderr,
              exitCode: inspectResult.ExitCode || 0,
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.on("error", reject);
      });
    } catch (error: any) {
      this.#logger.error(`Error executing command in container '${containerRef}':`, error.message || error);
      throw error;
    }
  }
}
