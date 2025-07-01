/**
 * @pact-toolbox/wallet-manager
 *
 * Core wallet management functionality. Import specific wallet providers from their packages:
 *
 * ```typescript
 * import { WalletManager } from '@pact-toolbox/wallet-manager';
 * import { KeypairWalletProvider } from '@pact-toolbox/wallet-core';
 * import { EckoWalletProvider } from '@pact-toolbox/wallet-ecko';
 * import { ChainweaverWalletProvider } from '@pact-toolbox/wallet-chainweaver';
 *
 * const walletManager = new WalletManager({
 *   ui: { showOnConnect: true }
 * });
 *
 * // Register only the wallets you want to support
 * walletManager
 *   .register('keypair', new KeypairWalletProvider())
 *   .register('ecko', new EckoWalletProvider())
 *   .register('chainweaver', new ChainweaverWalletProvider());
 *
 * await walletManager.initialize();
 * ```
 */

// Core types
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
} from "@pact-toolbox/types";

// Wallet Manager
export * from "./wallet-manager";

// Persistence utilities
export * from "./persistence";
