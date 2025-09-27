import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWalletAccounts } from './useWalletAccounts';
import {
  createWalletWrapper,
  createMockWalletManager,
  createMockWallet,
  mockWalletAccount,
} from "../test-utils";
import type { WalletAccount } from '@pact-toolbox/wallet-core';

describe('useWalletAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return accounts from primary wallet when no walletId provided', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount]);
        expect(result.current.currentAccount).toBe(mockWalletAccount);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
        expect(result.current.hasMultipleAccounts).toBe(false);
        expect(result.current.accountCount).toBe(1);
        expect(result.current.wallet).toBe(mockWallet);
      });
    });

    it('should return accounts from specific wallet when walletId provided', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts('wallet-2'), { wrapper });

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet2);
        expect(result.current.accounts).toEqual([mockWalletAccount]);
      });
    });

    it('should handle wallet with multiple accounts', async () => {
      const account1: WalletAccount = { ...mockWalletAccount, address: 'address-1' };
      const account2: WalletAccount = { ...mockWalletAccount, address: 'address-2' };
      const accounts = [account1, account2];

      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockResolvedValue(accounts);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual(accounts);
        expect(result.current.hasMultipleAccounts).toBe(true);
        expect(result.current.accountCount).toBe(2);
      });
    });

    it('should handle wallet without multi-account support', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockRejectedValue(new Error('Not supported'));
      mockWallet.getAccount = vi.fn().mockResolvedValue(mockWalletAccount);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount]);
        expect(result.current.currentAccount).toBe(mockWalletAccount);
        expect(result.current.hasMultipleAccounts).toBe(false);
      });
    });

    it('should handle wallet without getAccounts method', async () => {
      const mockWallet = createMockWallet();
      delete (mockWallet as any).getAccounts; // Remove method
      mockWallet.getAccount = vi.fn().mockResolvedValue(mockWalletAccount);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount]);
        expect(result.current.currentAccount).toBe(mockWalletAccount);
      });
    });

    it('should handle no wallet connected', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([]);
        expect(result.current.currentAccount).toBe(null);
        expect(result.current.wallet).toBe(null);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
      });
    });

    it('should handle wallet not found by ID', async () => {
      const mockWallet = createMockWallet({ id: 'wallet-1' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts('non-existent-wallet'), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([]);
        expect(result.current.wallet).toBe(null);
      });
    });

    it('should handle account loading error', async () => {
      const error = new Error('Failed to load accounts');
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockRejectedValue(error);
      mockWallet.getAccount = vi.fn().mockRejectedValue(error);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toEqual(expect.objectContaining({
          message: 'Failed to get wallet accounts'
        }));
        expect(result.current.accounts).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle loading state', async () => {
      let resolveGetAccounts: (value: WalletAccount[]) => void;
      const accountsPromise = new Promise<WalletAccount[]>(resolve => {
        resolveGetAccounts = resolve;
      });

      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockReturnValue(accountsPromise);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      // Should start loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      act(() => {
        resolveGetAccounts!([mockWalletAccount]);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.accounts).toEqual([mockWalletAccount]);
      });
    });

    it('should refresh accounts when refreshAccounts is called', async () => {
      const newAccount: WalletAccount = { ...mockWalletAccount, address: 'new-address' };
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn()
        .mockResolvedValueOnce([mockWalletAccount])
        .mockResolvedValueOnce([newAccount]);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount]);
      });

      // Refresh accounts
      await act(async () => {
        await result.current.refreshAccounts();
      });

      expect(result.current.accounts).toEqual([newAccount]);
      expect(mockWallet.getAccounts).toHaveBeenCalledTimes(2);
    });

    it('should update when wallet changes', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();

      let currentWallet = mockWallet1;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => currentWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet1);
      });

      // Change wallet
      currentWallet = mockWallet2;
      rerender();

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet2);
      });
    });

    it('should find current account in accounts list', async () => {
      const contextAccount: WalletAccount = { ...mockWalletAccount, address: 'context-address' };
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockResolvedValue([mockWalletAccount, contextAccount]);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount, contextAccount]);
        // Current account should be from context or first in list
        expect(result.current.currentAccount).toBeDefined();
      });
    });

    it('should fall back to first account when context account not in list', async () => {
      const accounts = [mockWalletAccount];
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockResolvedValue(accounts);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentAccount).toBe(mockWalletAccount);
      });
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletAccounts());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        const {
          accounts,
          currentAccount,
          isLoading,
          error,
          hasMultipleAccounts,
          accountCount,
          refreshAccounts,
          wallet,
        } = result.current;

        // Type checks
        expect(Array.isArray(accounts)).toBe(true);
        expect(currentAccount === null || typeof currentAccount.address === 'string').toBe(true);
        expect(typeof isLoading).toBe('boolean');
        expect(error === null || error instanceof Error).toBe(true);
        expect(typeof hasMultipleAccounts).toBe('boolean');
        expect(typeof accountCount).toBe('number');
        expect(typeof refreshAccounts).toBe('function');
        expect(wallet === null || typeof wallet.id === 'string').toBe(true);
      });
    });

    it('should accept optional walletId parameter', async () => {
      const mockManager = createMockWalletManager();

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      // Should work without walletId
      const { result: result1 } = renderHook(() => useWalletAccounts(), { wrapper });
      expect(result1.current).toBeDefined();

      // Should work with walletId
      const { result: result2 } = renderHook(() => useWalletAccounts('test-wallet'), { wrapper });
      expect(result2.current).toBeDefined();

      // Should work with undefined walletId
      const { result: result3 } = renderHook(() => useWalletAccounts(undefined), { wrapper });
      expect(result3.current).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty accounts array from getAccounts', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockResolvedValue([]);
      mockWallet.getAccount = vi.fn().mockResolvedValue(mockWalletAccount);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toEqual([mockWalletAccount]);
        expect(result.current.hasMultipleAccounts).toBe(false);
      });
    });

    it('should handle rapid wallet changes', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      let walletId = 'wallet-1';
      const { result, rerender } = renderHook(() => useWalletAccounts(walletId), { wrapper });

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet1);
      });

      // Rapid changes
      walletId = 'wallet-2';
      rerender();
      walletId = 'wallet-1';
      rerender();
      walletId = 'wallet-2';
      rerender();

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet2);
      });
    });

    it('should handle non-Error rejection', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getAccounts = vi.fn().mockRejectedValue('String error');
      mockWallet.getAccount = vi.fn().mockRejectedValue('String error');

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toEqual(expect.objectContaining({
          message: 'Failed to get wallet accounts'
        }));
      });
    });

    it('should handle refreshAccounts with no wallet', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletAccounts(), { wrapper });

      await act(async () => {
        await result.current.refreshAccounts();
      });

      expect(result.current.accounts).toEqual([]);
      expect(result.current.wallet).toBe(null);
    });

    it('should provide stable refreshAccounts function', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletAccounts(), { wrapper });

      const refreshAccounts1 = result.current.refreshAccounts;
      rerender();
      const refreshAccounts2 = result.current.refreshAccounts;

      // Function should be stable between renders
      expect(refreshAccounts1).toBe(refreshAccounts2);
    });
  });
});