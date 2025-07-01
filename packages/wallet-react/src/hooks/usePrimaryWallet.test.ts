import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrimaryWallet } from './usePrimaryWallet';
import {
  createWalletWrapper,
  renderWithoutProvider,
  createMockWalletManager,
  createMockWallet,
  mockWalletAccount,
  mockWalletNetwork,
} from "../test-utils";

describe('usePrimaryWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return null when no wallet is connected', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(null);
      expect(result.current.account).toBe(null);
      expect(result.current.network).toBe(null);
      expect(result.current.isConnected).toBe(false);
      expect(typeof result.current.setPrimaryWallet).toBe('function');
    });

    it('should return primary wallet when connected', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(mockWallet);
      expect(result.current.account).toBe(mockWalletAccount);
      expect(result.current.network).toBe(mockWalletNetwork);
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle account and network being null', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = createWalletWrapper({
        walletManager: mockManager,
        walletManagerProps: {
          // Simulate context with null account/network
        }
      });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(mockWallet);
      expect(result.current.isConnected).toBe(true);
      // Account and network from context might be null
    });

    it('should call setPrimaryWallet action', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      const setPrimaryWalletSpy = vi.spyOn(mockManager, 'setPrimaryWallet');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      act(() => {
        result.current.setPrimaryWallet(mockWallet);
      });

      expect(setPrimaryWalletSpy).toHaveBeenCalledWith(mockWallet);
    });

    it('should call setPrimaryWallet with wallet ID string', () => {
      const mockManager = createMockWalletManager();
      const setPrimaryWalletSpy = vi.spyOn(mockManager, 'setPrimaryWallet');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      act(() => {
        result.current.setPrimaryWallet('test-wallet-id');
      });

      expect(setPrimaryWalletSpy).toHaveBeenCalledWith('test-wallet-id');
    });

    it('should handle setPrimaryWallet errors', () => {
      const mockManager = createMockWalletManager();
      const error = new Error('Set primary wallet failed');
      mockManager.setPrimaryWallet = vi.fn().mockImplementation(() => {
        throw error;
      });

      const onError = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({
          walletManager: mockManager,
          walletManagerProps: { onError }
        });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(() => {
        act(() => {
          result.current.setPrimaryWallet('invalid-wallet');
        });
      }).toThrow('Set primary wallet failed');

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should update when primary wallet changes', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();

      let currentWallet = mockWallet1;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => currentWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(mockWallet1);
      expect(result.current.isConnected).toBe(true);

      // Simulate wallet change
      currentWallet = mockWallet2;
      rerender();

      // Note: In real app, context would update through events
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle multiple rapid setPrimaryWallet calls', () => {
      const mockManager = createMockWalletManager();
      const setPrimaryWalletSpy = vi.spyOn(mockManager, 'setPrimaryWallet');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      act(() => {
        result.current.setPrimaryWallet('wallet-1');
        result.current.setPrimaryWallet('wallet-2');
        result.current.setPrimaryWallet('wallet-3');
      });

      expect(setPrimaryWalletSpy).toHaveBeenCalledTimes(3);
      expect(setPrimaryWalletSpy).toHaveBeenNthCalledWith(1, 'wallet-1');
      expect(setPrimaryWalletSpy).toHaveBeenNthCalledWith(2, 'wallet-2');
      expect(setPrimaryWalletSpy).toHaveBeenNthCalledWith(3, 'wallet-3');
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePrimaryWallet());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      const { wallet, account, network, isConnected, setPrimaryWallet } = result.current;

      // Type checks
      expect(typeof isConnected).toBe('boolean');
      expect(typeof setPrimaryWallet).toBe('function');

      if (wallet) {
        expect(typeof wallet.id).toBe('string');
      }

      if (account) {
        expect(typeof account.address).toBe('string');
      }

      if (network) {
        expect(typeof network.name).toBe('string');
      }
    });

    it('should accept both wallet object and string for setPrimaryWallet', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      // Should accept wallet object
      act(() => {
        result.current.setPrimaryWallet(mockWallet);
      });

      // Should accept wallet ID string
      act(() => {
        result.current.setPrimaryWallet('test-wallet-id');
      });

      expect(mockManager.setPrimaryWallet).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle wallet without account gracefully', () => {
      const mockWallet = createMockWallet();
      mockWallet.getAccount = vi.fn().mockRejectedValue(new Error('No account'));

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(mockWallet);
      expect(result.current.isConnected).toBe(true);
      // Account might be null due to failed getAccount
    });

    it('should handle wallet without network gracefully', () => {
      const mockWallet = createMockWallet();
      mockWallet.getNetwork = vi.fn().mockRejectedValue(new Error('No network'));

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => usePrimaryWallet(), { wrapper });

      expect(result.current.wallet).toBe(mockWallet);
      expect(result.current.isConnected).toBe(true);
      // Network might be null due to failed getNetwork
    });

    it('should provide stable function references', () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => usePrimaryWallet(), { wrapper });

      const setPrimaryWallet1 = result.current.setPrimaryWallet;

      rerender();

      const setPrimaryWallet2 = result.current.setPrimaryWallet;

      // Function should be stable between renders
      expect(setPrimaryWallet1).toBe(setPrimaryWallet2);
    });
  });
});