export interface DevWalletKey {
  address: string;
  publicKey: string;
  privateKey: string;
  encryptedPrivateKey?: import("@pact-toolbox/crypto").EncryptedData;
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
  balance?: number;
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
}
