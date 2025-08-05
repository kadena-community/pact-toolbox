import type { WalletProvider } from "@pact-toolbox/wallet-core";
import { isBrowser, isTestEnvironment } from "./environment";
import { register, resolve } from "@pact-toolbox/utils";
import { TOKENS } from "@pact-toolbox/types";

/**
 * Wallet provider factory function
 */
export type WalletProviderFactory = () => Promise<WalletProvider> | WalletProvider;

/**
 * Wallet provider constructor
 */
export interface WalletProviderConstructor {
  new (...args: any[]): WalletProvider;
  id: string;
  autoRegister?: boolean;
  priority?: number;
}

/**
 * Registry for wallet providers with auto-registration support
 */
export class WalletRegistry {
  private static providers = new Map<string, WalletProviderFactory>();
  private static initialized = false;
  
  // Register self in DI container on first use
  private static ensureRegistered() {
    try {
      resolve(TOKENS.WalletRegistry);
    } catch {
      // Not registered yet, register now
      register(TOKENS.WalletRegistry, {
        register: this.register.bind(this),
        get: (name: string) => this.providers.get(name),
        list: () => this.getProviderIds()
      });
    }
  }

  /**
   * Register a wallet provider factory
   */
  static register(id: string, factory: WalletProviderFactory): void {
    this.ensureRegistered();
    this.providers.set(id, factory);
  }

  /**
   * Register a provider class with auto-registration support
   */
  static registerClass(ProviderClass: WalletProviderConstructor): void {
    if (ProviderClass.autoRegister && isBrowser() && !isTestEnvironment()) {
      // Auto-register in browser environment (not in tests)
      this.register(ProviderClass.id, () => new ProviderClass());
      // Auto-registration happens during initialize()
    }
  }

  /**
   * Initialize wallet providers
   */
  static async initialize(walletIds?: string[], config?: Record<string, any>): Promise<WalletProvider[]> {
    this.initialized = true;
    const ids = walletIds || Array.from(this.providers.keys());
    
    const loadPromises = ids.map(id => this.loadProvider(id, config?.[id]));
    const results = await Promise.allSettled(loadPromises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<WalletProvider> => 
        result.status === 'fulfilled' && result.value !== undefined
      )
      .map(result => result.value);
  }

  /**
   * Load a specific provider
   */
  private static async loadProvider(id: string, config?: any): Promise<WalletProvider | undefined> {
    const factory = this.providers.get(id);
    if (!factory) return undefined;

    try {
      const provider = await factory();
      
      // Apply config if provided
      if (config && "configure" in provider && typeof provider.configure === "function") {
        await provider.configure(config);
      }
      
      return provider;
    } catch (error) {
      console.debug(`Failed to load wallet provider ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Get all registered provider IDs
   */
  static getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  static has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Clear all registered providers
   */
  static clear(): void {
    this.providers.clear();
    this.initialized = false;
  }
}

// Always register keypair wallet (works in all environments)
WalletRegistry.register("keypair", async () => {
  const { KeypairWalletProvider } = await import("./providers/keypair");
  return new KeypairWalletProvider();
});

// Only register browser wallets in browser environment (not in test or Node.js)
if (isBrowser() && !isTestEnvironment()) {
  WalletRegistry.register("ecko", async () => {
    const { EckoWalletProvider } = await import("./providers/ecko");
    return new EckoWalletProvider();
  });

  WalletRegistry.register("chainweaver", async () => {
    const { ChainweaverWalletProvider } = await import("./providers/chainweaver");
    return new ChainweaverWalletProvider();
  });

  WalletRegistry.register("zelcore", async () => {
    const { ZelcoreWalletProvider } = await import("./providers/zelcore");
    return new ZelcoreWalletProvider();
  });

  // WalletConnect and Magic require configuration
  WalletRegistry.register("walletconnect", async () => {
    const { WalletConnectProvider } = await import("./providers/walletconnect");
    return new WalletConnectProvider({} as any); // Config will be applied later
  });

  WalletRegistry.register("magic", async () => {
    const { MagicWalletProvider } = await import("./providers/magic");
    return new MagicWalletProvider({} as any); // Config will be applied later
  });
}