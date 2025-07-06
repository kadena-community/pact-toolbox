import type {
  INetworkProvider,
  ISignerResolver,
  ISigner,
  PactToolboxContext,
  SerializableNetworkConfig,
  KeyPair
} from "@pact-toolbox/types";
import { createKeypairSigner } from "@pact-toolbox/transaction";

/**
 * Adapter that converts a PactToolboxContext to work with DI interfaces
 */
export class ContextToNetworkProviderAdapter implements INetworkProvider {
  constructor(private readonly context: PactToolboxContext) {}

  getNetworkConfig(): SerializableNetworkConfig {
    const network = this.context.getNetwork();
    return {
      network: network.type,
      chainId: network.chainId ?? "0",
      networkApi: network.api,
      explorerUrl: network.explorerUrl,
      gasPayer: network.gasPayer,
    };
  }
}

/**
 * Adapter that converts a PactToolboxContext to work with SignerResolver interface
 */
export class ContextToSignerResolverAdapter implements ISignerResolver {
  constructor(private readonly context: PactToolboxContext) {}

  getDefaultSigner(): ISigner | null {
    const contextSigner = this.context.getDefaultSigner();
    if (!contextSigner) {
      return null;
    }

    // Convert context signer to ISigner
    return {
      sign: async (transaction: any, options?: any) => {
        // This would need proper implementation based on context signer interface
        throw new Error("Context signer sign not implemented in adapter");
      },
      getKeys: () => [contextSigner.pubKey]
    };
  }

  getSignerKeys(account?: string): string[] {
    const keys = this.context.getSignerKeys(account);
    if (!keys) {
      return [];
    }
    
    // Handle both single key and array of keys
    if (typeof keys === "string") {
      return [keys];
    }
    
    if ("publicKey" in keys) {
      return [keys.publicKey];
    }
    
    return [];
  }

  createSigner(keypairs: KeyPair[]): ISigner {
    return createKeypairSigner(keypairs);
  }
}

/**
 * Create adapters from a PactToolboxContext
 */
export function createAdaptersFromContext(context: PactToolboxContext) {
  return {
    networkProvider: new ContextToNetworkProviderAdapter(context),
    signerResolver: new ContextToSignerResolverAdapter(context),
  };
}