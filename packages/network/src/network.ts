import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type { CreateDevProxyServerOptions, PactToolboxDevProxyServer } from "@pact-toolbox/proxy";

import {
  getNetworkConfig,
  isDevNetworkConfig,
  isLocalChainwebNetworkConfig,
  isLocalNetwork,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { deployPreludes, downloadAllPreludes, shouldDownloadPreludes } from "@pact-toolbox/prelude";
import { createDevProxyServer } from "@pact-toolbox/proxy";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from "./types";
import { LocalChainwebNetwork } from "./networks/chainweb";
import { LocalDevNetNetwork } from "./networks/devnet";
import { PactServerNetwork } from "./networks/pactServer";

export function createPactToolboxNetwork(network: NetworkConfig): ToolboxNetworkApi {
  if (isPactServerNetworkConfig(network)) {
    return new PactServerNetwork(network);
  }
  if (isDevNetworkConfig(network)) {
    return new LocalDevNetNetwork(network);
  }

  if (isLocalChainwebNetworkConfig(network)) {
    return new LocalChainwebNetwork(network);
  }
  throw new Error(`Unsupported network type`);
}

export interface StartLocalNetworkOptions extends ToolboxNetworkStartOptions {
  client?: PactToolboxClient;
  logAccounts?: boolean;
  network?: string;
  devProxyOptions?: CreateDevProxyServerOptions;
}

export class PactToolboxNetwork implements ToolboxNetworkApi {
  public id = "pact-toolbox";
  private networkApi: ToolboxNetworkApi;
  private networkConfig: NetworkConfig;
  private devProxy?: PactToolboxDevProxyServer;
  private client: PactToolboxClient;
  private devProxyPort: string | number = 8080;
  private startOptions: StartLocalNetworkOptions;

  constructor(
    private toolboxConfig: PactToolboxConfigObj,
    startOptions: StartLocalNetworkOptions = {},
  ) {
    this.startOptions = {
      silent: true,
      logAccounts: false,
      isStateless: false,
      ...startOptions,
    };
    const networkConfig = getNetworkConfig(this.toolboxConfig, this.startOptions.network);
    if (!networkConfig) {
      throw new Error(`Network ${networkConfig} not found in config`);
    }
    if (!isLocalNetwork(networkConfig)) {
      throw new Error(`Network ${networkConfig.name} is not a local or devnet network`);
    }
    this.devProxyPort = toolboxConfig.devProxyPort ?? this.startOptions.devProxyOptions?.port ?? 8080;
    this.client = this.startOptions.client ?? new PactToolboxClient(toolboxConfig);
    this.networkApi = createPactToolboxNetwork(networkConfig);
    if (this.toolboxConfig.enableDevProxy) {
      this.devProxy = createDevProxyServer(this.networkApi, {
        port: this.devProxyPort,
        ...this.startOptions.devProxyOptions,
      });
    }
    this.networkConfig = networkConfig;
  }

  getServicePort(): number | string {
    return this.networkApi.getServicePort();
  }

  hasOnDemandMining(): boolean {
    return this.networkApi.hasOnDemandMining();
  }

  getOnDemandMiningUrl(): string {
    return this.networkApi.getOnDemandMiningUrl();
  }

  getServiceUrl(): string {
    return this.networkApi.getServiceUrl();
  }

  getDevProxyUrl(): string {
    return `http://localhost:${this.devProxyPort}`;
  }

  getDevProxyPort(): string | number {
    return this.devProxyPort;
  }

  async start(options?: ToolboxNetworkStartOptions): Promise<void> {
    const preludes = this.toolboxConfig.preludes ?? [];
    const contractsDir = this.toolboxConfig.contractsDir ?? "contracts";
    const preludeConfig = {
      client: this.client,
      contractsDir,
      preludes,
    };
    const needDownloadPreludes = this.toolboxConfig.downloadPreludes && (await shouldDownloadPreludes(preludeConfig));

    if (needDownloadPreludes) {
      // download preludes
      await downloadAllPreludes(preludeConfig);
    }
    await this.networkApi.start({
      ...this.startOptions,
      ...options,
    });
    logger.success(`Network ${this.networkConfig.name} started at ${this.getServiceUrl()}`);
    await this.devProxy?.start();
    if (this.toolboxConfig.deployPreludes) {
      await deployPreludes(preludeConfig);
    }

    if (this.startOptions.logAccounts) {
      // log all signers and keys
      const signers = this.networkConfig.keyPairs ?? [];
      for (const signer of signers) {
        logger.log(`Account: ${signer.account}`);
        logger.log(`Public: ${signer.publicKey}`);
        logger.log(`Secret: ${signer.secretKey}`);
        logger.log("--------------------------------");
      }
    }
  }

  async restart(): Promise<void> {
    await this.networkApi.restart();
    logger.success(`Network ${this.networkConfig.name} restarted at ${this.getServiceUrl()}`);
  }

  async stop(): Promise<void> {
    await this.networkApi.stop();
    await this.devProxy?.stop();
    logger.success(`Network ${this.networkConfig.name} stopped!`);
  }

  async isOk(): Promise<boolean> {
    return this.networkApi.isOk();
  }
}

export async function startLocalNetwork(
  config: PactToolboxConfigObj,
  options: StartLocalNetworkOptions = {},
): Promise<PactToolboxNetwork> {
  const network = new PactToolboxNetwork(config, options);
  try {
    await network.start(options);
    return network;
  } catch (e) {
    await network.stop();
    throw e;
  }
}
