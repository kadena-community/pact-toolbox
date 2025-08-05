import { EventEmitter, resolve, register, DisposableStore } from "@pact-toolbox/utils";
import type { PartiallySignedTransaction, SignedTransaction, TOKENS } from "@pact-toolbox/types";
import type {
  Wallet,
  WalletProvider,
  WalletMetadata,
  ConnectOptions,
  AutoConnectOptions,
  WalletEvents,
} from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";

// Type for ModalManager (optional dependency)
interface ModalManagerLike {
  showWalletSelector(): Promise<string | null>;
}
import { WalletRegistry } from "./wallet-registry";
import {
  getPersistedWallet,
  persistWallet,
  clearPersistedWallet,
  saveWalletPreferences,
  getWalletPreferences,
} from "./persistence";
import type { TypeSafeWalletConfig } from "./config";
import { isTestEnvironment, isBrowser } from "./environment";

// Dynamic import for UI components (browser-only)
let ModalManager: any;

/**
 * Unified wallet system that combines registry and manager functionality
 */
export class WalletSystem extends EventEmitter<WalletEvents> {
  private initialized = false;
  private config: TypeSafeWalletConfig;
  private modalManager?: ModalManagerLike;
  private providers = new Map<string, WalletProvider>();
  private connectedWallets = new Map<string, Wallet>();
  private primaryWallet: Wallet | null = null;
  private disposables = new DisposableStore();
  private disposed = false;

  constructor(config: TypeSafeWalletConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Initialize the wallet system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Apply wallet preferences
    if (this.config.preferences) {
      const currentPrefs = getWalletPreferences();
      saveWalletPreferences({ ...currentPrefs, ...this.config.preferences });
    }

    // In test environment, only use keypair wallet
    let providers: string[] = [];
    let walletConfigs: Record<string, any> = {};

    if (isTestEnvironment()) {
      // Force keypair wallet only in test environment
      providers = ["keypair"];
      walletConfigs = {
        keypair: {
          deterministic: true,
          accountName: "test-account",
          // Use fixed private key for consistent keys in tests
          privateKey: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      };
    } else if (this.config.wallets) {
      // Normal wallet configuration
      for (const [key, value] of Object.entries(this.config.wallets)) {
        if (value !== false) {
          providers.push(key);
          if (typeof value === "object") {
            walletConfigs[key] = value;
          }
        }
      }
    }

    // Initialize providers
    const providerIds = providers.length > 0 ? providers : WalletRegistry.getProviderIds();
    const initializedProviders = await WalletRegistry.initialize(providerIds, walletConfigs);

    // Register providers in this system
    for (const provider of initializedProviders) {
      this.providers.set(provider.metadata.id, provider);
    }

    // Initialize UI if in browser and not in test environment
    if (isBrowser() && !isTestEnvironment() && this.config.ui?.showOnConnect !== false) {
      try {
        const { ModalManager: MM } = await import("@pact-toolbox/wallet-ui" as string);
        ModalManager = MM;
        this.modalManager = ModalManager.getInstance();
      } catch (error) {
        console.debug("Wallet UI not available:", error);
      }
    }

    this.initialized = true;
  }

  /**
   * Get available wallet providers
   */
  getProviders(): WalletProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): WalletProvider | undefined {
    return this.providers.get(id);
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
    if (typeof walletOrId === "string") {
      const wallet = this.connectedWallets.get(walletOrId);
      if (!wallet) {
        throw WalletError.notConnected(walletOrId);
      }
      this.primaryWallet = wallet;
    } else {
      // Verify the wallet is connected
      let found = false;
      for (const wallet of this.connectedWallets.values()) {
        if (wallet === walletOrId) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw WalletError.notConnected("wallet");
      }
      this.primaryWallet = walletOrId;
    }

    // Emit event
    this.emit("primaryChanged", this.primaryWallet);
  }

  /**
   * Connect to a wallet
   */
  async connect(options: ConnectOptions = {}): Promise<Wallet> {
    await this.initialize();

    // Determine which wallet to connect
    let walletId: string | undefined = options.walletId;

    if (!walletId) {
      // If no wallet specified, try auto-connect
      const autoConnectResult = await this.autoConnectWallet(options);
      if (autoConnectResult) {
        return autoConnectResult;
      }

      // If auto-connect didn't work and we have UI, show selector
      if (this.modalManager && !options.silent) {
        walletId = (await this.modalManager.showWalletSelector()) || undefined;
        if (!walletId) {
          throw WalletError.userRejected("No wallet selected");
        }
      } else {
        throw WalletError.notFound(
          "No wallet specified and no UI available. " +
            "Either provide a walletId in options, enable UI, or ensure a wallet is already connected.",
        );
      }
    }

    // Get the provider
    const provider = this.providers.get(walletId);
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(", ");
      throw WalletError.notFound(
        `Wallet provider '${walletId}' not found. Available wallets: ${available || "none"}. ` +
          `Make sure the wallet is properly configured in setupWalletDI().`,
      );
    }

    // Check if already connected
    const existing = this.connectedWallets.get(walletId);
    if (existing) {
      return existing;
    }

    try {
      // Create wallet instance
      const wallet = provider.createWallet();

      // Assign wallet ID if not already set
      if (!wallet.id) {
        // Type assertion is necessary here since we're setting an optional readonly property
        (wallet as { id?: string }).id = walletId;
      }

      // Apply timeout if specified
      const connectPromise = wallet.connect(options.networkId);
      const timeoutPromise = options.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(WalletError.timeout("Connection", options.timeout!)), options.timeout),
          )
        : null;

      await (timeoutPromise ? Promise.race([connectPromise, timeoutPromise]) : connectPromise);

      // Store connected wallet
      this.connectedWallets.set(walletId, wallet);

      // Set as primary if it's the first wallet
      if (!this.primaryWallet) {
        this.primaryWallet = wallet;
      }

      // Persist wallet connection
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
   * Auto-connect to the best available wallet
   */
  private async autoConnectWallet(options: AutoConnectOptions = {}): Promise<Wallet> {
    try {
      // Check for persisted wallet first
      const persisted = getPersistedWallet();
      if (persisted?.lastWalletId && persisted.autoConnect !== false) {
        try {
          const provider = this.providers.get(persisted.lastWalletId);
          if (provider && provider.isAvailable()) {
            return await this.connect({ ...options, walletId: persisted.lastWalletId, silent: true });
          }
        } catch (error) {
          console.debug("Failed to auto-connect persisted wallet:", error);
        }
      }

      // Try injected wallets by priority
      const injectedProviders = this.getProviders()
        .filter((p) => p.metadata.type === "injected" && p.isAvailable())
        .sort((a, b) => (b.metadata.priority || 0) - (a.metadata.priority || 0));

      for (const provider of injectedProviders) {
        try {
          return await this.connect({ ...options, walletId: provider.metadata.id, silent: true });
        } catch (error) {
          console.debug(`Failed to auto-connect ${provider.metadata.id}:`, error);
        }
      }

      // No wallet could be auto-connected
      throw WalletError.notFound("No wallet available for auto-connect");
    } catch (error) {
      if (options.fallbackToManual && this.modalManager) {
        const walletId = await this.modalManager.showWalletSelector();
        if (walletId) {
          return await this.connect({ ...options, walletId });
        }
      }
      throw error;
    }
  }

  /**
   * Disconnect a wallet
   */
  async disconnect(walletId?: string): Promise<void> {
    // If no ID provided, disconnect primary wallet
    if (!walletId) {
      if (!this.primaryWallet) {
        throw WalletError.notConnected("primary");
      }
      walletId = this.getPrimaryWalletId();
      if (!walletId) {
        throw WalletError.notFound("Could not determine primary wallet ID");
      }
    }

    const wallet = this.connectedWallets.get(walletId);
    if (!wallet) {
      throw WalletError.notConnected(walletId);
    }

    try {
      // Disconnect the wallet
      await wallet.disconnect();

      // Remove from connected wallets
      this.connectedWallets.delete(walletId);

      // If this was the primary wallet, clear it
      if (wallet === this.primaryWallet) {
        this.primaryWallet = null;
        this.emit("primaryChanged", null);
      }

      // Clear persistence if this was the last wallet
      if (this.connectedWallets.size === 0) {
        clearPersistedWallet();
      }

      // Emit event
      this.emit("disconnected", walletId);
    } catch (error) {
      const walletError = WalletError.unknown(
        `Failed to disconnect wallet: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Get primary wallet ID
   */
  private getPrimaryWalletId(): string | undefined {
    if (!this.primaryWallet) return undefined;

    // Find the ID for the primary wallet
    for (const [id, wallet] of this.connectedWallets) {
      if (wallet === this.primaryWallet) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Sign transaction(s) with primary wallet
   */
  async sign(transaction: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(transactions: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    transactions: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.primaryWallet) {
      throw WalletError.notConnected("primary");
    }

    try {
      if (Array.isArray(transactions)) {
        return await this.primaryWallet.sign(transactions);
      } else {
        return await this.primaryWallet.sign(transactions);
      }
    } catch (error) {
      const walletError = WalletError.signingFailed(error instanceof Error ? error.message : String(error));
      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    if (this.disposed) {
      return;
    }

    // Disconnect all wallets
    for (const wallet of this.connectedWallets.values()) {
      try {
        await wallet.disconnect();
      } catch (error) {
        console.error("Error disconnecting wallet:", error);
      }
    }

    // Clear collections
    this.connectedWallets.clear();
    this.providers.clear();
    this.primaryWallet = null;

    // Clear persisted state
    clearPersistedWallet();

    // Dispose tracked resources
    await this.disposables.dispose();

    this.disposed = true;
  }

  /**
   * Dispose the wallet system
   */
  async dispose(): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Create a new wallet system instance
 */
export async function createWalletSystem(config?: TypeSafeWalletConfig): Promise<WalletSystem> {
  const system = new WalletSystem(config);
  await system.initialize();
  return system;
}

/**
 * Get the wallet system from DI container
 *
 * This function gets the wallet system from the DI container.
 * If not found, it creates a new instance and registers it.
 */
export async function getWalletSystem(config?: TypeSafeWalletConfig): Promise<WalletSystem> {
  try {
    // Try to get from DI container first
    return resolve(TOKENS.WalletSystem) as WalletSystem;
  } catch {
    // Create new instance and register it
    const system = await createWalletSystem(config);

    try {
      register(TOKENS.WalletSystem, system);
    } catch {
      // Ignore if registration fails
    }

    return system;
  }
}
