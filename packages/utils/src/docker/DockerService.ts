import Docker from "dockerode";
import * as fs from "fs";
import { Duplex } from "node:stream";
import * as path from "path";
import * as tar from "tar-fs";
import { logger } from "../logger";
import { type DockerServiceConfig } from "./types";
import { getServiceColor } from "./utils";

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
  #logger: typeof logger;

  constructor(serviceName: string, config: DockerServiceConfig, dockerInstance: Docker, networkName: string) {
    this.serviceName = serviceName;
    this.config = config;
    this.containerName = config.containerName;
    this.#docker = dockerInstance;
    this.#networkName = networkName;
    const colorizer = process.stdout.isTTY ? getServiceColor(this.serviceName) : null;
    this.#coloredPrefix = colorizer ? colorizer(this.serviceName) : this.serviceName;
    this.#logger = logger.withTag(this.#coloredPrefix);
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
      const stream = await this.#docker.pull(this.config.image, {});
      await new Promise<void>((resolve, reject) => {
        this.#docker.modem.followProgress(stream, (err: Error | null) => (err ? reject(err) : resolve()));
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
    const tarStream = tar.pack(this.config.build.context);
    const dockerfilePath = path.join(this.config.build.context, this.config.build.dockerfile);
    if (!fs.existsSync(dockerfilePath)) {
      throw new Error(`Dockerfile not found at ${dockerfilePath}`);
    }
    try {
      const stream = await this.#docker.buildImage(tarStream, {
        t: this.config.image,
        dockerfile: this.config.build.dockerfile,
        q: false,
      });
      await new Promise<void>((resolve, reject) => {
        this.#docker.modem.followProgress(
          stream,
          (err: Error | null, res: any[] | null) => {
            if (err) return reject(err);
            if (res && res.length > 0) {
              const lastMessage = res[res.length - 1];
              if (lastMessage?.errorDetail) return reject(new Error(lastMessage.errorDetail.message));
            }
            resolve();
          },
          (event: any) => {
            if (event.stream) process.stdout.write(event.stream);
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
      portBindings[`${p.target}/${p.protocol || "tcp"}`] = [{ HostPort: String(p.published) }];
    });
    return portBindings;
  }

  async start(): Promise<void> {
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
      this.#logger.log(`Existing container '${this.containerName}' removed.`);
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
      Env: Array.isArray(this.config.environment)
        ? this.config.environment
        : Object.entries(this.config.environment || {}).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: {},
      Labels: this.config.labels,
      HostConfig: {
        RestartPolicy: restartPolicy,
        PortBindings: this.#parsePorts(),
        Binds: this.config.volumes,
        NetworkMode: this.#networkName,
        Ulimits: this.config.ulimits,
      },
      NetworkingConfig: { EndpointsConfig: { [this.#networkName]: {} } },
      StopSignal: this.config.stopSignal,
      StopTimeout: this.config.stopGracePeriod,
      Healthcheck: this.config.healthCheck,
      platform: this.config.platform,
    };
    if (this.config.expose) {
      this.config.expose.forEach((p) => {
        createOptions.ExposedPorts![`${p}/tcp`] = {};
      });
    }
    try {
      this.#logger.start(`Creating container '${this.containerName}' with image '${this.config.image}'...`);
      const container = await this.#docker.createContainer(createOptions);
      this.#containerId = container.id;
      this.#logger.log(`Container '${this.containerName}' (ID: ${this.#containerId}) created. Starting...`);
      await container.start();
      this.#logger.log(`Service started (Container: ${this.containerName}).`);
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
        this.#logger.log(`Container '${containerRef}' not found for stopping.`);
        return;
      }
      this.#logger.log(`Stopping container '${this.containerName}' (ID: ${inspectInfo.Id})...`);
      await container.stop({ t: this.config.stopGracePeriod || 10 });
      this.#logger.log(`Container '${this.containerName}' stopped.`);
    } catch (error: any) {
      if (error.statusCode === 304) {
        this.#logger.log(`Container '${this.containerName}' was already stopped.`);
      } else if (error.statusCode === 404) {
        this.#logger.log(`Container '${containerRef}' not found during stop.`);
      } else {
        this.#logger.warn(`Error stopping container '${this.containerName}':`, error.message || error);
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
      return data.State.Health?.Status === "healthy";
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.#logger.error(`Error checking health for container '${containerRef}':`, error.message || error);
      }
      return false;
    }
  }

  async waitForHealthy(timeoutMs = 120000, intervalMs = 1000): Promise<void> {
    if (!this.config.healthCheck) {
      this.#logger.log(`No health check defined. Assuming healthy.`);
      return;
    }
    this.#logger.log(
      `Waiting for container '${this.containerName}' to become healthy (timeout: ${timeoutMs}ms, interval: ${intervalMs}ms)...`,
    );
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        if (await this.isHealthy()) {
          this.#logger.log(`Container '${this.containerName}' is healthy.`);
          this.healthCheckFailed = false;
          return;
        }
      } catch (error: any) {
        this.#logger.warn(`Health check attempt failed for '${this.containerName}': ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    this.healthCheckFailed = true;
    throw new Error(`Timeout waiting for container '${this.containerName}' to become healthy.`);
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
      if (typeof this.#logStream.destroy === "function") {
        this.#logStream.destroy();
      } else if (typeof (this.#logStream as any).end === "function") {
        (this.#logStream as any).end();
      }
      this.#logStream = null;
    }
  }
}
