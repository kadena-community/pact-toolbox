import { EventEmitter } from "@pact-toolbox/utils";
import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type {
  Wallet,
  WalletProvider,
  WalletMetadata,
  WalletEvents,
  ConnectOptions,
  AutoConnectOptions,
} from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";

/**
 * Simplified wallet service that combines registry and manager functionality
 */
export class WalletService extends EventEmitter<WalletEvents> {
  private providers = new Map<string, WalletProvider>();
  private connectedWallets = new Map<string, Wallet>();
  private primaryWallet: Wallet | null = null;

  /**
   * Register a wallet provider
   */
  register(provider: WalletProvider): void {
    const { id } = provider.metadata;

    if (this.providers.has(id)) {
      // Silent overwrite - this is expected when providers are re-registered
      // console.warn(`Wallet provider "${id}" is already registered. Overwriting.`);
    }

    this.providers.set(id, provider);
  }

  /**
   * Register multiple providers
   */
  registerAll(providers: WalletProvider[]): void {
    providers.forEach((provider) => this.register(provider));
  }

  /**
   * Get available wallets (installed/accessible)
   */
  async getAvailableWallets(): Promise<WalletMetadata[]> {
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
   * Connect to a specific wallet
   */
  async connect(walletId: string, options: ConnectOptions = {}): Promise<Wallet> {
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
  async autoConnect(options: AutoConnectOptions = {}): Promise<Wallet> {
    try {
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
          
          return await this.connect(walletId, options);
        } catch (error) {
          errors.push(error as Error);
          if (!options.skipUnavailable) {
            throw error;
          }
        }
      }
      
      // If preferred wallets failed, try others (except those that might cause connection errors)
      const skipWallets = new Set(["chainweaver", "zelcore"]); // Skip wallets that try to connect to localhost ports
      const remainingProviders = providers.filter(p => 
        !preferredOrder.includes(p.metadata.id) && !skipWallets.has(p.metadata.id)
      );
      
      for (const provider of remainingProviders) {
        try {
          const isAvailable = await provider.isAvailable();
          if (!isAvailable) continue;
          
          return await this.connect(provider.metadata.id, options);
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
  async disconnect(walletId: string): Promise<void> {
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
   * Get primary wallet
   */
  getPrimaryWallet(): Wallet | null {
    return this.primaryWallet;
  }

  /**
   * Set primary wallet
   */
  setPrimaryWallet(wallet: Wallet | null): void {
    if (wallet && !Array.from(this.connectedWallets.values()).includes(wallet)) {
      throw new Error("Cannot set disconnected wallet as primary");
    }

    this.primaryWallet = wallet;
  }

  /**
   * Get all connected wallets
   */
  getConnectedWallets(): Wallet[] {
    return Array.from(this.connectedWallets.values());
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
      throw WalletError.notConnected("No primary wallet set");
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
   * Get connection status information
   */
  getConnectionStatus() {
    const primaryWalletId = this.getPrimaryWalletId();
    return {
      connected: this.connectedWallets.size > 0,
      primaryWalletId,
      connectedWallets: Array.from(this.connectedWallets.keys()),
    };
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
   * Clear all connections
   */
  async clearConnections(): Promise<void> {
    const walletIds = Array.from(this.connectedWallets.keys());

    for (const walletId of walletIds) {
      try {
        await this.disconnect(walletId);
      } catch (error) {
        // Log but continue disconnecting other wallets
        console.error(`Failed to disconnect wallet ${walletId}:`, error);
      }
    }
  }

  /**
   * Clear all providers
   */
  clearProviders(): void {
    this.providers.clear();
  }

  /**
   * Get all registered providers
   */
  getProviders(): WalletProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Reset service to initial state
   */
  async reset(): Promise<void> {
    await this.clearConnections();
    this.clearProviders();
    this.primaryWallet = null;
  }
}

/**
 * Default wallet service instance
 */
export const walletService = new WalletService();
