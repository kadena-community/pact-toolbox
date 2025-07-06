import type { PactKeyset, ChainId, PactValue, PactToolboxContext } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { MarmaladeServiceDI } from "./marmalade-service-di";
import { createAdaptersFromContext } from "./context-adapter";

/**
 * Configuration for the MarmaladeService
 */
export interface MarmaladeServiceConfig {
  /** Network context for blockchain operations */
  context: PactToolboxContext;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Wallet for signing transactions */
  wallet?: Wallet;
}

/**
 * Service for Marmalade NFT operations on Kadena blockchain
 * 
 * @deprecated Use MarmaladeServiceDI with dependency injection instead. This class is maintained for backward compatibility.
 */
export class MarmaladeService extends MarmaladeServiceDI {
  private readonly contextConfig: MarmaladeServiceConfig;

  constructor(config: MarmaladeServiceConfig) {
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
}

// Re-export types from DI version
export type {
  MarmaladeOperationOptions,
  TokenInfo,
  CreateTokenOptions,
  MintTokenOptions,
  TransferTokenOptions,
  TransferCreateTokenOptions,
  BurnTokenOptions,
  GetBalanceOptions
} from "./marmalade-service-di";