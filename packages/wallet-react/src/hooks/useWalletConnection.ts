import { useCallback } from 'react';
import type { Wallet } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UseWalletConnectionReturn {
  isConnecting: boolean;
  connectionError: Error | null;
  hasConnectedWallets: boolean;
  connectedWalletCount: number;
  connect: (walletId?: string) => Promise<Wallet>;
  disconnect: (walletId?: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
}

/**
 * Hook for wallet connection state and actions
 *
 * @returns Object containing connection state and actions
 *
 * @example
 * ```tsx
 * function ConnectButton() {
 *   const {
 *     isConnecting,
 *     connectionError,
 *     hasConnectedWallets,
 *     connect,
 *     disconnect
 *   } = useWalletConnection();
 *
 *   if (hasConnectedWallets) {
 *     return (
 *       <button onClick={() => disconnect()}>
 *         Disconnect
 *       </button>
 *     );
 *   }
 *
 *   return (
 *     <button
 *       onClick={() => connect()}
 *       disabled={isConnecting}
 *     >
 *       {isConnecting ? 'Connecting...' : 'Connect Wallet'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useWalletConnection(): UseWalletConnectionReturn {
  const {
    connectedWallets,
    isConnecting,
    connectionError,
    connect: contextConnect,
    disconnect: contextDisconnect,
  } = useWalletContext();

  const connect = useCallback(async (walletId?: string): Promise<Wallet> => {
    return contextConnect(walletId);
  }, [contextConnect]);

  const disconnect = useCallback(async (walletId?: string): Promise<void> => {
    return contextDisconnect(walletId);
  }, [contextDisconnect]);

  const disconnectAll = useCallback(async (): Promise<void> => {
    const disconnectPromises = connectedWallets.map(wallet =>
      contextDisconnect(wallet.id).catch(console.error)
    );
    await Promise.all(disconnectPromises);
  }, [connectedWallets, contextDisconnect]);

  return {
    isConnecting,
    connectionError,
    hasConnectedWallets: connectedWallets.length > 0,
    connectedWalletCount: connectedWallets.length,
    connect,
    disconnect,
    disconnectAll,
  };
}