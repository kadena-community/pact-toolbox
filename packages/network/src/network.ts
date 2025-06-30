/**
 * Main network management class for Pact Toolbox
 */

import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { Logger } from "@pact-toolbox/node-utils";
import type { NetworkApi, NetworkStartOptions } from "./types";

import {
  getDefaultNetworkConfig,
  isDevNetworkConfig,
  isLocalNetwork,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { deployPreludes, downloadAllPreludes } from "@pact-toolbox/prelude";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger as defaultLogger, cleanupOnExit } from "@pact-toolbox/node-utils";
import { getUuid } from "@pact-toolbox/utils";

import { DevNetNetwork } from "./networks/devnet";
import { PactServerNetwork } from "./networks/pactServer";

export interface NetworkOptions extends NetworkStartOptions {
  /** Network name from config (default: first network) */
  network?: string;
  /** Custom logger instance */
  logger?: Logger;
  /** Auto-start network on creation (default: true) */
  autoStart?: boolean;
  /** Log account details on start (default: false) */
  logAccounts?: boolean;
  /** Register cleanup handlers for graceful shutdown (default: true) */
  registerCleanup?: boolean;
}

/**
 * Main network class that manages Pact development networks
 */
export class PactToolboxNetwork implements NetworkApi {
  readonly id: string = getUuid();

  private network: NetworkApi;
  private config: NetworkConfig;
  private client: PactToolboxClient;
  private logger: Logger;
  private toolboxConfig: PactToolboxConfigObj;
  private cleanupRegistered = false;

  constructor(toolboxConfig: PactToolboxConfigObj, options: NetworkOptions = {}) {
    // Validate configuration
    if (!toolboxConfig?.networks || Object.keys(toolboxConfig.networks).length === 0) {
      throw new Error("No networks defined in configuration");
    }

    this.toolboxConfig = toolboxConfig;
    this.logger = options.logger ?? defaultLogger;

    // Get network configuration
    const networkConfig = getDefaultNetworkConfig(toolboxConfig, options.network);
    if (!networkConfig) {
      const available = Object.keys(toolboxConfig.networks).join(", ");
      throw new Error(`Network not found. Available: ${available}`);
    }

    // Only support local networks
    if (!isLocalNetwork(networkConfig)) {
      throw new Error(`Network '${networkConfig.name}' is not a local network`);
    }

    this.config = networkConfig;
    this.client = options.client ?? new PactToolboxClient(toolboxConfig);

    // Create appropriate network implementation
    if (isPactServerNetworkConfig(networkConfig)) {
      this.network = new PactServerNetwork(networkConfig, this.client, this.logger);
    } else if (isDevNetworkConfig(networkConfig)) {
      this.network = new DevNetNetwork(networkConfig, this.client, this.logger);
    } else {
      //@ts-expect-error Unsupported network type for '${networkConfig.name}'
      throw new Error(`Unsupported network type for '${networkConfig.name}'`);
    }

    // Register cleanup handler if requested (default: true)
    if (options.registerCleanup !== false) {
      this.registerCleanupHandler();
    }
  }

  // Implement NetworkApi
  async start(options?: NetworkStartOptions): Promise<void> {
    try {
      this.logger.info(`Starting network ${this.config.name}...`);

      // Handle preludes if configured
      if (this.toolboxConfig.downloadPreludes || this.toolboxConfig.deployPreludes) {
        const preludeConfig = {
          client: options?.client ?? this.client,
          contractsDir: this.toolboxConfig.contractsDir ?? "contracts",
          preludes: this.toolboxConfig.preludes ?? [],
        };

        if (this.toolboxConfig.downloadPreludes) {
          await downloadAllPreludes(preludeConfig);
        }

        // Start network before deploying preludes
        await this.network.start(options);

        if (this.toolboxConfig.deployPreludes) {
          await deployPreludes(preludeConfig);
        }
      } else {
        await this.network.start(options);
      }

      // Log accounts if requested
      if ((options as NetworkOptions)?.logAccounts) {
        this.logAccounts();
      }

      this.logger.success(`Network ${this.config.name} started at ${this.getRpcUrl()}`);
    } catch (error) {
      this.logger.error(`Failed to start network: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.debug(`Stopping network ${this.config.name}...`);

      // Stop with timeout to prevent hanging processes
      const stopPromise = this.network.stop();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("Network stop operation timed out")), 10000);
      });

      await Promise.race([stopPromise, timeoutPromise]);
      this.logger.debug(`Network ${this.config.name} stopped successfully`);
    } catch (error) {
      this.logger.error(`Error stopping network ${this.config.name}:`, error);
      throw error;
    }
  }

  async restart(options?: NetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }

  async isHealthy(): Promise<boolean> {
    return this.network.isHealthy();
  }

  getPort(): number {
    return this.network.getPort();
  }

  getRpcUrl(): string {
    return this.network.getRpcUrl();
  }

  hasOnDemandMining(): boolean {
    return this.network.hasOnDemandMining();
  }

  getMiningUrl(): string | null {
    return this.network.getMiningUrl();
  }

  // Additional helper methods
  getNetworkName(): string {
    return this.config.name ?? "unknown";
  }

  /**
   * Register cleanup handler for graceful shutdown
   */
  private registerCleanupHandler(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    cleanupOnExit(
      async () => {
        try {
          await this.stop();
        } catch (error) {
          this.logger.error(`Failed to cleanup network ${this.config.name}:`, error);
        }
      },
      {
        name: `network-${this.config.name}`,
        priority: 10, // High priority for network cleanup
        timeout: 15000, // Allow extra time for network cleanup
      },
    );
  }

  getNetworkConfig(): NetworkConfig {
    return this.config;
  }

  private logAccounts(): void {
    const accounts = this.config.keyPairs ?? [];
    if (accounts.length === 0) return;

    this.logger.log("\n📋 Network Accounts:");
    for (const account of accounts) {
      this.logger.log(`  Account: ${account.account}`);
      this.logger.log(`  Public:  ${account.publicKey}`);
      this.logger.log(`  Secret:  ${account.secretKey}`);
      this.logger.log("  --------------------------------");
    }
  }
}

/**
 * Create and optionally start a Pact network
 */
export async function createNetwork(
  config: PactToolboxConfigObj,
  options: NetworkOptions = {},
): Promise<PactToolboxNetwork> {
  const network = new PactToolboxNetwork(config, options);

  if (options.autoStart !== false) {
    await network.start(options);
  }

  return network;
}
