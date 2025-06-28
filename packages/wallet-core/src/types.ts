import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";

/**
 * Wallet network information
 */
export interface WalletNetwork {
  /** Network unique identifier */
  id: string;
  /** Kadena network ID */
  networkId: string;
  /** Human-readable network name */
  name: string;
  /** RPC endpoint URL */
  url: string;
  /** Network explorer URL */
  explorer?: string;
  /** Whether this is the default network */
  isDefault?: boolean;
}

/**
 * Wallet account information with signer details
 */
export interface WalletAccount {
  /** Public key address */
  address: string;
  /** Public key */
  publicKey: string;
  /** Account balance */
  balance?: number;
  /** Connected sites */
  connectedSites?: string[];
  /** Connection timestamp */
  connectedAt?: Date;
}

/**
 * Simplified wallet interface combining all wallet functionality
 */
export interface Wallet {
  /** Check if wallet is installed/available */
  isInstalled(): boolean;

  /** Connect to wallet */
  connect(networkId?: string): Promise<WalletAccount>;

  /** Get current account information */
  getAccount(networkId?: string): Promise<WalletAccount>;

  /** Get network information */
  getNetwork(): Promise<WalletNetwork>;

  /** Check if connected */
  isConnected(networkId?: string): Promise<boolean>;

  /** Disconnect from wallet */
  disconnect(networkId?: string): Promise<void>;

  /** Sign transaction(s) */
  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
}

/**
 * Wallet metadata information
 */
export interface WalletMetadata {
  /** Unique wallet identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon URL or data URI */
  icon?: string;
  /** Wallet type */
  type: "browser-extension" | "mobile" | "hardware" | "built-in" | "desktop" | "web";
  /** Supported features */
  features?: string[];
}

/**
 * Simplified wallet provider interface
 */
export interface WalletProvider {
  /** Provider metadata */
  readonly metadata: WalletMetadata;

  /** Check if wallet is available */
  isAvailable(): Promise<boolean>;

  /** Create wallet instance */
  createWallet(): Promise<Wallet>;
}

/**
 * Wallet error types
 */
export type WalletErrorType =
  | "NOT_FOUND"
  | "NOT_CONNECTED"
  | "CONNECTION_FAILED"
  | "USER_REJECTED"
  | "SIGNING_FAILED"
  | "NETWORK_MISMATCH"
  | "TIMEOUT"
  | "UNKNOWN";

/**
 * Wallet error class
 */
export class WalletError extends Error {
  public readonly type: WalletErrorType;
  public readonly cause?: unknown;

  constructor(type: WalletErrorType, message: string, cause?: unknown) {
    super(message);
    this.name = "WalletError";
    this.type = type;
    this.cause = cause;
  }

  static notFound(walletId: string): WalletError {
    return new WalletError("NOT_FOUND", `Wallet "${walletId}" not found or not installed`);
  }

  static notConnected(walletId: string): WalletError {
    return new WalletError("NOT_CONNECTED", `Wallet "${walletId}" is not connected`);
  }

  static connectionFailed(reason: string): WalletError {
    return new WalletError("CONNECTION_FAILED", `Connection failed: ${reason}`);
  }

  static userRejected(operation: string): WalletError {
    return new WalletError("USER_REJECTED", `User rejected ${operation}`);
  }

  static signingFailed(reason: string): WalletError {
    return new WalletError("SIGNING_FAILED", `Transaction signing failed: ${reason}`);
  }

  static networkMismatch(expected: string, actual: string): WalletError {
    return new WalletError("NETWORK_MISMATCH", `Network mismatch: expected ${expected}, got ${actual}`);
  }

  static timeout(operation: string, timeout: number): WalletError {
    return new WalletError("TIMEOUT", `${operation} timed out after ${timeout}ms`);
  }

  static unknown(message: string, cause?: unknown): WalletError {
    return new WalletError("UNKNOWN", message, cause);
  }
}

/**
 * Wallet events
 */
export interface WalletEvents {
  /** Account changed */
  accountChanged: (account: WalletAccount) => void;
  /** Network changed */
  networkChanged: (network: WalletNetwork) => void;
  /** Connected */
  connected: (wallet: Wallet) => void;
  /** Disconnected */
  disconnected: (walletId: string) => void;
  /** Error occurred */
  error: (error: WalletError) => void;
}

/**
 * Connection options
 */
export interface ConnectOptions {
  /** Network ID to connect to */
  networkId?: string;
  /** Force reconnection even if already connected */
  force?: boolean;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Auto-connect options
 */
export interface AutoConnectOptions extends ConnectOptions {
  /** Preferred wallet IDs in order of preference */
  preferredWallets?: string[];
  /** Skip unavailable wallets */
  skipUnavailable?: boolean;
}