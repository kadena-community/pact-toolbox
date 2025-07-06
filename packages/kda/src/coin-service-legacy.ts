import type { PactKeyset, ChainId, PactToolboxContext } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { CoinServiceDI } from "./coin-service-di";
import { createAdaptersFromContext } from "./context-adapter";

/**
 * Configuration for the CoinService
 */
export interface CoinServiceConfig {
  /** Network context for blockchain operations */
  context: PactToolboxContext;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Wallet for signing transactions */
  wallet?: Wallet;
}

/**
 * Service for coin operations on Kadena blockchain
 *
 * This service provides a high-level interface for common coin operations
 * like transfers, account creation, and balance queries. It uses the configured
 * chainweb client and wallet for all operations.
 * 
 * @deprecated Use CoinServiceDI with dependency injection instead. This class is maintained for backward compatibility.
 */
export class CoinService extends CoinServiceDI {
  private readonly contextConfig: CoinServiceConfig;

  constructor(config: CoinServiceConfig) {
    // Create adapters from context
    const adapters = createAdaptersFromContext(config.context);
    
    // Initialize parent with DI config
    super({
      networkProvider: adapters.networkProvider,
      signerResolver: adapters.signerResolver,
      defaultChainId: config.defaultChainId,
      defaultSigner: config.wallet,
    });
    
    this.contextConfig = config;
  }

  /**
   * Smart transfer that uses transfer-create if destination account doesn't exist
   */
  async fund(options: TransferCreateOptions): Promise<string> {
    const exists = await this.accountExists(options.to, options);

    if (exists) {
      return this.transfer(options);
    } else {
      return this.transferCreate(options);
    }
  }
}

// Re-export types from DI version
export type {
  CoinOperationOptions,
  CreateAccountOptions,
  TransferOptions,
  TransferCreateOptions,
  CrosschainTransferOptions,
  AccountInfo
} from "./coin-service-di";