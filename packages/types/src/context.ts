import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import type { ChainwebClient } from "@pact-toolbox/chainweb-client";
import type { MultiNetworkConfig, SerializableNetworkConfig } from "./config";

/**
 * Event map for context events
 */
export type ContextEventMap = {
  "network:changed": (event: {
    network: SerializableNetworkConfig | null;
    previous: SerializableNetworkConfig | null;
  }) => void;
  "wallet:connected": (event: { wallet: Wallet }) => void;
  "wallet:disconnected": (event: { wallet: Wallet | null }) => void;
  "wallet:changed": (event: { wallet: Wallet | null; previous: Wallet | null }) => void;
  "wallet:error": (event: { error: Error }) => void;
  "wallet:modal:open": () => void;
  "wallet:modal:close": () => void;
  "config:updated": (event: { config: any }) => void; // Using any to avoid circular dependency
  "environment:detected": (event: { environment: "development" | "production" | "test" }) => void;
};

/**
 * Context state interface
 */
export interface ContextState {
  // Current network state
  network: SerializableNetworkConfig | null;
  networks: MultiNetworkConfig | null;

  // Wallet state
  wallet: Wallet | null;
  wallets: WalletMetadata[];
  isConnecting: boolean;

  // Client instances
  client: ChainwebClient | null;
  clients: Map<string, ChainwebClient>;

  // UI state
  isWalletModalOpen: boolean;

  // Environment
  environment: "development" | "production" | "test";
  isDevNet: boolean;
}

/**
 * Context actions interface
 */
export interface ContextActions {
  // Network actions
  setNetwork: (networkId: string) => Promise<void>;

  // Wallet actions
  connectWallet: (walletId?: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  setWallet: (wallet: Wallet | null) => void;

  // UI actions
  openWalletModal: () => void;
  closeWalletModal: () => void;

  // Client actions
  getClient: (networkId?: string) => ChainwebClient;

  // Configuration
  updateConfig: (config: Partial<any>) => void; // Using any to avoid circular dependency
}

/**
 * Combined context interface
 */
export interface PactToolboxContext extends ContextState, ContextActions {}