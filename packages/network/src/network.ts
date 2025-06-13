import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

import { getNetworkConfig, isDevNetworkConfig, isLocalNetwork, isPactServerNetworkConfig } from "@pact-toolbox/config";
import { deployPreludes, downloadAllPreludes, shouldDownloadPreludes } from "@pact-toolbox/prelude";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import {
  getUuid,
  logger as defaultLogger,
  spinner as defaultSpinner,
  type Logger,
  type Spinner,
  LogLevels,
} from "@pact-toolbox/utils";

import { LocalDevNetNetwork } from "./networks/devnet";
import { PactServerNetwork } from "./networks/pactServer";
import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from "./types";
import { ensureAvailablePorts } from "./utils";

export interface StartLocalNetworkOptions extends ToolboxNetworkStartOptions {
  client?: PactToolboxClient;
  logAccounts?: boolean;
  network?: string;
  cleanup?: boolean;
  autoStart?: boolean;
  logger?: Logger;
  spinner?: Spinner;
}

export class PactToolboxNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  #networkApi: ToolboxNetworkApi;
  #networkConfig: NetworkConfig;
  #client: PactToolboxClient;
  #startOptions: StartLocalNetworkOptions;
  #toolboxConfig: PactToolboxConfigObj;
  #logger: Logger;
  #spinner: Spinner;

  constructor(toolboxConfig: PactToolboxConfigObj, startOptions: StartLocalNetworkOptions = {}) {
    this.#toolboxConfig = toolboxConfig;
    this.#startOptions = {
      isDetached: true,
      logAccounts: false,
      isStateless: false,
      ...startOptions,
    };
    this.#logger = this.#startOptions.logger ?? defaultLogger;
    this.#spinner = this.#startOptions.spinner ?? defaultSpinner({ indicator: "timer" });
    const networkConfig = getNetworkConfig(this.#toolboxConfig, this.#startOptions.network);
    if (!networkConfig) {
      throw new Error(`Network ${networkConfig} not found in config`);
    }
    if (!isLocalNetwork(networkConfig)) {
      throw new Error(`Netwsork ${networkConfig.name} is not a local or devnet network`);
    }
    this.#client = this.#startOptions.client ?? new PactToolboxClient(toolboxConfig);
    if (isPactServerNetworkConfig(networkConfig)) {
      this.#networkApi = new PactServerNetwork(networkConfig, this.#client);
    } else if (isDevNetworkConfig(networkConfig)) {
      this.#networkApi = new LocalDevNetNetwork(networkConfig, {
        client: this.#client,
        logger: this.#logger,
        spinner: this.#spinner,
      });
    } else {
      throw new Error(`Unsupported network type`);
    }
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

  getNetworkName(): string {
    return this.#networkConfig.name ?? "unknown";
  }

  async start(options?: ToolboxNetworkStartOptions): Promise<void> {
    this.#client = options?.client ?? this.#client;
    this.#spinner.start(`Starting network ${this.#networkConfig.name}...`);
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
      client: this.#client,
    });

    if (this.#toolboxConfig.deployPreludes) {
      await deployPreludes(preludeConfig);
    }

    if (this.#startOptions.logAccounts) {
      // log all signers and keys
      const signers = this.#networkConfig.keyPairs ?? [];
      for (const signer of signers) {
        this.#logger.log(`Account: ${signer.account}`);
        this.#logger.log(`Public: ${signer.publicKey}`);
        this.#logger.log(`Secret: ${signer.secretKey}`);
        this.#logger.log("--------------------------------");
      }
    }
    this.#spinner.stop(`Network ${this.#networkConfig.name} started at ${this.getNodeServiceUrl()}`);
  }

  async restart(): Promise<void> {
    await this.#networkApi.restart();
  }

  async stop(): Promise<void> {
    await this.#networkApi.stop();
  }

  async isOk(): Promise<boolean> {
    return this.#networkApi.isOk();
  }
}

export async function createPactToolboxNetwork(
  config: PactToolboxConfigObj,
  options: StartLocalNetworkOptions = {},
): Promise<PactToolboxNetwork> {
  const logLevel =
    process.env.LOG_LEVEL && LogLevels[process.env.LOG_LEVEL as keyof typeof LogLevels]
      ? LogLevels[process.env.LOG_LEVEL as keyof typeof LogLevels]
      : LogLevels.error;
  const logger = options.logger ?? defaultLogger.create({ level: logLevel });
  const spinner = options.spinner ?? defaultSpinner({ indicator: "timer" });
  const network = new PactToolboxNetwork(config, {
    ...options,
    logger,
    spinner,
  });

  if (!options.autoStart) {
    return network;
  }

  let isCleaningUp = false;
  if (options.cleanup) {
    async function handleShutdown() {
      if (isCleaningUp) {
        return;
      }
      logger.info(`Shutting down network ${network.getNetworkName()}...`);
      isCleaningUp = true;
      try {
        await Promise.race([network.stop(), new Promise((resolve) => setTimeout(resolve, 10000))]);
      } catch (error) {
        logger.error(`Error during graceful shutdown:`, error);
      } finally {
        logger.success(`Network ${network.getNetworkName()} stopped!`);
        // process.exit(0);
      }
    }

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
    // process.on("exit", handleShutdown);
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
