import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import type { PactDeployer } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";
import type { CoinContract, MarmaladeContract } from "@pact-toolbox/kda";
import type { WalletManager, SignerInfo } from "./wallet-manager";
import type { NamespaceHandler } from "./namespace-handler";
import type { ChainId } from "@pact-toolbox/types";

export interface ScriptContext<Args = Record<string, unknown>> {
  // Core components
  deployer: PactDeployer;
  config: PactToolboxConfigObj;
  network: string;
  chainId: string;
  args: Args;
  logger: typeof logger;

  // Wallet and signing
  wallet: WalletManager;
  currentSigner: SignerInfo | null;

  // Namespace management
  namespace: NamespaceHandler;

  // KDA services (from @pact-toolbox/kda)
  coin: CoinContract;
  marmalade: MarmaladeContract;
}

export class ScriptContextBuilder<Args = Record<string, unknown>> {
  private deployer: PactDeployer;
  private config: PactToolboxConfigObj;
  private network: string;
  private chainId: ChainId;
  private args: Args;
  private wallet: WalletManager;
  private namespace: NamespaceHandler;
  private coin: CoinContract;
  private marmalade: MarmaladeContract;

  constructor(
    deployer: PactDeployer,
    config: PactToolboxConfigObj,
    network: string,
    chainId: ChainId,
    args: Args,
    wallet: WalletManager,
    namespace: NamespaceHandler,
    coin: CoinContract,
    marmalade: MarmaladeContract,
  ) {
    this.deployer = deployer;
    this.config = config;
    this.network = network;
    this.chainId = chainId;
    this.args = args;
    this.wallet = wallet;
    this.namespace = namespace;
    this.coin = coin;
    this.marmalade = marmalade;
  }

  async build(): Promise<ScriptContext<Args>> {
    logger.info(`Building script context for network: ${this.network}, chain: ${this.chainId}`);

    // Get current signer
    const currentSigner = this.wallet.getCurrentSigner();

    const scriptContext: ScriptContext<Args> = {
      // Core components
      deployer: this.deployer,
      config: this.config,
      network: this.network,
      chainId: this.chainId,
      args: this.args,
      logger,

      // Wallet and signing
      wallet: this.wallet,
      currentSigner,

      // Namespace management
      namespace: this.namespace,

      // KDA services - injected via constructor
      coin: this.coin,
      marmalade: this.marmalade,
    };

    logger.success(`Script context created successfully`);
    return scriptContext;
  }
}

/**
 * Create a script context builder
 */
export function createScriptContextBuilder<Args = Record<string, unknown>>(
  deployer: PactDeployer,
  config: PactToolboxConfigObj,
  network: string,
  chainId: ChainId,
  args: Args,
  wallet: WalletManager,
  namespace: NamespaceHandler,
  coin: CoinContract,
  marmalade: MarmaladeContract,
): ScriptContextBuilder<Args> {
  return new ScriptContextBuilder(
    deployer,
    config,
    network,
    chainId,
    args,
    wallet,
    namespace,
    coin,
    marmalade,
  );
}
