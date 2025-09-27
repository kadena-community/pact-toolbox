import type { EncryptedData } from "@pact-toolbox/crypto";

export interface DevWalletKey {
  address: string;
  publicKey: string;
  privateKey: string;
  encryptedPrivateKey?: EncryptedData;
  name?: string;
  createdAt: number;
}

export interface DevWalletConfig {
  /** Network ID */
  networkId: string;
  /** Network name */
  networkName?: string;
  /** RPC URL */
  rpcUrl: string;
  /** Whether to show UI for approvals (browser only) */
  showUI?: boolean;
  /** Storage key prefix */
  storagePrefix?: string;
  /** Account name */
  accountName?: string;
  /** Enable encryption for private keys */
  enableEncryption?: boolean;
  /** Encryption password (if not provided, one will be generated) */
  encryptionPassword?: string;
}

export interface DevWalletTransaction {
  id: string;
  hash?: string;
  from: string;
  to?: string;
  amount?: number | string;
  gas?: number;
  status: "pending" | "success" | "failure";
  timestamp: number;
  chainId: string;
  capability?: string;
  data?: Record<string, unknown>;
  result?: TransactionResult;
  updatedAt?: number;
}

export interface TransactionResult {
  requestKey: string;
  status: 'success' | 'failure';
  data?: Record<string, unknown>;
  error?: {
    message: string;
    type?: string;
  };
}

export interface DevWalletUIEvents {
  "toolbox-connect-requested": CustomEvent<void>;
  "toolbox-sign-requested": CustomEvent<{ transaction: PendingTransaction }>;
  "connect-approved": CustomEvent<{ account: DevWalletKey }>;
  "connect-cancelled": CustomEvent<void>;
  "sign-approved": CustomEvent<void>;
  "sign-rejected": CustomEvent<void>;
  "toolbox-transaction-added": CustomEvent<{ transaction: DevWalletTransaction }>;
  "toolbox-transaction-updated": CustomEvent<{ transactionId: string; status: string; result?: TransactionResult }>;
  "dev-wallet-connected": CustomEvent<{ walletId: string; address: string }>;
  "dev-wallet-disconnected": CustomEvent<{ walletId: string }>;
}

export interface PendingTransaction {
  id: string;
  request: import('@pact-toolbox/types').PartiallySignedTransaction;
  timestamp: number;
  chainId: string;
}

// UI Types (used internally)
export interface Account {
  address: string;
  publicKey: string;
  privateKey?: string;
  name: string;
  chainId?: string;
  balance?: number | string;
  networkId?: string; // Network this account belongs to
  existsOnChain?: boolean; // Whether account exists on blockchain
  guard?: Record<string, unknown>; // Account guard from chain
  discoveredChains?: string[]; // Chains where account was discovered
}

export interface Transaction {
  id: string;
  hash?: string;
  from: string;
  to?: string;
  amount?: number | string;
  gas?: number;
  status: "pending" | "success" | "failure";
  timestamp: number;
  chainId: string;
  capability?: string;
  data?: Record<string, unknown>;
  result?: TransactionResult;
  updatedAt?: number;
}

export interface Network {
  id: string;
  name: string;
  chainId: string;
  rpcUrl: string;
  isActive: boolean;
  isCustom?: boolean;
  explorerUrl?: string;
}

export type WalletScreen = "accounts" | "transactions" | "networks" | "settings" | "connect" | "sign";

export interface DevWalletSettings {
  autoLock: boolean;
  showTestNetworks: boolean;
}

export interface WalletState {
  currentScreen: WalletScreen;
  accounts: Account[];
  transactions: Transaction[];
  networks: Network[];
  selectedAccount?: Account;
  activeNetwork?: Network;
  pendingTransaction?: PendingTransaction;
  isConnecting?: boolean;
  settings?: DevWalletSettings;
  isLocked?: boolean;
  lastActivity?: number;
}

/**
 * Enhanced wallet state with readonly properties for better immutability
 */
export interface EnhancedWalletState {
  readonly currentScreen: WalletScreen;
  readonly accounts: ReadonlyArray<Account>;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly networks: ReadonlyArray<Network>;
  readonly selectedAccount?: Account;
  readonly activeNetwork?: Network;
  readonly pendingTransaction?: PendingTransaction;
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
  'transaction-signed': { transaction: Transaction };
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
