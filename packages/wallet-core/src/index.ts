// Base wallet class
export { BaseWallet, detectBrowserExtension } from "./base-wallet";

// Base provider class
export { BaseWalletProvider } from "./base-provider";

// Types
export type {
  Wallet,
  WalletAccount,
  WalletNetwork,
  WalletMetadata,
  WalletProvider,
  WalletErrorType,
  WalletEvents,
  ConnectOptions,
  AutoConnectOptions,
} from "./types";

// Error classes
export { WalletError, formatWalletError } from "./wallet-error";
export type { WalletErrorInfo } from "./wallet-error";

// Network utilities
export { 
  KadenaNetworks, 
  supportsNetworkManagement, 
  validateNetwork,
  getNetworkById,
  getDefaultNetwork
} from "./network";
export type { NetworkCapabilities, NetworkAwareWallet } from "./network";