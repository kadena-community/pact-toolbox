import type { Wallet } from "../wallet";
import type { SerializableNetworkConfig, MultiNetworkConfig } from "../config";

/**
 * Context store interface for Pact Toolbox state management
 * This is a complex store that manages network, wallet, and client state
 */
export interface IStore {
  // State getters
  readonly network: SerializableNetworkConfig | null;
  readonly networks: MultiNetworkConfig | null;
  readonly wallet: Wallet | null;
  readonly wallets: Wallet[];
  readonly isConnecting: boolean;
  readonly isWalletModalOpen: boolean;
  readonly environment: "development" | "production" | "test";
  readonly isDevNet: boolean;
  
  // Network management
  switchNetwork(networkId: string): void;
  
  // Wallet management
  connectWallet(walletId: string): Promise<void>;
  disconnectWallet(): Promise<void>;
  setWallet(wallet: Wallet | null): void;
  
  // UI actions
  openWalletModal(): void;
  closeWalletModal(): void;
}