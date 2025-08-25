import type {
  Wallet,
  WalletProvider,
  WalletMetadata,
  ConnectOptions,
  AutoConnectOptions,
  WalletEvents,
} from "@pact-toolbox/wallet-core";
import type {
  PartiallySignedTransaction,
  SignedTransaction,
} from "@pact-toolbox/types";
import { WalletError } from "@pact-toolbox/wallet-core";
import { EventEmitter, DisposableStore } from "@pact-toolbox/utils";
import {
  getPersistedWallet,
  persistWallet,
  clearPersistedWallet,
  saveWalletPreferences,
  getWalletPreferences,
} from "./persistence";
import type { WalletConfig } from "./config";
import { isTestEnvironment, isBrowser } from "./environment";

/**
 * Wallet provider factory function
 */
export type WalletProviderFactory = () => Promise<WalletProvider> | WalletProvider;

/**
 * Unified wallet manager that handles both provider registration and wallet connections
 * Combines the functionality of WalletRegistry and WalletSystem into a single, simpler API
 */
export class WalletManager extends EventEmitter<WalletEvents> {
  private static instance: WalletManager;
  
  // Provider management (registry)
  private providers = new Map<string, WalletProviderFactory>();
  private initializedProviders = new Map<string, WalletProvider>();
  
  // Connection management (system)
  private connectedWallets = new Map<string, Wallet>();
  private primaryWallet: Wallet | null = null;
  
  // State management
  private initialized = false;
  
  get isInitialized(): boolean {
    return this.initialized;
  }
  private disposed = false;
  private config: WalletConfig;
  private disposables = new DisposableStore();
  
  // Auto-reconnection
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;

  static getInstance(config: WalletConfig = {}): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager(config);
    }
    return WalletManager.instance;
  }

  constructor(config: WalletConfig = {}) {
    super();
    this.config = config;
    this.registerBuiltInProviders();
  }

  /**
   * Register built-in wallet providers
   */
  private registerBuiltInProviders(): void {
    // Always register keypair wallet (works everywhere)
    this.register("keypair", async () => {
      const { KeypairWalletProvider } = await import("./providers/keypair");
      return new KeypairWalletProvider();
    });

    // Register browser wallets only in browser environment
    if (isBrowser() && !isTestEnvironment()) {
      this.register("ecko", async () => {
        const { EckoWalletProvider } = await import("./providers/ecko");
        return new EckoWalletProvider();
      });

      this.register("chainweaver", async () => {
        const { ChainweaverWalletProvider } = await import("./providers/chainweaver");
        return new ChainweaverWalletProvider();
      });

      this.register("zelcore", async () => {
        const { ZelcoreWalletProvider } = await import("./providers/zelcore");
        return new ZelcoreWalletProvider();
      });

      // WalletConnect and Magic require configuration
      this.register("walletconnect", async () => {
        const { WalletConnectProvider } = await import("./providers/walletconnect");
        const config = this.config.wallets?.walletconnect;
        if (typeof config === "object" && config) {
          return new WalletConnectProvider(config);
        }
        return new WalletConnectProvider({} as any);
      });

      this.register("magic", async () => {
        const { MagicWalletProvider } = await import("./providers/magic");
        const config = this.config.wallets?.magic;
        if (typeof config === "object" && config) {
          return new MagicWalletProvider(config);
        }
        return new MagicWalletProvider({} as any);
      });
    }
  }

  /**
   * Register a wallet provider
   */
  register(id: string, factory: WalletProviderFactory): void {
    this.providers.set(id, factory);
  }

  /**
   * Initialize the wallet manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Apply wallet preferences
    if (this.config.preferences) {
      const currentPrefs = getWalletPreferences();
      saveWalletPreferences({ ...currentPrefs, ...this.config.preferences });
    }

    // Determine which providers to initialize
    let providerIds: string[] = [];
    let walletConfigs: Record<string, any> = {};

    if (isTestEnvironment()) {
      // Test environment: only keypair wallet
      providerIds = ["keypair"];
      walletConfigs = {
        keypair: {
          deterministic: true,
          accountName: "test-account",
          privateKey: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      };
    } else if (this.config.wallets) {
      // Normal configuration
      for (const [key, value] of Object.entries(this.config.wallets)) {
        if (value !== false) {
          providerIds.push(key);
          if (typeof value === "object") {
            walletConfigs[key] = value;
          }
        }
      }
    } else {
      // Default: all registered providers
      providerIds = Array.from(this.providers.keys());
    }

    // Initialize selected providers
    await this.initializeProviders(providerIds, walletConfigs);

    // Set up auto-reconnection (always enabled for now)
    this.setupAutoReconnection();

    this.initialized = true;
  }

  /**
   * Initialize specific providers
   */
  private async initializeProviders(ids: string[], configs: Record<string, any>): Promise<void> {
    const loadPromises = ids.map(async (id) => {
      const factory = this.providers.get(id);
      if (!factory) return;

      try {
        const provider = await factory();
        
        // Apply configuration if provider supports it
        if (configs[id] && "configure" in provider && typeof provider.configure === "function") {
          await provider.configure(configs[id]);
        }

        this.initializedProviders.set(id, provider);
      } catch (error) {
        console.debug(`Failed to initialize provider ${id}:`, error);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  /**
   * Set up auto-reconnection logic
   */
  private setupAutoReconnection(): void {
    // Listen for disconnection events
    this.on("disconnected", async (walletId) => {
      
      // Only auto-reconnect if it was the primary wallet
      const persisted = getPersistedWallet();
      if (persisted?.lastWalletId === walletId && persisted.autoConnect !== false) {
        this.scheduleReconnect(walletId);
      }
    });

    // Clear reconnection on successful connection
    this.on("connected", () => {
      this.clearReconnection();
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(walletId: string): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit("error", WalletError.connectionFailed(
          `Failed to reconnect after ${this.maxReconnectAttempts} attempts`
        ));
        this.clearReconnection();
        return;
      }

      this.reconnectAttempts++;
      
      try {
        await this.connect({ walletId, silent: true });
        this.clearReconnection();
      } catch (error) {
        // Schedule next attempt with exponential backoff
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = undefined;
          this.scheduleReconnect(walletId);
        }, delay);
      }
    }, this.reconnectDelay);
  }

  /**
   * Clear reconnection state
   */
  private clearReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Get available providers
   */
  getProviders(): WalletProvider[] {
    return Array.from(this.initializedProviders.values());
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): WalletProvider | undefined {
    return this.initializedProviders.get(id);
  }

  /**
   * Get available wallet metadata
   */
  getAvailableWallets(): WalletMetadata[] {
    return this.getProviders().map((p) => p.metadata);
  }

  /**
   * Get connected wallets
   */
  getConnectedWallets(): Wallet[] {
    return Array.from(this.connectedWallets.values());
  }

  /**
   * Get primary wallet
   */
  getPrimaryWallet(): Wallet | null {
    return this.primaryWallet;
  }

  /**
   * Set primary wallet
   */
  setPrimaryWallet(walletOrId: Wallet | string): void {
    const wallet = typeof walletOrId === "string"
      ? this.connectedWallets.get(walletOrId)
      : walletOrId;

    if (!wallet) {
      throw WalletError.notConnected(typeof walletOrId === "string" ? walletOrId : "wallet");
    }

    // Verify wallet is connected
    const isConnected = Array.from(this.connectedWallets.values()).includes(wallet);
    if (!isConnected) {
      throw WalletError.notConnected("wallet");
    }

    this.primaryWallet = wallet;
    this.emit("primaryWalletChanged", wallet);
  }

  /**
   * Connect to a wallet
   */
  async connect(options: ConnectOptions = {}): Promise<Wallet> {
    await this.initialize();

    let walletId = options.walletId;

    // Auto-connect logic if no wallet specified
    if (!walletId) {
      const autoConnectResult = await this.autoConnect(options);
      if (autoConnectResult) {
        return autoConnectResult;
      }

      // No auto-connect possible
      throw WalletError.notFound(
        "No wallet specified. Provide a walletId or ensure a wallet is already connected."
      );
    }

    // Check if already connected
    const existing = this.connectedWallets.get(walletId);
    if (existing && !options.force) {
      return existing;
    }

    // Get provider
    const provider = this.initializedProviders.get(walletId);
    if (!provider) {
      const available = Array.from(this.initializedProviders.keys()).join(", ");
      throw WalletError.notFound(
        `Wallet provider '${walletId}' not found. Available: ${available || "none"}`
      );
    }

    try {
      // Create and connect wallet
      const wallet = await provider.createWallet();
      
      // Set wallet ID
      if (!wallet.id) {
        (wallet as { id?: string }).id = walletId;
      }

      // Connect with timeout
      const connectPromise = wallet.connect(options.networkId);
      const timeoutPromise = options.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(WalletError.timeout("Connection", options.timeout!)), options.timeout)
          )
        : null;

      await (timeoutPromise ? Promise.race([connectPromise, timeoutPromise]) : connectPromise);

      // Store connected wallet
      this.connectedWallets.set(walletId, wallet);

      // Set as primary if first wallet
      if (!this.primaryWallet) {
        this.primaryWallet = wallet;
      }

      // Persist connection
      persistWallet(walletId);

      // Emit event
      this.emit("connected", wallet);

      return wallet;
    } catch (error) {
      const walletError = error instanceof WalletError
        ? error
        : WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
      
      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Auto-connect to best available wallet
   */
  private async autoConnect(options: AutoConnectOptions = {}): Promise<Wallet | null> {
    // Check persisted wallet
    const persisted = getPersistedWallet();
    if (persisted?.lastWalletId && persisted.autoConnect !== false) {
      try {
        const provider = this.initializedProviders.get(persisted.lastWalletId);
        if (provider && await provider.isAvailable()) {
          return await this.connect({ ...options, walletId: persisted.lastWalletId, silent: true });
        }
      } catch (error) {
        console.debug("Failed to auto-connect persisted wallet:", error);
      }
    }

    // Try injected wallets by priority
    const injectedProviders = this.getProviders()
      .filter((p) => p.metadata.type === "browser-extension")
      .sort((a, b) => {
        // Sort by type priority: browser-extension > mobile > hardware > others
        const typePriority: Record<string, number> = {
          "browser-extension": 3,
          "mobile": 2,
          "hardware": 1,
          "built-in": 0,
          "desktop": 0,
          "web": 0,
        };
        return (typePriority[b.metadata.type] || 0) - (typePriority[a.metadata.type] || 0);
      });

    for (const provider of injectedProviders) {
      try {
        if (await provider.isAvailable()) {
          return await this.connect({ ...options, walletId: provider.metadata.id, silent: true });
        }
      } catch (error) {
        console.debug(`Failed to auto-connect ${provider.metadata.id}:`, error);
      }
    }

    return null;
  }

  /**
   * Disconnect a wallet
   */
  async disconnect(walletId?: string): Promise<void> {
    // Default to primary wallet
    if (!walletId && this.primaryWallet) {
      for (const [id, wallet] of this.connectedWallets) {
        if (wallet === this.primaryWallet) {
          walletId = id;
          break;
        }
      }
    }

    if (!walletId) {
      throw WalletError.notConnected("No wallet to disconnect");
    }

    const wallet = this.connectedWallets.get(walletId);
    if (!wallet) {
      throw WalletError.notConnected(walletId);
    }

    try {
      await wallet.disconnect();
      
      this.connectedWallets.delete(walletId);
      
      if (wallet === this.primaryWallet) {
        this.primaryWallet = null;
        this.emit("primaryWalletChanged", null);
      }

      if (this.connectedWallets.size === 0) {
        clearPersistedWallet();
      }

      this.emit("disconnected", walletId);
    } catch (error) {
      const walletError = WalletError.unknown(
        `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Sign transaction(s) with primary wallet
   */
  async sign(transaction: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(transactions: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    transactions: PartiallySignedTransaction | PartiallySignedTransaction[]
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.primaryWallet) {
      throw WalletError.notConnected("No primary wallet");
    }

    try {
      return Array.isArray(transactions)
        ? await this.primaryWallet.sign(transactions)
        : await this.primaryWallet.sign(transactions);
    } catch (error) {
      const walletError = WalletError.signingFailed(
        error instanceof Error ? error.message : String(error)
      );
      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Cleanup all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Clear reconnection
    this.clearReconnection();

    // Disconnect all wallets
    for (const wallet of this.connectedWallets.values()) {
      try {
        await wallet.disconnect();
      } catch (error) {
        console.error("Error disconnecting wallet:", error);
      }
    }

    // Clear state
    this.connectedWallets.clear();
    this.initializedProviders.clear();
    this.providers.clear();
    this.primaryWallet = null;

    // Clear persistence
    clearPersistedWallet();

    // Dispose resources
    await this.disposables.dispose();

    this.disposed = true;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    if (WalletManager.instance) {
      WalletManager.instance.dispose();
      WalletManager.instance = undefined as any;
    }
  }
}

/**
 * Get wallet manager instance
 */
export async function getWalletManager(config: WalletConfig = {}): Promise<WalletManager> {
  const manager = WalletManager.getInstance(config);
  if (!manager.initialized) {
    await manager.initialize();
  }
  return manager;
}

/**
 * Get connected wallet or connect to one
 */
export async function getWallet(options: ConnectOptions = {}): Promise<Wallet> {
  const manager = await getWalletManager();
  
  // Return primary wallet if available
  const primary = manager.getPrimaryWallet();
  if (primary && !options.force) {
    return primary;
  }
  
  // Connect to wallet
  return manager.connect(options);
}