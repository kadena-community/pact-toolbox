import { useMemo } from 'react';
import type { WalletMetadata } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UseAvailableWalletsReturn {
  availableWallets: WalletMetadata[];
  hasWallets: boolean;
  walletCount: number;
  getWalletById: (id: string) => WalletMetadata | undefined;
  walletsByType: Record<string, WalletMetadata[]>;
  getWalletsByType: (type: string) => WalletMetadata[];
  walletTypes: string[];
}

/**
 * Hook to access available wallet providers and their metadata
 *
 * @returns Object containing available wallets and utility functions
 *
 * @example
 * ```tsx
 * function WalletSelector() {
 *   const { availableWallets, hasWallets, getWalletById } = useAvailableWallets();
 *
 *   if (!hasWallets) {
 *     return <div>No wallets available</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {availableWallets.map(wallet => (
 *         <button key={wallet.id} onClick={() => connect(wallet.id)}>
 *           <img src={wallet.icon} alt={wallet.name} />
 *           {wallet.name}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAvailableWallets(): UseAvailableWalletsReturn {
  const { availableWallets } = useWalletContext();

  const walletsByType = useMemo(() => {
    const grouped: Record<string, WalletMetadata[]> = {};

    availableWallets.forEach(wallet => {
      const type = wallet.type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(wallet);
    });

    return grouped;
  }, [availableWallets]);

  const getWalletById = useMemo(() => {
    const walletMap = new Map(availableWallets.map(wallet => [wallet.id, wallet]));
    return (id: string): WalletMetadata | undefined => walletMap.get(id);
  }, [availableWallets]);

  const getWalletsByType = useMemo(() => {
    return (type: string): WalletMetadata[] => walletsByType[type] || [];
  }, [walletsByType]);

  const walletTypes = useMemo(() => {
    return Object.keys(walletsByType);
  }, [walletsByType]);

  return {
    availableWallets,
    hasWallets: availableWallets.length > 0,
    walletCount: availableWallets.length,
    getWalletById,
    walletsByType,
    getWalletsByType,
    walletTypes,
  };
}