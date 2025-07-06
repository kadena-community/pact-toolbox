import type { PactKeyset, ChainId, PactToolboxContext } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { NamespaceServiceDI } from "./namespace-service-di";
import { createAdaptersFromContext } from "./context-adapter";

/**
 * Configuration for the NamespaceService
 */
export interface NamespaceServiceConfig {
  /** Network context for blockchain operations */
  context: PactToolboxContext;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Wallet for signing transactions */
  wallet?: Wallet;
}

/**
 * Service for namespace operations on Kadena blockchain
 * 
 * @deprecated Use NamespaceServiceDI with dependency injection instead. This class is maintained for backward compatibility.
 */
export class NamespaceService extends NamespaceServiceDI {
  private readonly contextConfig: NamespaceServiceConfig;

  constructor(config: NamespaceServiceConfig) {
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
  NamespaceOperationOptions,
  CreateNamespaceOptions,
  RotateNamespaceOptions,
  DefineModuleOptions,
  DefineInterfaceOptions,
  NamespaceInfo
} from "./namespace-service-di";