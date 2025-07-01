import type { Wallet, WalletAccount, WalletNetwork } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UsePrimaryWalletReturn {
  wallet: Wallet | null;
  account: WalletAccount | null;
  network: WalletNetwork | null;
  isConnected: boolean;
  setPrimaryWallet: (wallet: Wallet | string) => void;
}

/**
 * Hook to access the primary (active) wallet and related state
 *
 * @returns Object containing primary wallet state and account information
 *
 * @example
 * ```tsx
 * function WalletInfo() {
 *   const { wallet, account, network, isConnected } = usePrimaryWallet();
 *
 *   if (!isConnected) {
 *     return <div>No wallet connected</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Wallet: {wallet.id}</p>
 *       <p>Address: {account?.address}</p>
 *       <p>Network: {network?.name}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrimaryWallet(): UsePrimaryWalletReturn {
  const {
    primaryWallet,
    account,
    network,
    setPrimaryWallet,
  } = useWalletContext();

  return {
    wallet: primaryWallet,
    account,
    network,
    isConnected: !!primaryWallet,
    setPrimaryWallet,
  };
}