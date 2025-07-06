import type { Wallet } from "../wallet";
import type { IEventBus } from "./event-bus";

/**
 * Wallet connection event data
 */
export interface IWalletConnectionEvent {
  wallet: Wallet;
  isReconnect?: boolean;
}

/**
 * Wallet disconnection event data
 */
export interface IWalletDisconnectionEvent {
  address: string;
  reason?: string;
}

/**
 * Wallet manager events
 */
export interface IWalletManagerEvents {
  "wallet:connected": IWalletConnectionEvent;
  "wallet:disconnected": IWalletDisconnectionEvent;
  "wallet:changed": { wallet: Wallet | null };
  "modal:open": { provider?: string };
  "modal:close": void;
}

/**
 * Wallet manager interface for managing wallet connections and state
 */
export interface IWalletManager {
  /**
   * Get the currently connected wallet
   */
  getCurrentWallet(): Wallet | null;
  
  /**
   * Set the current wallet
   * @param wallet - The wallet to set as current
   */
  setCurrentWallet(wallet: Wallet | null): void;
  
  /**
   * Get all available wallets
   */
  getAvailableWallets(): Wallet[];
  
  /**
   * Add a wallet to available wallets
   * @param wallet - The wallet to add
   */
  addWallet(wallet: Wallet): void;
  
  /**
   * Remove a wallet from available wallets
   * @param address - The wallet address to remove
   */
  removeWallet(address: string): void;
  
  /**
   * Check if wallet modal is open
   */
  isModalOpen(): boolean;
  
  /**
   * Open wallet selection modal
   * @param provider - Optional provider to preselect
   */
  openModal(provider?: string): void;
  
  /**
   * Close wallet selection modal
   */
  closeModal(): void;
  
  /**
   * Get the event bus for wallet events
   */
  getEventBus(): IEventBus;
}