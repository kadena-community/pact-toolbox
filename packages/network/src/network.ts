import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { CreateDevProxyServerOptions, PactToolboxDevProxyServer } from "@pact-toolbox/proxy";

import { getNetworkConfig, isDevNetworkConfig, isLocalNetwork, isPactServerNetworkConfig } from "@pact-toolbox/config";
import { deployPreludes, downloadAllPreludes, shouldDownloadPreludes } from "@pact-toolbox/prelude";
import { createDevProxyServer } from "@pact-toolbox/proxy";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { getUuid, logger } from "@pact-toolbox/utils";

import { LocalDevNetNetwork } from "./networks/devnet";
import { PactServerNetwork } from "./networks/pactServer";
import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from "./types";
import { ensureAvailablePorts } from "./utils";

export interface StartLocalNetworkOptions extends ToolboxNetworkStartOptions {
  client?: PactToolboxClient;
  logAccounts?: boolean;
  network?: string;
  devProxyOptions?: CreateDevProxyServerOptions;
  cleanup?: boolean;
  autoStart?: boolean;
}

export class PactToolboxNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  #networkApi: ToolboxNetworkApi;
  #networkConfig: NetworkConfig;
  #devProxy?: PactToolboxDevProxyServer;
  #client: PactToolboxClient;
  #devProxyPort: number = 8080;
  #startOptions: StartLocalNetworkOptions;
  #toolboxConfig: PactToolboxConfigObj;

  constructor(toolboxConfig: PactToolboxConfigObj, startOptions: StartLocalNetworkOptions = {}) {
    this.#toolboxConfig = toolboxConfig;
    this.#startOptions = {
      isDetached: true,
      logAccounts: false,
      isStateless: false,
      ...startOptions,
    };
    const networkConfig = getNetworkConfig(this.#toolboxConfig, this.#startOptions.network);
    if (!networkConfig) {
      throw new Error(`Network ${networkConfig} not found in config`);
    }
    if (!isLocalNetwork(networkConfig)) {
      throw new Error(`Netwsork ${networkConfig.name} is not a local or devnet network`);
    }
    this.#devProxyPort = toolboxConfig.devProxyPort ?? this.#startOptions.devProxyOptions?.port ?? 8080;
    this.#client = this.#startOptions.client ?? new PactToolboxClient(toolboxConfig);
    if (isPactServerNetworkConfig(networkConfig)) {
      this.#networkApi = new PactServerNetwork(networkConfig);
    } else if (isDevNetworkConfig(networkConfig)) {
      this.#networkApi = new LocalDevNetNetwork(networkConfig);
    } else {
      throw new Error(`Unsupported network type`);
    }
    // if (this.#toolboxConfig.enableDevProxy) {
    //   this.#devProxy = createDevProxyServer(this.#networkApi, {
    //     port: this.#devProxyPort,
    //     ...this.#startOptions.devProxyOptions,
    //   });
    // }
    this.#networkConfig = networkConfig;
  }

  getServicePort(): number {
    return this.#networkApi.getServicePort();
  }

  hasOnDemandMining(): boolean {
    return this.#networkApi.hasOnDemandMining();
  }

  getMiningClientUrl(): string {
    return this.#networkApi.getMiningClientUrl();
  }

  getNodeServiceUrl(): string {
    return this.#networkApi.getNodeServiceUrl();
  }

  getDevProxyUrl(): string {
    return `http://localhost:${this.#devProxyPort}`;
  }

  getDevProxyPort(): number {
    return this.#devProxyPort;
  }

  getNetworkName(): string {
    return this.#networkConfig.name ?? "unknown";
  }

  async start(options?: ToolboxNetworkStartOptions): Promise<void> {
    const preludes = this.#toolboxConfig.preludes ?? [];
    const contractsDir = this.#toolboxConfig.contractsDir ?? "contracts";
    const preludeConfig = {
      client: this.#client,
      contractsDir,
      preludes,
    };
    const needDownloadPreludes = this.#toolboxConfig.downloadPreludes && (await shouldDownloadPreludes(preludeConfig));

    if (needDownloadPreludes) {
      // download preludes
      await downloadAllPreludes(preludeConfig);
    }
    await ensureAvailablePorts(this.#networkConfig);
    await this.#networkApi.start({
      ...this.#startOptions,
      ...options,
    });
    logger.success(`Network ${this.#networkConfig.name} started at ${this.getNodeServiceUrl()}`);
    // if (this.#toolboxConfig.enableDevProxy) {
    //   await this.#devProxy?.start();
    // }
    if (this.#toolboxConfig.deployPreludes) {
      await deployPreludes(preludeConfig);
    }

    if (this.#startOptions.logAccounts) {
      // log all signers and keys
      const signers = this.#networkConfig.keyPairs ?? [];
      for (const signer of signers) {
        logger.log(`Account: ${signer.account}`);
        logger.log(`Public: ${signer.publicKey}`);
        logger.log(`Secret: ${signer.secretKey}`);
        logger.log("--------------------------------");
      }
    }
  }

  async restart(): Promise<void> {
    await this.#networkApi.restart();
    logger.success(`Network ${this.#networkConfig.name} restarted at ${this.getNodeServiceUrl()}`);
  }

  async stop(): Promise<void> {
    await this.#networkApi.stop();
    await this.#devProxy?.stop();
    logger.success(`Network ${this.#networkConfig.name} stopped!`);
  }

  async isOk(): Promise<boolean> {
    return this.#networkApi.isOk();
  }
}

export async function createPactToolboxNetwork(
  config: PactToolboxConfigObj,
  options: StartLocalNetworkOptions = {},
): Promise<PactToolboxNetwork> {
  const network = new PactToolboxNetwork(config, options);
  if (!options.autoStart) {
    return network;
  }

  let isCleaningUp = false;
  if (options.cleanup) {
    async function handleShutdown(signal: string) {
      if (isCleaningUp) {
        return;
      }
      isCleaningUp = true;
      logger.info(`\n${signal} received. Shutting down network...`);
      try {
        await Promise.race([network.stop(), new Promise((resolve) => setTimeout(resolve, 10000))]);
      } catch (error) {
        console.error(`Error during graceful shutdown:`, error);
      }
    }

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("exit", () => {});
  }
  try {
    await network.start(options);
  } catch (error) {
    logger.error(`Failed to start network ${network.id}:`, error);
    if (!isCleaningUp && options.cleanup) {
      await network.stop().catch((cleanupError) => {
        logger.error(`Error during cleanup after failed start:`, cleanupError);
      });
    }
    throw error;
  }
  return network;
}
