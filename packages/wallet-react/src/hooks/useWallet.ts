import { useMemo } from 'react';
import type { Wallet } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UseWalletReturn {
  wallet: Wallet | null;
  isConnected: boolean;
  isPrimary: boolean;
  walletId: string | undefined;
}

/**
 * Hook to access a specific wallet by ID, or the primary wallet if no ID provided
 *
 * @param walletId - Optional wallet ID. If not provided, returns primary wallet
 * @returns Object containing wallet state and connection info
 *
 * @example
 * ```tsx
 * function WalletDetails({ walletId }: { walletId?: string }) {
 *   const { wallet, isConnected, isPrimary } = useWallet(walletId);
 *
 *   if (!wallet) {
 *     return <div>Wallet {walletId || 'primary'} not found</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Wallet ID: {wallet.id}</p>
 *       <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *       <p>Primary: {isPrimary ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWallet(walletId?: string): UseWalletReturn {
  const {
    connectedWallets,
    primaryWallet,
  } = useWalletContext();

  const wallet = useMemo(() => {
    if (!walletId) {
      // Return primary wallet if no ID specified
      return primaryWallet;
    }

    // Find wallet by ID
    return connectedWallets.find(w => w.id === walletId) || null;
  }, [walletId, connectedWallets, primaryWallet]);

  const isPrimary = useMemo(() => {
    return wallet !== null && wallet === primaryWallet;
  }, [wallet, primaryWallet]);

  const isConnected = useMemo(() => {
    return wallet !== null && connectedWallets.includes(wallet);
  }, [wallet, connectedWallets]);

  return {
    wallet,
    isConnected,
    isPrimary,
    walletId: wallet?.id,
  };
}