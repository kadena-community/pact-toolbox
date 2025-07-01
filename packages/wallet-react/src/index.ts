/**
 * @pact-toolbox/wallet-react
 *
 * React integration for Kadena wallet management.
 * Provides hooks, components, and context for wallet interactions.
 *
 * @example
 * ```tsx
 * import { WalletManagerProvider, useWalletManager, WalletConnectButton } from '@pact-toolbox/wallet-react';
 *
 * function App() {
 *   return (
 *     <WalletManagerProvider autoInitialize>
 *       <MyWalletApp />
 *     </WalletManagerProvider>
 *   );
 * }
 *
 * function MyWalletApp() {
 *   const { isInitialized } = useWalletManager();
 *
 *   if (!isInitialized) {
 *     return <div>Initializing...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <WalletConnectButton />
 *     </div>
 *   );
 * }
 * ```
 */

// Core context and provider
export {
  WalletManagerProvider,
  useWalletContext,
  type WalletManagerProviderProps,
  type WalletContextState,
  type WalletContextActions,
  type WalletContextValue,
} from './context';

// Hooks
export {
  useWalletManager,
  usePrimaryWallet,
  useWallet,
  useWalletConnection,
  useAvailableWallets,
  useWalletAccounts,
  useWalletNetwork,
} from './hooks';

// Components
export {
  WalletConnectButton,
  WalletInfo,
  WalletSelector,
  type WalletConnectButtonProps,
  type WalletInfoProps,
  type WalletInfoRenderProps,
  type WalletSelectorProps,
  type WalletSelectorRenderProps,
} from './components';

// Re-export useful types from core packages
export type {
  Wallet,
  WalletAccount,
  WalletNetwork,
  WalletMetadata,
  WalletProvider,
  WalletEvents,
  WalletManagerEvents,
  ConnectOptions,
  AutoConnectOptions,
} from '@pact-toolbox/wallet-core';

export type {
  WalletManager,
  WalletManagerConfig,
} from '@pact-toolbox/wallet-manager';
