import type { PartiallySignedTransaction, SignedTransaction } from "./pact";

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
 * This interface is also used as TransactionSigner in the transaction package
 */
export interface Wallet {
  /** Wallet provider ID */
  readonly id?: string;

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

export interface WalletLike {
  getAccount(networkId?: string): Promise<WalletAccount>;
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
  error: (error: Error) => void;

  /** Primary wallet changed */
  primaryWalletChanged: (wallet: Wallet | null) => void;
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
  /** Wallet ID to connect to */
  walletId?: string;
  /** Silent mode (no UI) */
  silent?: boolean;
  /** Show UI on connect */
  showUI?: boolean;
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
