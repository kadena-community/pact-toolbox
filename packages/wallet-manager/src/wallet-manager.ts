import type {
  Wallet,
  WalletProvider,
  WalletMetadata,
  ConnectOptions,
  AutoConnectOptions,
  WalletManagerEvents,
} from "@pact-toolbox/wallet-core";
import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { WalletError } from "@pact-toolbox/wallet-core";
import { EventEmitter, DisposableStore, isTestEnvironment, isBrowser, isLocalhost } from "@pact-toolbox/utils";

import {
  getPersistedWallet,
  persistWallet,
  clearPersistedWallet,
  saveWalletPreferences,
  getWalletPreferences,
} from "./persistence";

/**
 * Wallet manager configuration
 */
export interface WalletManagerConfig {
  /** wallet providers */
  providers?: Record<string, WalletProvider>;
  /** Show UI when connecting */
  enableWalletUI?: boolean;
  /** Theme settings */
  walletUItheme?: "light" | "dark" | "auto";
  /** Auto-connect on page load */
  autoConnect?: boolean;
  /** Remember last connected wallet */
  rememberLast?: boolean;
  /** Preferred wallet order */
  preferredOrder?: string[];
  /** Connection timeout */
  timeout?: number;
}

/**
 * Modern wallet manager with explicit provider registration
 */
export class WalletManager extends EventEmitter<WalletManagerEvents> {
  private static instance: WalletManager;

  // Provider management
  private providers = new Map<string, WalletProvider>();

  // Connection management
  private connectedWallets = new Map<string, Wallet>();
  private primaryWallet: Wallet | null = null;

  // State management
  private initialized = false;
  private disposed = false;
  private modalManager: any = null;
  private config: WalletManagerConfig;
  private disposables = new DisposableStore();

  // Auto-reconnection
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 1000;

  constructor(config: WalletManagerConfig = {}) {
    super();
    this.config = config;
    if (config.providers) {
      this.registerMultiple(config.providers);
    }
  }

  /**
   * Get singleton instance (optional - users can create their own instances)
   */
  static getInstance(config?: WalletManagerConfig): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager(config || {});
    }
    return WalletManager.instance;
  }

  /**
   * Auto-configure providers based on environment
   */
  private async autoConfigureProviders(): Promise<void> {
    // Test/Node environment: only keypair wallet (no UI)
    if (isTestEnvironment() || typeof window === "undefined") {
      const { KeypairWalletProvider } = await import("@pact-toolbox/wallet-core");
      this.providers.set("keypair", new KeypairWalletProvider());
      // Disable UI for test/headless environments
      this.config.enableWalletUI = false;
      return;
    }

    // Browser development environment: DevWallet + Keypair
    if (isBrowser() && isLocalhost()) {
      console.info("Auto-configuring DevWallet and Keypair wallet providers for development");
      const [{ KeypairWalletProvider }, { DevWalletProvider }] = await Promise.all([
        import("@pact-toolbox/wallet-core"),
        import("@pact-toolbox/dev-wallet"),
      ]);
      this.providers.set("keypair", new KeypairWalletProvider());
      this.providers.set("devwallet", new DevWalletProvider());
      return;
    }

    // Production browser: no auto-configuration
    // Users must explicitly register the wallets they want to support
  }

  /**
   * Register a wallet provider
   * @param id - Unique identifier for the wallet
   * @param provider - Wallet provider instance
   * @returns this for chaining
   */
  register(id: string, provider: WalletProvider): this {
    if (this.initialized) {
      throw new Error(
        "Cannot register providers after initialization. Register all providers before calling initialize().",
      );
    }

    if (this.providers.has(id)) {
      console.warn(`Wallet provider '${id}' is already registered. Overwriting...`);
    }

    this.providers.set(id, provider);
    return this;
  }

  /**
   * Register multiple providers at once
   */
  registerMultiple(providers: Record<string, WalletProvider>): this {
    for (const [id, provider] of Object.entries(providers)) {
      this.register(id, provider);
    }
    return this;
  }

  /**
   * Initialize the wallet manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Auto-configure based on environment if no providers registered
    if (this.providers.size === 0) {
      await this.autoConfigureProviders();
    }

    // Apply wallet preferences
    if (this.config) {
      const currentPrefs = getWalletPreferences();
      saveWalletPreferences({ ...currentPrefs, ...this.config });
    }

    // Set up auto-reconnection
    this.setupAutoReconnection();

    // Register globally for transaction package
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__PACT_WALLET_MANAGER__ = this;
    }

    // Initialize UI modal manager if enabled
    if (isBrowser() && !isTestEnvironment() && this.config.enableWalletUI !== false) {
      try {
        const { getDefaultModalManager } = await import("@pact-toolbox/wallet-ui");
        this.modalManager = getDefaultModalManager({
          theme: this.config.walletUItheme || "auto",
        });
        this.modalManager.initialize();
      } catch (error) {
        console.debug("Failed to initialize wallet UI (wallet-ui package not available):", error);
        // Gracefully handle when wallet-ui is not available
        this.config.enableWalletUI = false;
      }
    }

    this.initialized = true;
  }

  /**
   * Get all registered provider IDs
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get available wallets metadata
   */
  getAvailableWallets(): WalletMetadata[] {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.metadata.name,
      icon: provider.metadata.icon,
      description: provider.metadata.description,
      type: provider.metadata.type,
      features: provider.metadata.features,
    }));
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
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set primary wallet
   */
  setPrimaryWallet(walletOrId: Wallet | string): void {
    const wallet = typeof walletOrId === "string" ? this.connectedWallets.get(walletOrId) : walletOrId;

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

      // Try to show wallet selector UI if available
      if (this.modalManager && !options.silent && isBrowser()) {
        try {
          const selectedWalletId = await this.modalManager.showWalletSelector();
          if (selectedWalletId) {
            walletId = selectedWalletId === "auto" ? this.getRegisteredProviders()[0] : selectedWalletId;
          } else {
            throw WalletError.userRejected("Wallet selection cancelled");
          }
        } catch (error) {
          if (error instanceof WalletError) {
            throw error;
          }
          console.debug("Failed to show wallet selector:", error);
        }
      }

      // If still no wallet, throw error
      if (!walletId) {
        throw WalletError.notFound("No wallet specified. Provide a walletId or ensure a wallet is already connected.");
      }
    }

    // Check if already connected
    const existing = this.connectedWallets.get(walletId);
    if (existing && !options.force) {
      return existing;
    }

    // Get provider
    const provider = this.providers.get(walletId);
    if (!provider) {
      const available = this.getRegisteredProviders().join(", ");
      throw WalletError.notFound(`Wallet provider '${walletId}' not found. Available: ${available || "none"}`);
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
            setTimeout(() => reject(WalletError.timeout("Connection", options.timeout!)), options.timeout),
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
      const walletError =
        error instanceof WalletError
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
        return await this.connect({ ...options, walletId: persisted.lastWalletId, silent: true });
      } catch (error) {
        console.debug("Failed to auto-connect to persisted wallet:", error);
      }
    }

    // Try to connect to first available provider if fallback not disabled
    const fallbackDisabled = (options as any).fallback === false;
    if (!fallbackDisabled && this.providers.size > 0) {
      const firstProviderId = this.getRegisteredProviders()[0];
      try {
        return await this.connect({ ...options, walletId: firstProviderId, silent: true });
      } catch (error) {
        console.debug("Failed to auto-connect to first provider:", error);
      }
    }

    return null;
  }

  /**
   * Disconnect a wallet
   */
  async disconnect(walletId?: string): Promise<void> {
    const id = walletId || (this.primaryWallet?.id ?? Array.from(this.connectedWallets.keys())[0]);
    if (!id) {
      throw WalletError.notConnected("No wallet to disconnect");
    }

    const wallet = this.connectedWallets.get(id);
    if (!wallet) {
      throw WalletError.notConnected(id);
    }

    // Disconnect wallet
    await wallet.disconnect();

    // Remove from connected wallets
    this.connectedWallets.delete(id);

    // Clear primary if it was disconnected
    if (this.primaryWallet === wallet) {
      this.primaryWallet = this.connectedWallets.values().next().value || null;
    }

    // Clear persisted if it was disconnected
    const persisted = getPersistedWallet();
    if (persisted?.lastWalletId === id) {
      clearPersistedWallet();
    }

    // Emit event
    this.emit("disconnected", id);
  }

  /**
   * Sign a transaction
   */
  async sign(transaction: PartiallySignedTransaction): Promise<SignedTransaction> {
    const wallet = this.primaryWallet;
    if (!wallet) {
      throw WalletError.notConnected("No wallet connected");
    }

    return wallet.sign(transaction);
  }

  /**
   * Set up auto-reconnection logic
   */
  private setupAutoReconnection(): void {
    this.on("disconnected", async (walletId) => {
      const persisted = getPersistedWallet();
      if (persisted?.lastWalletId === walletId && persisted.autoConnect !== false) {
        this.scheduleReconnect(walletId);
      }
    });

    this.on("connected", () => {
      this.clearReconnection();
    });
  }

  private scheduleReconnect(walletId: string): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit(
          "error",
          WalletError.connectionFailed(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`),
        );
        this.clearReconnection();
        return;
      }

      this.reconnectAttempts++;

      try {
        await this.connect({ walletId, silent: true });
        this.clearReconnection();
      } catch {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = undefined;
          this.scheduleReconnect(walletId);
        }, delay);
      }
    }, this.reconnectDelay);
  }

  private clearReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Disconnect all wallets
    for (const walletId of this.connectedWallets.keys()) {
      await this.disconnect(walletId).catch(console.error);
    }

    // Clear timers
    this.clearReconnection();

    // Clear persistence
    clearPersistedWallet();

    // Dispose resources
    await this.disposables.dispose();

    this.disposed = true;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static reset(): void {
    if (WalletManager.instance) {
      WalletManager.instance.dispose();
      WalletManager.instance = undefined as any;
    }
  }
}

/**
 * Create and setup a wallet manager with providers
 */
export async function setupWalletManager(config: WalletManagerConfig = {}): Promise<WalletManager> {
  const manager = WalletManager.getInstance(config);
  await manager.initialize();
  return manager;
}
