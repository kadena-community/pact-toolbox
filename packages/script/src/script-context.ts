import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import type { PactToolboxClient } from "@pact-toolbox/runtime";
import type { Wallet } from "@pact-toolbox/wallet-adapters";
import { logger } from "@pact-toolbox/node-utils";
import { CoinService, MarmaladeService, NamespaceService } from "@pact-toolbox/kda";
import type { WalletManager, SignerInfo } from "./wallet-manager";
import type { NamespaceHandler } from "./namespace-handler";
import { DeploymentHelper } from "./deployment";
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

  constructor(
    client: PactToolboxClient,
    config: PactToolboxConfigObj,
    network: string,
    chainId: ChainId,
    args: Args,
    walletManager: WalletManager,
    namespaceHandler: NamespaceHandler,
  ) {
    this.client = client;
    this.config = config;
    this.network = network;
    this.chainId = chainId;
    this.args = args;
    this.walletManager = walletManager;
    this.namespaceHandler = namespaceHandler;
  }

  async build(): Promise<ScriptContext<Args>> {
    logger.info(`Building script context for network: ${this.network}, chain: ${this.chainId}`);

    // Get current wallet and signer
    const wallet = this.walletManager.getWallet();
    const currentSigner = this.walletManager.getCurrentSigner();

    // Get network context from the client
    const networkContext = this.client.getContext();

    // Set wallet if available
    if (wallet) {
      networkContext.setWallet(wallet as any);
    }

    // Initialize KDA services with proper configuration
    const coinService = new CoinService({
      context: networkContext,
      defaultChainId: this.chainId,
      wallet: wallet as any,
    });

    const marmaladeService = new MarmaladeService({
      context: networkContext,
      defaultChainId: this.chainId,
      wallet: wallet as any,
    });

    const namespaceService = new NamespaceService({
      context: networkContext,
      defaultChainId: this.chainId,
    });

    // Initialize deployment helper
    const deployments = new DeploymentHelper(
      this.client,
      this.config,
      this.network,
      this.walletManager,
      this.namespaceHandler,
    );

    // Deployment helper is ready to use

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

      // KDA services
      coinService,
      marmaladeService,
      namespaceService,

      // Deployment utilities
      deployments,
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
): ScriptContextBuilder<Args> {
  return new ScriptContextBuilder(client, config, network, chainId, args, walletManager, namespaceHandler);
}
