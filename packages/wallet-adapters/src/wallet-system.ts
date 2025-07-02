import { EventEmitter } from "@pact-toolbox/utils";
import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type { 
  Wallet, 
  WalletProvider, 
  WalletMetadata, 
  ConnectOptions, 
  AutoConnectOptions,
  WalletEvents 
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
  type WalletPreferences, 
  saveWalletPreferences, 
  getWalletPreferences 
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
        }
      };
    } else if (this.config.wallets) {
      // Normal wallet configuration
      for (const [key, value] of Object.entries(this.config.wallets)) {
        if (value !== false) {
          providers.push(key);
          if (typeof value === 'object') {
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
      } catch (_error) {
        // UI package not available, continue without UI
        console.debug("Wallet UI not available, continuing without modal support");
      }
    }

    this.initialized = true;
  }

  /**
   * Connect to a wallet
   * - No parameters: Shows UI selector
   * - String parameter: Connects to specific wallet
   * - Options parameter: Advanced control
   */
  async connect(walletIdOrOptions?: string | ConnectOptions & { walletId?: string }): Promise<Wallet> {
    await this.ensureInitialized();

    // Handle different parameter types
    if (typeof walletIdOrOptions === "string") {
      // Direct connection to specific wallet
      return this.connectWallet(walletIdOrOptions);
    }

    const options = walletIdOrOptions || {};
    
    // If wallet ID provided in options, connect directly
    if (options.walletId) {
      return this.connectWallet(options.walletId, options);
    }

    // In test environment, always use keypair
    if (isTestEnvironment()) {
      return this.connectWallet("keypair", options);
    }
    
    // Otherwise show UI selector if available
    if (this.modalManager) {
      const selectedId = await this.modalManager.showWalletSelector();
      if (!selectedId) {
        throw new Error("No wallet selected");
      }
      return this.connectWallet(selectedId, options);
    }

    // No UI available, try auto-connect
    return this.autoConnect();
  }

  /**
   * Ensure a wallet is connected (get existing or connect new)
   */
  async ensure(options?: ConnectOptions): Promise<Wallet> {
    await this.ensureInitialized();

    // Check if already connected
    if (this.primaryWallet) {
      return this.primaryWallet;
    }

    // Try to connect
    return this.connect(options);
  }

  /**
   * Auto-connect to the best available wallet
   */
  async autoConnect(options?: AutoConnectOptions): Promise<Wallet> {
    await this.ensureInitialized();

    const preferences = getWalletPreferences();
    const mergedOptions: AutoConnectOptions = {
      preferredWallets: preferences.preferredOrder,
      ...options,
    };

    return this.autoConnectWallet(mergedOptions);
  }

  /**
   * Disconnect wallet(s)
   */
  async disconnect(walletId?: string): Promise<void> {
    if (walletId) {
      await this.disconnectWallet(walletId);
    } else {
      // Disconnect all
      const walletIds = Array.from(this.connectedWallets.keys());
      for (const id of walletIds) {
        await this.disconnectWallet(id);
      }
    }
  }

  /**
   * Get available wallets
   */
  async getAvailable(): Promise<WalletMetadata[]> {
    await this.ensureInitialized();
    const providers = Array.from(this.providers.values());
    const availabilityChecks = await Promise.all(
      providers.map(async (provider) => ({
        provider,
        isAvailable: await provider.isAvailable().catch(() => false),
      })),
    );

    return availabilityChecks.filter(({ isAvailable }) => isAvailable).map(({ provider }) => provider.metadata);
  }

  /**
   * Get connected wallets
   */
  getConnected(): Wallet[] {
    return Array.from(this.connectedWallets.values());
  }

  /**
   * Get primary wallet
   */
  getPrimary(): Wallet | null {
    return this.primaryWallet;
  }

  /**
   * Set primary wallet
   */
  setPrimary(wallet: Wallet): void {
    if (wallet && !Array.from(this.connectedWallets.values()).includes(wallet)) {
      throw new Error("Cannot set disconnected wallet as primary");
    }
    this.primaryWallet = wallet;
  }

  /**
   * Subscribe to wallet events (inherited from EventEmitter)
   */

  /**
   * Get connection status
   */
  getStatus() {
    const primaryWalletId = this.getPrimaryWalletId();
    return {
      connected: this.connectedWallets.size > 0,
      primaryWalletId,
      connectedWallets: Array.from(this.connectedWallets.keys()),
    };
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<WalletPreferences>): void {
    const current = getWalletPreferences();
    saveWalletPreferences({ ...current, ...preferences });
  }

  /**
   * Ensure system is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Connect to a specific wallet
   */
  private async connectWallet(walletId: string, options: ConnectOptions = {}): Promise<Wallet> {
    try {
      // Check if already connected and not forcing reconnection
      if (!options.force && this.connectedWallets.has(walletId)) {
        const wallet = this.connectedWallets.get(walletId)!;
        const isConnected = await wallet.isConnected(options.networkId);
        if (isConnected) {
          return wallet;
        }
      }

      // Get provider
      const provider = this.providers.get(walletId);
      if (!provider) {
        throw WalletError.notFound(walletId);
      }

      // Check availability
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw WalletError.notFound(walletId);
      }

      // Create and connect wallet
      const wallet = await provider.createWallet();
      
      // Set wallet ID if not already set - this is safe since id is optional
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
          if (provider && await provider.isAvailable()) {
            return await this.connectWallet(persisted.lastWalletId, options);
          }
        } catch {
          // Continue to other options if persisted wallet fails
        }
      }

      // In test environment, only use keypair
      if (isTestEnvironment()) {
        return await this.connectWallet("keypair", options);
      }
      
      // For auto-connect, prioritize keypair wallet for development
      const providers = Array.from(this.providers.values());
      let preferredOrder = options.preferredWallets || ["keypair"];

      // Try preferred wallets first
      const errors: Error[] = [];

      for (const walletId of preferredOrder) {
        const provider = this.providers.get(walletId);
        if (!provider) continue;

        try {
          // Only check availability for non-keypair wallets to avoid connection errors
          if (walletId !== "keypair") {
            const isAvailable = await provider.isAvailable();
            if (!isAvailable) continue;
          }

          return await this.connectWallet(walletId, options);
        } catch (error) {
          errors.push(error as Error);
          if (!options.skipUnavailable) {
            throw error;
          }
        }
      }

      // If preferred wallets failed, try others (except those that might cause connection errors)
      const skipWallets = new Set(["chainweaver", "zelcore"]); // Skip wallets that try to connect to localhost ports
      const remainingProviders = providers.filter(
        (p) => !preferredOrder.includes(p.metadata.id) && !skipWallets.has(p.metadata.id),
      );

      for (const provider of remainingProviders) {
        try {
          const isAvailable = await provider.isAvailable();
          if (!isAvailable) continue;

          return await this.connectWallet(provider.metadata.id, options);
        } catch (error) {
          errors.push(error as Error);
          if (!options.skipUnavailable) {
            throw error;
          }
        }
      }

      // All wallets failed
      throw WalletError.connectionFailed(
        `Failed to connect to any wallet. Errors: ${errors.map((e) => e.message).join(", ")}`,
      );
    } catch (error) {
      const walletError = error instanceof WalletError ? error : WalletError.unknown("Auto-connect failed", error);

      this.emit("error", walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect a wallet
   */
  private async disconnectWallet(walletId: string): Promise<void> {
    try {
      const wallet = this.connectedWallets.get(walletId);
      if (!wallet) {
        return; // Already disconnected
      }

      // Disconnect wallet
      await wallet.disconnect();

      // Remove from connected wallets
      this.connectedWallets.delete(walletId);

      // Update primary wallet if needed
      if (this.primaryWallet === wallet) {
        const remaining = Array.from(this.connectedWallets.values());
        this.primaryWallet = remaining[0] || null;
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
}

/**
 * Create a wallet system instance
 */
export async function createWalletSystem(config?: TypeSafeWalletConfig): Promise<WalletSystem> {
  const system = new WalletSystem(config);
  await system.initialize();
  return system;
}

/**
 * Default wallet system instance (singleton)
 */
let defaultSystem: WalletSystem | null = null;

/**
 * Get or create the default wallet system
 */
export async function getWalletSystem(config?: TypeSafeWalletConfig): Promise<WalletSystem> {
  if (!defaultSystem) {
    defaultSystem = await createWalletSystem(config);
  }
  return defaultSystem;
}