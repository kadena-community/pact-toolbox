import type { WalletManager } from '@pact-toolbox/wallet-manager';
import { useWalletContext } from '../context';

export interface UseWalletManagerReturn {
  walletManager: WalletManager | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initError: Error | null;
}

/**
 * Hook to access the wallet manager instance and its initialization state
 *
 * @returns Object containing wallet manager and initialization state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { walletManager, isInitialized, isInitializing, initError } = useWalletManager();
 *
 *   if (isInitializing) return <div>Initializing wallet manager...</div>;
 *   if (initError) return <div>Error: {initError.message}</div>;
 *   if (!isInitialized) return <div>Wallet manager not initialized</div>;
 *
 *   return <div>Wallet manager ready!</div>;
 * }
 * ```
 */
export function useWalletManager(): UseWalletManagerReturn {
  const {
    walletManager,
    isInitialized,
    isInitializing,
    initError,
  } = useWalletContext();

  return {
    walletManager,
    isInitialized,
    isInitializing,
    initError,
  };
}