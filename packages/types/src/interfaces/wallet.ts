import type { Wallet } from "../wallet";

/**
 * Wallet provider factory interface
 */
export interface IWalletProvider {
  (options?: any): Promise<Wallet>;
}

/**
 * Wallet system interface for managing multiple wallets
 */
export interface IWalletSystem {
  /**
   * Get the primary/default wallet
   */
  getPrimaryWallet(): Wallet | null;
  
  /**
   * Get all connected wallets
   */
  getConnectedWallets(): Wallet[];
  
  /**
   * Connect a wallet by provider name
   * @param provider - The wallet provider name
   */
  connectWallet(provider: string): Promise<Wallet>;
  
  /**
   * Disconnect a wallet by address
   * @param address - The wallet address to disconnect
   */
  disconnectWallet(address: string): Promise<void>;
}

/**
 * Wallet registry interface for managing wallet providers
 */
export interface IWalletRegistry {
  /**
   * Register a wallet provider
   * @param provider - The wallet provider to register
   */
  register(provider: any): void;
  
  /**
   * Get a wallet provider by name
   * @param name - The provider name
   */
  get(name: string): any;
  
  /**
   * List all registered wallet provider names
   */
  list(): string[];
}

/**
 * Wallet persistence interface for saving wallet state
 */
export interface IWalletPersistence {
  /**
   * Save wallet data
   * @param wallet - Serialized wallet data
   */
  save(wallet: string): void;
  
  /**
   * Load wallet data
   */
  load(): string | null;
  
  /**
   * Clear wallet data
   */
  clear(): void;
}