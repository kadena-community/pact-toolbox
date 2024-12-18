import type { PartiallySignedTransaction, Transaction } from "@pact-toolbox/types";

export interface WalletNetwork {
  explorer?: string;
  id: string;
  isDefault: boolean;
  name: string;
  networkId: string;
  url: string;
}

export interface WalletSigner {
  address: string;
  publicKey: string;
}

export interface WalletAccount extends WalletSigner {
  connectedSites: string[];
  balance: number;
}

export interface WalletSigningApi {
  sign(tx: PartiallySignedTransaction): Promise<Transaction>;
  quickSign(tx: PartiallySignedTransaction): Promise<Transaction>;
  quickSign(txs: PartiallySignedTransaction[]): Promise<Transaction[]>;
}

export interface Wallet extends WalletSigningApi {
  isInstalled(): boolean;
  connect(networkId?: string): Promise<WalletSigner>;
  getSigner(networkId?: string): Promise<WalletSigner>;
  getNetwork(): Promise<WalletNetwork>;
  isConnected(networkId?: string): Promise<boolean>;
  getAccountDetails(networkId?: string): Promise<WalletAccount>;
  disconnect(networkId?: string): Promise<void>;
}
