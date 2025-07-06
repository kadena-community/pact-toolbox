/**
 * Chainweb DevNet network implementation
 */

import type { DevNetworkConfig } from "@pact-toolbox/config";
import type { Logger } from "@pact-toolbox/node-utils";
import type { PactToolboxClient } from "@pact-toolbox/deployer";
import type { DevNetServiceDefinition, NetworkApi, NetworkStartOptions } from "../types";

import { ContainerOrchestrator } from "@pact-toolbox/docker";
import { rm } from "node:fs/promises";
import { join } from "pathe";
import { ensureDir, logger as defaultLogger, writeFile } from "@pact-toolbox/node-utils";
import { getUuid, isChainWebAtHeight, isChainWebNodeOk, pollFn } from "@pact-toolbox/utils";
import { DEVNET_CONFIGS_DIR, DEVNET_PUBLIC_PORT, MINIMAL_CLUSTER_ID, MINIMAL_NETWORK_NAME } from "../config/constants";
import {
  CHAINWEB_NODE_COMMON_YAML_CONTENT_TPL,
  CHAINWEB_NODE_LOGGING_YAML_CONTENT_TPL,
  createNginxApiConfigContent,
} from "../config/fileTemplates";
import { createMinimalDevNet } from "../presets/minimal";
import { ensureCertificates } from "../utils";

/**
 * Chainweb DevNet network implementation
 */
export class DevNetNetwork implements NetworkApi {
  readonly id: string = getUuid();

  private orchestrator: ContainerOrchestrator;
  private config: DevNetworkConfig;
  private client: PactToolboxClient;
  private logger: Logger;
  private definition: DevNetServiceDefinition;
  private _statelessPort?: number;

  constructor(config: DevNetworkConfig, client: PactToolboxClient, logger: Logger = defaultLogger) {
    this.config = config;
    this.client = client;
    this.logger = logger;

    // Validate port
    const port = this.getPort();
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${port}`);
    }

    // Create devnet definition
    this.definition = createMinimalDevNet({
      clusterId: MINIMAL_CLUSTER_ID,
      networkName: MINIMAL_NETWORK_NAME,
      port,
      miningConfig: config.miningConfig,
    });

    this.orchestrator = new ContainerOrchestrator({
      networkName: this.definition.networkName,
      volumes: this.definition.volumes,
      logger: this.logger,
    });
  }

  async start(options?: NetworkStartOptions): Promise<void> {
    const { detached = true, stateless = false } = options || {};

    this.logger.info("Starting DevNet...");

    // Update for stateless mode with unique configuration
    if (stateless) {
      // Generate unique port for stateless mode to avoid conflicts
      const basePort = this.config.containerConfig?.port ?? DEVNET_PUBLIC_PORT;
      const randomOffset = Math.floor(Math.random() * 1000);
      const uniquePort = basePort + randomOffset;
      this._statelessPort = uniquePort;

      this.definition = createMinimalDevNet({
        clusterId: `devnet-${this.id}`,
        networkName: `devnet-${this.id}-network`,
        port: uniquePort,
        persistDb: false,
        miningConfig: this.config.miningConfig,
      });

      // Update orchestrator with new network name
      this.orchestrator = new ContainerOrchestrator({
        networkName: this.definition.networkName,
        volumes: [], // No volumes in stateless mode
        logger: this.logger,
      });
    }

    // Setup configuration files
    await this.setupArtifacts();

    // Start services
    const services = Object.values(this.definition.services);
    await this.orchestrator.startServices(services);

    // Wait for network to be ready
    await this.waitForReady();

    // Stream logs if not detached
    if (!detached) {
      this.orchestrator.streamAllLogs();
    }

    this.logger.success(`DevNet ready at ${this.getRpcUrl()}`);
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping DevNet...");
    await this.orchestrator.stopAllServices();

    // Cleanup config files
    try {
      await rm(DEVNET_CONFIGS_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Reset stateless port
    this._statelessPort = undefined;
  }

  async restart(options?: NetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await isChainWebNodeOk(this.getRpcUrl());
    } catch {
      return false;
    }
  }

  getPort(): number {
    // Return the stateless port if it was set during start
    if (this._statelessPort !== undefined) {
      return this._statelessPort;
    }
    return this.config.containerConfig?.port ?? DEVNET_PUBLIC_PORT;
  }

  getRpcUrl(): string {
    return `http://localhost:${this.getPort()}`;
  }

  hasOnDemandMining(): boolean {
    return this.config.containerConfig?.onDemandMining ?? true;
  }

  getMiningUrl(): string | null {
    return this.hasOnDemandMining() ? this.getRpcUrl() : null;
  }

  private async setupArtifacts(): Promise<void> {
    await ensureDir(DEVNET_CONFIGS_DIR);

    // Generate certificates
    await ensureCertificates(
      join(DEVNET_CONFIGS_DIR, "devnet-bootstrap-node.cert.pem"),
      join(DEVNET_CONFIGS_DIR, "devnet-bootstrap-node.key.pem"),
    );

    // Write config files
    await writeFile(join(DEVNET_CONFIGS_DIR, "chainweb-node.common.yaml"), CHAINWEB_NODE_COMMON_YAML_CONTENT_TPL);

    await writeFile(join(DEVNET_CONFIGS_DIR, "chainweb-node.logging.yaml"), CHAINWEB_NODE_LOGGING_YAML_CONTENT_TPL);

    const nginxConfig = createNginxApiConfigContent({
      enableMiningTrigger: this.hasOnDemandMining(),
    });
    await writeFile(join(DEVNET_CONFIGS_DIR, "nginx.api.minimal.conf"), nginxConfig);
  }

  private async waitForReady(): Promise<void> {
    // Wait for node to be accessible
    await pollFn(() => isChainWebNodeOk(this.getRpcUrl()), {
      timeout: 100000,
      interval: 1000,
    });

    // Wait for chain to reach minimum height
    await pollFn(() => isChainWebAtHeight(20, this.getRpcUrl()), {
      timeout: 100000,
      interval: 1000,
    });
  }
}
