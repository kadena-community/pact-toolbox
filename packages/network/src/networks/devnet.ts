import type { DevNetworkConfig } from "@pact-toolbox/config";
import {
  ContainerOrchestrator,
  didMakeBlocks,
  ensureDir,
  getUuid,
  isChainWebAtHeight,
  isChainWebNodeOk,
  logger,
  pollFn,
  writeFile,
  type DockerServiceConfig,
  type Logger,
  type Spinner,
} from "@pact-toolbox/utils";
import { rm } from "node:fs/promises";
import type { PactToolboxClient } from "@pact-toolbox/runtime";
import { join } from "pathe";
import { DEVNET_CONFIGS_DIR, DEVNET_PUBLIC_PORT, MINIMAL_CLUSTER_ID, MINIMAL_NETWORK_NAME } from "../config/constants";
import {
  CHAINWEB_NODE_COMMON_YAML_CONTENT_TPL,
  CHAINWEB_NODE_LOGGING_YAML_CONTENT_TPL,
  createNginxApiConfigContent,
} from "../config/fileTemplates";
import { createMinimalDevNet } from "../presets/minimal";
import type { DevNetServiceDefinition, ToolboxNetworkApi, ToolboxNetworkStartOptions } from "../types";
import { ensureCertificates } from "../utils";

interface LocalDevNetNetworkOptions {
  logger: Logger;
  activeProfiles?: string[];
  client: PactToolboxClient;
  spinner: Spinner;
}

export class LocalDevNetNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  #orchestrator: ContainerOrchestrator;
  #activeProfiles: string[];
  #isDetached: boolean = true;
  #definition: DevNetServiceDefinition;
  #networkConfig: DevNetworkConfig;
  #client: PactToolboxClient;
  #spinner: Spinner;
  #logger: Logger;

  constructor(networkConfig: DevNetworkConfig, options: LocalDevNetNetworkOptions) {
    this.#networkConfig = networkConfig;
    this.#client = options.client;
    this.#logger = options.logger;
    this.#spinner = options.spinner;
    this.#definition = createMinimalDevNet({
      clusterId: MINIMAL_CLUSTER_ID,
      networkName: MINIMAL_NETWORK_NAME,
      port: Number(this.getServicePort()),
      miningConfig: this.#networkConfig.miningConfig,
    });
    this.#orchestrator = new ContainerOrchestrator({
      networkName: this.#definition.networkName,
      volumes: this.#definition.volumes,
      logger: this.#logger,
      spinner: this.#spinner,
    });
    this.#activeProfiles = options.activeProfiles || [];
  }

  async #setupArtifacts(): Promise<void> {
    await ensureDir(DEVNET_CONFIGS_DIR);

    await ensureCertificates(
      join(DEVNET_CONFIGS_DIR, "devnet-bootstrap-node.cert.pem"),
      join(DEVNET_CONFIGS_DIR, "devnet-bootstrap-node.key.pem"),
    );

    await writeFile(join(DEVNET_CONFIGS_DIR, "chainweb-node.common.yaml"), CHAINWEB_NODE_COMMON_YAML_CONTENT_TPL);

    await writeFile(join(DEVNET_CONFIGS_DIR, "chainweb-node.logging.yaml"), CHAINWEB_NODE_LOGGING_YAML_CONTENT_TPL);

    const nginxConfigContent = createNginxApiConfigContent({
      enableMiningTrigger: this.hasOnDemandMining(),
    });

    await writeFile(join(DEVNET_CONFIGS_DIR, "nginx.api.minimal.conf"), nginxConfigContent);
  }

  #filterServicesByProfile(serviceConfigs: DockerServiceConfig[]): DockerServiceConfig[] {
    if (this.#activeProfiles.length === 0) {
      // If no profiles active, run services that have NO profile attribute.
      return serviceConfigs.filter(
        (config) => !config.profiles || config.profiles.length === 0,
      ) as unknown as DockerServiceConfig[];
    }

    // If profiles ARE specified, only run services matching those profiles.
    return serviceConfigs.filter(
      (config) => config.profiles && config.profiles.some((p: string) => this.#activeProfiles.includes(p)),
    );
  }

  async #ensureDevNetReadyState(): Promise<void> {
    try {
      await pollFn(() => isChainWebNodeOk(this.getNodeServiceUrl()), {
        timeout: 100000,
        interval: 1000,
      });
      this.#spinner.message("Devnet service node is accessible.");
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
              onDemandUrl: this.getMiningClientUrl(),
            }),
          {
            timeout: 100000,
            interval: 1000,
          },
        );
        this.#spinner.message("Initial blocks created for on-demand mining.");
      } catch (error) {
        logger.error("Could not make initial blocks for on-demand mining.", error);
        throw new Error("Could not make initial blocks for on-demand mining.");
      }
    }

    // Ensure Chainweb node reaches the target height
    try {
      await pollFn(() => isChainWebAtHeight(20, this.getNodeServiceUrl()), {
        timeout: 100000,
        interval: 1000,
      });
      this.#spinner.message("Chainweb node reached height 20.");
    } catch (error) {
      logger.error("Chainweb node did not reach height 20 within the expected time.", error);
      throw new Error("Chainweb node did not reach height 20 within the expected time.");
    }
  }

  async start(options?: ToolboxNetworkStartOptions): Promise<void> {
    this.#spinner.message("Starting devnet...");
    this.#client = options?.client ?? this.#client;
    const { isDetached = true, isStateless = false } = options || {};
    this.#isDetached = isDetached;

    // Modify container name if stateless
    if (isStateless) {
      this.#definition = createMinimalDevNet({
        networkName: `devnet-${this.id}-network`,
        port: Number(this.getServicePort()),
        persistDb: false,
        miningConfig: this.#networkConfig.miningConfig,
      });
    }

    this.#spinner.message("Setting up devnet artifacts...");
    await this.#setupArtifacts();
    const servicesToRun = this.#filterServicesByProfile(Object.values(this.#definition.services));

    if (servicesToRun.length === 0) {
      return;
    }
    this.#spinner.message("Starting devnet services...");
    await this.#orchestrator.startServices(servicesToRun);
    this.#spinner.message("Ensuring devnet is ready...");
    await this.#ensureDevNetReadyState();
    if (!this.#isDetached) {
      await this.#orchestrator.streamAllLogs();
    }
    this.#spinner.message("Devnet started.");
  }

  async stop(): Promise<void> {
    await this.#orchestrator.stopAllServices();
    if (!this.#isDetached) {
      this.#orchestrator.stopAllLogStreams();
    }
    try {
      await rm(DEVNET_CONFIGS_DIR, { recursive: true, force: true });
    } catch (e) {
      logger.warn(`Failed to remove generated files in ${DEVNET_CONFIGS_DIR}:`, e);
    }
  }

  async restart(options?: ToolboxNetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }

  getServicePort(): number {
    return this.#networkConfig.containerConfig?.port ?? DEVNET_PUBLIC_PORT;
  }

  hasOnDemandMining(): boolean {
    return this.#networkConfig.containerConfig?.onDemandMining ?? true;
  }

  getMiningClientUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  getNodeServiceUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  async isOk(): Promise<boolean> {
    return isChainWebNodeOk(this.getNodeServiceUrl());
  }
}
