/**
 * Centralized registry for managing KeypairWallet instances
 * Ensures we don't create duplicate wallets and properly manage their lifecycle
 */

import { KeypairWallet } from '@pact-toolbox/wallet-core';
import type { DevWalletKey } from './types';
import { walletLogger } from './utils/logger';

// Global singleton instance
let globalRegistry: KeypairRegistry | undefined;

export function getGlobalRegistry(): KeypairRegistry {
  if (!globalRegistry) {
    globalRegistry = new KeypairRegistry();
  }
  return globalRegistry;
}

export class KeypairRegistry {
  private wallets = new Map<string, KeypairWallet>();
  private keyToWalletMap = new Map<string, string>(); // publicKey -> walletId
  private creationLocks = new Map<string, Promise<KeypairWallet>>(); // address -> creation promise

  /**
   * Create a wallet from private key
   */
  async createWalletFromPrivateKey(
    privateKey: string,
    config: {
      networkId: string;
      rpcUrl: string;
      accountName?: string;
    }
  ): Promise<KeypairWallet> {
    // Create the wallet
    const wallet = new KeypairWallet({
      privateKey,
      accountName: config.accountName,
      networkId: config.networkId,
      rpcUrl: config.rpcUrl,
    });

    // Connect to get the account info
    const account = await wallet.connect();

    // Store in registry
    this.wallets.set(account.address, wallet);
    this.keyToWalletMap.set(account.publicKey, account.address);

    walletLogger.debug('Created wallet from private key', { address: account.address });
    return wallet;
  }

  /**
   * Get or create a KeypairWallet for a given key
   */
  async getOrCreateWallet(
    key: DevWalletKey,
    config: {
      networkId: string;
      rpcUrl: string;
    }
  ): Promise<KeypairWallet> {
    // Check if we already have a wallet for this public key
    const existingWalletId = this.keyToWalletMap.get(key.publicKey);
    if (existingWalletId) {
      const existingWallet = this.wallets.get(existingWalletId);
      if (existingWallet) {
        walletLogger.debug('Reusing existing wallet', { publicKey: key.publicKey });
        return existingWallet;
      }
    }

    // Check if we have a wallet for this address
    const walletByAddress = this.wallets.get(key.address);
    if (walletByAddress) {
      walletLogger.debug('Reusing wallet by address', { address: key.address });
      // Update the key mapping
      this.keyToWalletMap.set(key.publicKey, key.address);
      return walletByAddress;
    }

    // Check if there's already a creation in progress for this address
    const existingCreation = this.creationLocks.get(key.address);
    if (existingCreation) {
      walletLogger.debug('Waiting for existing wallet creation', { address: key.address });
      return existingCreation;
    }

    // Need private key to create new wallet
    if (!key.privateKey) {
      throw new Error(`Cannot create wallet without private key for ${key.address}`);
    }

    // Create a promise for wallet creation to prevent race conditions
    const creationPromise = this.createWalletSafe(key, config);
    this.creationLocks.set(key.address, creationPromise);

    try {
      const wallet = await creationPromise;
      return wallet;
    } finally {
      // Clean up the creation lock
      this.creationLocks.delete(key.address);
    }
  }

  /**
   * Safely create a new wallet without race conditions
   */
  private async createWalletSafe(
    key: DevWalletKey,
    config: { networkId: string; rpcUrl: string }
  ): Promise<KeypairWallet> {
    walletLogger.debug('Creating new wallet', { address: key.address });

    const wallet = new KeypairWallet({
      privateKey: key.privateKey!,
      accountName: key.address,
      networkId: config.networkId,
      rpcUrl: config.rpcUrl,
    });

    // Connect the wallet
    await wallet.connect();

    // Store in registry
    this.wallets.set(key.address, wallet);
    this.keyToWalletMap.set(key.publicKey, key.address);

    return wallet;
  }

  /**
   * Get wallet by address if it exists
   */
  getWallet(address: string): KeypairWallet | undefined {
    return this.wallets.get(address);
  }

  /**
   * Get wallet by public key if it exists
   */
  getWalletByPublicKey(publicKey: string): KeypairWallet | undefined {
    const walletId = this.keyToWalletMap.get(publicKey);
    if (walletId) {
      return this.wallets.get(walletId);
    }
    return undefined;
  }

  /**
   * Check if we have a wallet for a given address
   */
  hasWallet(address: string): boolean {
    return this.wallets.has(address);
  }

  /**
   * Check if we have a wallet for a given public key
   */
  hasWalletForKey(publicKey: string): boolean {
    return this.keyToWalletMap.has(publicKey);
  }

  /**
   * Remove a wallet from the registry
   */
  async removeWallet(address: string): Promise<void> {
    const wallet = this.wallets.get(address);
    if (wallet) {
      // Disconnect the wallet
      await wallet.disconnect();

      // Remove from maps
      this.wallets.delete(address);

      // Remove from key mapping
      for (const [key, walletId] of this.keyToWalletMap.entries()) {
        if (walletId === address) {
          this.keyToWalletMap.delete(key);
        }
      }

      walletLogger.debug('Removed wallet from registry', { address });
    }
  }

  /**
   * Clear all wallets
   */
  async clear(): Promise<void> {
    // Disconnect all wallets
    for (const wallet of this.wallets.values()) {
      await wallet.disconnect();
    }

    // Clear maps
    this.wallets.clear();
    this.keyToWalletMap.clear();

    walletLogger.debug('Cleared all wallets from registry');
  }

  /**
   * Get the number of wallets in the registry
   */
  get size(): number {
    return this.wallets.size;
  }

  /**
   * Get all wallet addresses
   */
  getAddresses(): string[] {
    return Array.from(this.wallets.keys());
  }
}