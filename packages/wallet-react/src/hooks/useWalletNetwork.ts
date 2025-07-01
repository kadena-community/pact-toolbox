import { useState, useEffect, useCallback } from 'react';
import type { WalletNetwork, Wallet } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UseWalletNetworkReturn {
  currentNetwork: WalletNetwork | null;
  availableNetworks: WalletNetwork[];
  isLoading: boolean;
  error: Error | null;
  hasMultipleNetworks: boolean;
  networkCount: number;
  refreshNetworks: () => Promise<void>;
  wallet: Wallet | null;
}

/**
 * Hook to access wallet network information and network switching
 *
 * @param walletId - Optional wallet ID. If not provided, uses primary wallet
 * @returns Object containing network state and utilities
 *
 * @example
 * ```tsx
 * function NetworkInfo({ walletId }: { walletId?: string }) {
 *   const {
 *     currentNetwork,
 *     availableNetworks,
 *     isLoading,
 *     error,
 *     hasMultipleNetworks,
 *     refreshNetworks
 *   } = useWalletNetwork(walletId);
 *
 *   if (isLoading) return <div>Loading networks...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!currentNetwork) return <div>No network found</div>;
 *
 *   return (
 *     <div>
 *       <h3>Current Network</h3>
 *       <p>Name: {currentNetwork.name}</p>
 *       <p>Network ID: {currentNetwork.networkId}</p>
 *       <p>URL: {currentNetwork.url}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWalletNetwork(walletId?: string): UseWalletNetworkReturn {
  const { connectedWallets, primaryWallet, network: currentNetwork } = useWalletContext();

  const [availableNetworks, setAvailableNetworks] = useState<WalletNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get target wallet
  const targetWallet = walletId
    ? connectedWallets.find(w => w.id === walletId)
    : primaryWallet;

  // Refresh networks from wallet
  const refreshNetworks = useCallback(async (): Promise<void> => {
    if (!targetWallet) {
      setAvailableNetworks([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let networks: WalletNetwork[] = [];

      // Try to get multiple networks if supported
      if (targetWallet.getNetworks) {
        try {
          networks = await targetWallet.getNetworks();
        } catch {
          console.debug('Multi-network not supported, falling back to single network');
        }
      }

      // Fall back to single network
      if (networks.length === 0) {
        try {
          const singleNetwork = await targetWallet.getNetwork();
          networks = [singleNetwork];
        } catch {
          throw new Error('Failed to get wallet networks');
        }
      }

      setAvailableNetworks(networks);
    } catch (err) {
      const networkError = err instanceof Error ? err : new Error(String(err));
      setError(networkError);
      setAvailableNetworks([]);
    } finally {
      setIsLoading(false);
    }
  }, [targetWallet]);

  // Refresh networks when wallet changes
  useEffect(() => {
    refreshNetworks();
  }, [refreshNetworks]);

  // Find current network in available networks
  const currentNetworkInList = currentNetwork
    ? availableNetworks.find(net => net.id === currentNetwork.id) || currentNetwork
    : availableNetworks.find(net => net.isDefault) || availableNetworks[0] || null;

  return {
    currentNetwork: currentNetworkInList,
    availableNetworks,
    isLoading,
    error,
    hasMultipleNetworks: availableNetworks.length > 1,
    networkCount: availableNetworks.length,
    refreshNetworks,
    wallet: targetWallet || null,
  };
}