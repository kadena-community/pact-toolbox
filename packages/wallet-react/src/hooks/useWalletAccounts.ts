import { useState, useEffect, useCallback } from 'react';
import type { WalletAccount, Wallet } from '@pact-toolbox/wallet-core';
import { useWalletContext } from '../context';

export interface UseWalletAccountsReturn {
  accounts: WalletAccount[];
  currentAccount: WalletAccount | null;
  isLoading: boolean;
  error: Error | null;
  hasMultipleAccounts: boolean;
  accountCount: number;
  refreshAccounts: () => Promise<void>;
  wallet: Wallet | null;
}

/**
 * Hook to access wallet accounts with multi-account support
 *
 * @param walletId - Optional wallet ID. If not provided, uses primary wallet
 * @returns Object containing account state and utilities
 *
 * @example
 * ```tsx
 * function AccountSelector({ walletId }: { walletId?: string }) {
 *   const {
 *     accounts,
 *     currentAccount,
 *     isLoading,
 *     error,
 *     hasMultipleAccounts,
 *     refreshAccounts
 *   } = useWalletAccounts(walletId);
 *
 *   if (isLoading) return <div>Loading accounts...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!accounts.length) return <div>No accounts found</div>;
 *
 *   return (
 *     <div>
 *       <h3>Accounts</h3>
 *       {accounts.map(account => (
 *         <div key={account.address}>
 *           <p>Address: {account.address}</p>
 *           <p>Balance: {account.balance}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWalletAccounts(walletId?: string): UseWalletAccountsReturn {
  const { connectedWallets, primaryWallet, account: currentAccount } = useWalletContext();

  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get target wallet
  const targetWallet = walletId
    ? connectedWallets.find(w => w.id === walletId)
    : primaryWallet;

  // Refresh accounts from wallet
  const refreshAccounts = useCallback(async (): Promise<void> => {
    if (!targetWallet) {
      setAccounts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let walletAccounts: WalletAccount[] = [];

      // Try to get multiple accounts if supported
      if (targetWallet.getAccounts) {
        try {
          walletAccounts = await targetWallet.getAccounts();
        } catch {
          // Fall back to single account if multi-account not supported
          console.debug('Multi-account not supported, falling back to single account');
        }
      }

      // Fall back to single account
      if (walletAccounts.length === 0) {
        try {
          const singleAccount = await targetWallet.getAccount();
          walletAccounts = [singleAccount];
        } catch {
          throw new Error('Failed to get wallet accounts');
        }
      }

      setAccounts(walletAccounts);
    } catch (err) {
      const accountError = err instanceof Error ? err : new Error(String(err));
      setError(accountError);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [targetWallet]);

  // Refresh accounts when wallet changes
  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // Find current account in accounts list
  const currentAccountInList = currentAccount
    ? accounts.find(acc => acc.address === currentAccount.address) || currentAccount
    : accounts[0] || null;

  return {
    accounts,
    currentAccount: currentAccountInList,
    isLoading,
    error,
    hasMultipleAccounts: accounts.length > 1,
    accountCount: accounts.length,
    refreshAccounts,
    wallet: targetWallet || null,
  };
}