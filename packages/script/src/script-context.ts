import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import type { PactToolboxClient } from "@pact-toolbox/deployer";
import type { Wallet } from "@pact-toolbox/wallet-adapters";
import { logger } from "@pact-toolbox/node-utils";
import type { CoinService, MarmaladeService, NamespaceService } from "@pact-toolbox/kda";
import type { WalletManager, SignerInfo } from "./wallet-manager";
import type { NamespaceHandler } from "./namespace-handler";
import type { DeploymentHelper } from "@pact-toolbox/deployer";
import type { ChainId } from "@pact-toolbox/types";

export interface ScriptContext<Args = Record<string, unknown>> {
  // Core components
  client: PactToolboxClient;
  config: PactToolboxConfigObj;
  network: string;
  chainId: string;
  args: Args;
  logger: typeof logger;

  // Wallet and signing
  wallet: Wallet | null;
  walletManager: WalletManager;
  currentSigner: SignerInfo | null;

  // KDA services (from @pact-toolbox/kda)
  coinService: CoinService;
  marmaladeService: MarmaladeService;
  namespaceService: NamespaceService;

  // Deployment utilities
  deployments: DeploymentHelper;
}

export class ScriptContextBuilder<Args = Record<string, unknown>> {
  private client: PactToolboxClient;
  private config: PactToolboxConfigObj;
  private network: string;
  private chainId: ChainId;
  private args: Args;
  private walletManager: WalletManager;
  private namespaceHandler: NamespaceHandler;
  private coinService: CoinService;
  private marmaladeService: MarmaladeService;
  private namespaceService: NamespaceService;
  private deploymentHelper: DeploymentHelper;

  constructor(
    client: PactToolboxClient,
    config: PactToolboxConfigObj,
    network: string,
    chainId: ChainId,
    args: Args,
    walletManager: WalletManager,
    namespaceHandler: NamespaceHandler,
    coinService: CoinService,
    marmaladeService: MarmaladeService,
    namespaceService: NamespaceService,
    deploymentHelper: DeploymentHelper,
  ) {
    this.client = client;
    this.config = config;
    this.network = network;
    this.chainId = chainId;
    this.args = args;
    this.walletManager = walletManager;
    this.namespaceHandler = namespaceHandler;
    this.coinService = coinService;
    this.marmaladeService = marmaladeService;
    this.namespaceService = namespaceService;
    this.deploymentHelper = deploymentHelper;
  }

  async build(): Promise<ScriptContext<Args>> {
    logger.info(`Building script context for network: ${this.network}, chain: ${this.chainId}`);

    // Get current wallet and signer
    const wallet = this.walletManager.getWallet();
    const currentSigner = this.walletManager.getCurrentSigner();

    const scriptContext: ScriptContext<Args> = {
      // Core components
      client: this.client,
      config: this.config,
      network: this.network,
      chainId: this.chainId,
      args: this.args,
      logger,

      // Wallet and signing
      wallet,
      walletManager: this.walletManager,
      currentSigner,

      // KDA services - injected via constructor
      coinService: this.coinService,
      marmaladeService: this.marmaladeService,
      namespaceService: this.namespaceService,

      // Deployment utilities - injected via constructor
      deployments: this.deploymentHelper,
    };

    logger.success(`Script context created successfully`);
    return scriptContext;
  }
}

/**
 * Create a script context builder
 */
export function createScriptContextBuilder<Args = Record<string, unknown>>(
  client: PactToolboxClient,
  config: PactToolboxConfigObj,
  network: string,
  chainId: ChainId,
  args: Args,
  walletManager: WalletManager,
  namespaceHandler: NamespaceHandler,
  coinService: CoinService,
  marmaladeService: MarmaladeService,
  namespaceService: NamespaceService,
  deploymentHelper: DeploymentHelper,
): ScriptContextBuilder<Args> {
  return new ScriptContextBuilder(
    client,
    config,
    network,
    chainId,
    args,
    walletManager,
    namespaceHandler,
    coinService,
    marmaladeService,
    namespaceService,
    deploymentHelper,
  );
}
