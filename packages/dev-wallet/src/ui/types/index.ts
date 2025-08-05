export interface Account {
  address: string;
  publicKey: string;
  privateKey?: string;
  name: string;
  balance?: number;
  chainId?: string;
}

export interface Transaction {
  id: string;
  hash?: string;
  from: string;
  to?: string;
  amount?: number;
  gas?: number;
  status: 'pending' | 'success' | 'failure';
  timestamp: number;
  chainId: string;
  capability?: string;
  data?: Record<string, unknown>;
  result?: import('../../types').TransactionResult;
  updatedAt?: number;
}

export interface Network {
  id: string;
  name: string;
  chainId: string;
  rpcUrl: string;
  explorerUrl?: string;
  isActive?: boolean;
}

export type WalletScreen = 'accounts' | 'transactions' | 'networks' | 'settings' | 'connect' | 'sign';

export interface WalletState {
  currentScreen: WalletScreen;
  selectedAccount?: Account;
  accounts: Account[];
  transactions: Transaction[];
  networks: Network[];
  activeNetwork?: Network;
  pendingTransaction?: import('../../types').PendingTransaction;
  isConnecting?: boolean;
}