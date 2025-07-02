// Core types and interfaces from wallet-core
export type {
  AutoConnectOptions,
  ConnectOptions,
  Wallet,
  WalletAccount,
  WalletErrorType,
  WalletEvents,
  WalletMetadata,
  WalletNetwork,
  WalletProvider,
} from "@pact-toolbox/wallet-core";

export { WalletError, BaseWallet, detectBrowserExtension } from "@pact-toolbox/wallet-core";

// Core services
export { WalletRegistry } from "./wallet-registry";

// Persistence
export {
  getPersistedWallet,
  persistWallet,
  clearPersistedWallet,
  getWalletPreferences,
  saveWalletPreferences,
  type WalletPersistence,
  type WalletPreferences,
} from "./persistence";

// Unified wallet system
export { WalletSystem, createWalletSystem, getWalletSystem } from "./wallet-system";

// Environment utilities
export { isBrowser, isNode, isTestEnvironment, getRuntimeEnvironment } from "./environment";

// Auto-import providers to trigger their registration
import { isTestEnvironment, isBrowser } from "./environment";

// Always import keypair provider (works in all environments)
import("./providers/keypair");

// Only import browser wallets in browser environment (not in test or Node.js)
if (isBrowser() && !isTestEnvironment()) {
  import("./providers/ecko");
  import("./providers/chainweaver");
  import("./providers/zelcore");
}

export * from "./config";
