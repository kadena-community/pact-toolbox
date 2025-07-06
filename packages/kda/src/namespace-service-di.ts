import { execution } from "@pact-toolbox/transaction";
import type { 
  PactKeyset, 
  ChainId,
  INetworkProvider,
  ISignerResolver,
  ISigner,
  IChainwebClient,
  Wallet
} from "@pact-toolbox/types";
import { resolve } from "@pact-toolbox/utils";
import { TOKENS } from "@pact-toolbox/types";

/**
 * Configuration for the NamespaceService with DI
 */
export interface NamespaceServiceConfigDI {
  /** Network provider for network configuration */
  networkProvider?: INetworkProvider;
  /** Signer resolver for signing operations */
  signerResolver?: ISignerResolver;
  /** Chainweb client for blockchain operations */
  chainwebClient?: IChainwebClient;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Default wallet/signer for operations */
  defaultSigner?: ISigner | Wallet;
}

/**
 * Base options for namespace operations
 */
export interface NamespaceOperationOptions {
  /** Chain ID for this specific operation */
  chainId?: ChainId;
  /** Gas limit override */
  gasLimit?: number;
  /** Gas price override */
  gasPrice?: number;
  /** Time to live override */
  ttl?: number;
  /** Custom signer for this operation */
  signer?: ISigner | Wallet;
}

/**
 * Options for namespace creation
 */
export interface CreateNamespaceOptions extends NamespaceOperationOptions {
  /** Namespace name */
  namespace: string;
  /** Admin keyset for the namespace */
  adminGuard: PactKeyset;
  /** User keyset for the namespace */
  userGuard: PactKeyset;
}

/**
 * Options for namespace rotation
 */
export interface RotateNamespaceOptions extends NamespaceOperationOptions {
  /** Namespace name */
  namespace: string;
  /** New admin keyset */
  newAdminGuard: PactKeyset;
  /** New user keyset */
  newUserGuard: PactKeyset;
}

/**
 * Options for module definition
 */
export interface DefineModuleOptions extends NamespaceOperationOptions {
  /** Namespace name */
  namespace: string;
  /** Module name */
  moduleName: string;
  /** Module code */
  moduleCode: string;
  /** Keyset references used in the module */
  keysets?: Record<string, PactKeyset>;
}

/**
 * Options for interface definition
 */
export interface DefineInterfaceOptions extends NamespaceOperationOptions {
  /** Namespace name */
  namespace: string;
  /** Interface name */
  interfaceName: string;
  /** Interface code */
  interfaceCode: string;
}

/**
 * Namespace information
 */
export interface NamespaceInfo {
  /** Namespace name */
  namespace: string;
  /** Admin keyset */
  adminGuard: PactKeyset;
  /** User keyset */
  userGuard: PactKeyset;
}

/**
 * Service for namespace operations on Kadena blockchain using DI
 */
export class NamespaceServiceDI {
  private readonly networkProvider: INetworkProvider;
  private readonly signerResolver: ISignerResolver;
  private readonly chainwebClient: IChainwebClient;
  private readonly defaultChainId: ChainId;
  private readonly defaultSigner?: ISigner | Wallet;

  constructor(config?: NamespaceServiceConfigDI) {
    // Resolve dependencies from DI container with fallbacks
    this.networkProvider = config?.networkProvider ?? resolve(TOKENS.NetworkProvider);
    this.signerResolver = config?.signerResolver ?? resolve(TOKENS.SignerResolver);
    this.chainwebClient = config?.chainwebClient ?? resolve(TOKENS.ChainwebClient);
    this.defaultChainId = config?.defaultChainId ?? "0";
    this.defaultSigner = config?.defaultSigner;
  }

  /**
   * Get the current network configuration
   */
  private getNetworkConfig() {
    return this.networkProvider.getNetworkConfig();
  }

  /**
   * Get a signer for operations
   */
  private getSigner(options?: { signer?: ISigner | Wallet; account?: string }): ISigner | Wallet | null {
    // Priority: operation signer > default signer > resolver
    if (options?.signer) {
      return options.signer;
    }
    
    if (this.defaultSigner) {
      return this.defaultSigner;
    }

    return this.signerResolver.getDefaultSigner();
  }

  /**
   * Get signer keys for an account
   */
  private getSignerKeys(account?: string): string[] {
    return this.signerResolver.getSignerKeys(account);
  }

  /**
   * Check if a namespace exists
   */
  async namespaceExists(namespace: string, options?: NamespaceOperationOptions): Promise<boolean> {
    const chainId = options?.chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    try {
      await execution(`(describe-namespace "${namespace}")`)
        .withChainId(chainId)
        .withNetwork(networkConfig)
        .build()
        .dirtyRead();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get namespace information
   */
  async getNamespaceInfo(namespace: string, options?: NamespaceOperationOptions): Promise<NamespaceInfo> {
    const chainId = options?.chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    const result = await execution<any>(`(describe-namespace "${namespace}")`)
      .withChainId(chainId)
      .withNetwork(networkConfig)
      .build()
      .dirtyRead();

    return {
      namespace,
      adminGuard: result["ns-admin-guard"],
      userGuard: result["ns-operate-guard"]
    };
  }

  /**
   * Create a new namespace
   */
  async createNamespace(options: CreateNamespaceOptions): Promise<string> {
    const { namespace, adminGuard, userGuard, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for create namespace operation");
    }

    const signerKeys = this.getSignerKeys();
    if (signerKeys.length === 0) {
      throw new Error("No signer keys found");
    }

    return execution(`(define-namespace "${namespace}" (read-keyset 'ns-admin) (read-keyset 'ns-user))`)
      .withChainId(resolvedChainId)
      .withNetwork(networkConfig)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("ns-admin", adminGuard)
      .withKeyset("ns-user", userGuard)
      .withSigner(signerKeys[0], (withCapability) => [withCapability("coin.GAS")])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Rotate namespace keysets
   */
  async rotateNamespace(options: RotateNamespaceOptions): Promise<string> {
    const { namespace, newAdminGuard, newUserGuard, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for rotate namespace operation");
    }

    // Get current admin keys (should be provided by the caller typically)
    const signerKeys = this.getSignerKeys();
    if (signerKeys.length === 0) {
      throw new Error("No signer keys found for namespace admin");
    }

    return execution(`(namespace.rotate "${namespace}" (read-keyset 'new-ns-admin) (read-keyset 'new-ns-user))`)
      .withChainId(resolvedChainId)
      .withNetwork(networkConfig)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("new-ns-admin", newAdminGuard)
      .withKeyset("new-ns-user", newUserGuard)
      .withSigner(signerKeys[0], (withCapability) => [withCapability("coin.GAS")])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Define a module in a namespace
   */
  async defineModule(options: DefineModuleOptions): Promise<string> {
    const { namespace, moduleName, moduleCode, keysets, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for define module operation");
    }

    const signerKeys = this.getSignerKeys();
    if (signerKeys.length === 0) {
      throw new Error("No signer keys found");
    }

    let builder = execution(moduleCode)
      .withChainId(resolvedChainId)
      .withNetwork(networkConfig)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 50000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0], (withCapability) => [withCapability("coin.GAS")]);

    // Add any keysets referenced in the module
    if (keysets) {
      for (const [name, keyset] of Object.entries(keysets)) {
        builder = builder.withKeyset(name, keyset);
      }
    }

    return builder.sign(operationSigner).submitAndListen() as Promise<string>;
  }

  /**
   * Define an interface in a namespace
   */
  async defineInterface(options: DefineInterfaceOptions): Promise<string> {
    const { namespace, interfaceName, interfaceCode, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for define interface operation");
    }

    const signerKeys = this.getSignerKeys();
    if (signerKeys.length === 0) {
      throw new Error("No signer keys found");
    }

    return execution(interfaceCode)
      .withChainId(resolvedChainId)
      .withNetwork(networkConfig)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 10000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0], (withCapability) => [withCapability("coin.GAS")])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * List all namespaces (note: this requires enumeration support)
   */
  async listNamespaces(options?: NamespaceOperationOptions): Promise<string[]> {
    const chainId = options?.chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    try {
      const result = await execution<string[]>(`(list-namespaces)`)
        .withChainId(chainId)
        .withNetwork(networkConfig)
        .build()
        .dirtyRead();
      return result;
    } catch {
      // If list-namespaces is not available, return empty array
      return [];
    }
  }
}

/**
 * Create a namespace service instance with optional configuration
 */
export function createNamespaceService(config?: NamespaceServiceConfigDI): NamespaceServiceDI {
  return new NamespaceServiceDI(config);
}