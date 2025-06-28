import type { Account, Transaction, Network, WalletScreen, DevWalletSettings } from "../types";

/**
 * Enhanced wallet state with readonly properties for better immutability
 */
export interface WalletState {
  readonly currentScreen: WalletScreen;
  readonly accounts: ReadonlyArray<Account>;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly networks: ReadonlyArray<Network>;
  readonly selectedAccount?: Account;
  readonly activeNetwork?: Network;
  readonly pendingTransaction?: any;
  readonly isConnecting?: boolean;
  readonly settings?: DevWalletSettings;
  readonly isLocked?: boolean;
  readonly lastActivity?: number;
}

/**
 * Typed event definitions for wallet events
 */
export interface WalletEvents {
  'account-selected': { account: Account };
  'account-created': { account: Account };
  'network-changed': { network: Network };
  'transaction-signed': { transaction: any };
  'transaction-rejected': { reason: string };
  'wallet-locked': { timestamp: number };
  'wallet-unlocked': { timestamp: number };
  'settings-changed': { settings: DevWalletSettings };
  'wallet-data-cleared': Record<string, never>;
  'wallet-export-requested': Record<string, never>;
  'connect-approved': { account: Account };
  'connect-cancelled': Record<string, never>;
  'sign-approved': Record<string, never>;
  'sign-rejected': Record<string, never>;
}

/**
 * Generic typed event dispatcher interface
 */
export interface TypedEventDispatcher {
  dispatch<K extends keyof WalletEvents>(
    event: K,
    detail: WalletEvents[K],
    options?: {
      bubbles?: boolean;
      composed?: boolean;
    }
  ): void;
}

/**
 * Enhanced configuration with additional options
 */
export interface EnhancedDevWalletConfig {
  readonly networkId: string;
  readonly networkName?: string;
  readonly rpcUrl: string;
  readonly showUI?: boolean;
  readonly storagePrefix?: string;
  readonly accountName?: string;
  readonly autoLockTimeout?: number;
  readonly debugMode?: boolean;
  readonly enabledFeatures?: WalletFeature[];
}

/**
 * Wallet feature flags
 */
export type WalletFeature = 
  | 'auto-lock'
  | 'export-data'
  | 'import-account'
  | 'generate-account'
  | 'test-networks'
  | 'transaction-history';

/**
 * Transaction status with additional states
 */
export type TransactionStatus = 
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'success'
  | 'failure'
  | 'rejected'
  | 'expired';

/**
 * Account validation result
 */
export interface AccountValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Network health check result
 */
export interface NetworkHealthResult {
  healthy: boolean;
  latency?: number;
  blockHeight?: number;
  error?: string;
  timestamp: number;
}

/**
 * Storage operation result
 */
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Wallet operation context for logging and debugging
 */
export interface OperationContext {
  operation: string;
  timestamp: number;
  user?: string;
  network?: string;
  metadata?: Record<string, unknown>;
}