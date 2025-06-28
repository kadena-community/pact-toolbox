export interface DevWalletKey {
  address: string;
  publicKey: string;
  privateKey: string;
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
  data?: any;
  result?: any;
  updatedAt?: number;
}

export interface DevWalletUIEvents {
  "toolbox-connect-requested": CustomEvent<void>;
  "toolbox-sign-requested": CustomEvent<{ transaction: any }>;
  "connect-approved": CustomEvent<{ account: DevWalletKey }>;
  "connect-cancelled": CustomEvent<void>;
  "sign-approved": CustomEvent<void>;
  "sign-rejected": CustomEvent<void>;
  "toolbox-transaction-added": CustomEvent<{ transaction: DevWalletTransaction }>;
  "toolbox-transaction-updated": CustomEvent<{ transactionId: string; status: string; result?: any }>;
  "dev-wallet-connected": CustomEvent<{ walletId: string; address: string }>;
  "dev-wallet-disconnected": CustomEvent<{ walletId: string }>;
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
  data?: any;
  result?: any;
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
  pendingTransaction?: any;
  isConnecting?: boolean;
  settings?: DevWalletSettings;
}
