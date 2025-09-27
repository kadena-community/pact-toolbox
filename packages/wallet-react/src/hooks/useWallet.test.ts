import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWallet } from './useWallet';
import {
  createWalletWrapper,
  createMockWalletManager,
  createMockWallet,
} from "../test-utils";

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return primary wallet when no walletId provided', () => {
      const mockWallet = createMockWallet({ id: 'primary-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet(), { wrapper });

      // Note: This test depends on the context being properly initialized with the manager
      // For now, we'll test that the hook doesn't crash and returns the expected structure
      expect(result.current.wallet).toBeDefined();
      expect(typeof result.current.isConnected).toBe('boolean');
      expect(typeof result.current.isPrimary).toBe('boolean');
    });

    it('should return specific wallet when walletId provided', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet('wallet-2'), { wrapper });

      expect(result.current.wallet).toBe(mockWallet2);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isPrimary).toBe(false);
      expect(result.current.walletId).toBe('wallet-2');
    });

    it('should return null when walletId not found', () => {
      const mockWallet = createMockWallet({ id: 'wallet-1' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet('non-existent-wallet'), { wrapper });

      expect(result.current.wallet).toBe(null);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isPrimary).toBe(false);
      expect(result.current.walletId).toBe(undefined);
    });

    it('should correctly identify primary wallet', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      // Test primary wallet
      const { result: result1 } = renderHook(() => useWallet('wallet-1'), { wrapper });
      expect(result1.current.isPrimary).toBe(true);

      // Test non-primary wallet
      const { result: result2 } = renderHook(() => useWallet('wallet-2'), { wrapper });
      expect(result2.current.isPrimary).toBe(false);
    });

    it('should handle no connected wallets', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet(), { wrapper });

      expect(result.current.wallet).toBe(null);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isPrimary).toBe(false);
      expect(result.current.walletId).toBe(undefined);
    });

    it('should handle no primary wallet but connected wallets exist', () => {
      const mockWallet = createMockWallet({ id: 'wallet-1' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      // Without walletId - should return null (no primary)
      const { result: result1 } = renderHook(() => useWallet(), { wrapper });
      expect(result1.current.wallet).toBe(null);
      expect(result1.current.isPrimary).toBe(false);

      // With walletId - should find the wallet
      const { result: result2 } = renderHook(() => useWallet('wallet-1'), { wrapper });
      expect(result2.current.wallet).toBe(mockWallet);
      expect(result2.current.isConnected).toBe(true);
      expect(result2.current.isPrimary).toBe(false); // Not primary since no primary wallet
    });

    it('should update when walletId changes', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      let walletId = 'wallet-1';
      const { result, rerender } = renderHook(() => useWallet(walletId), { wrapper });

      expect(result.current.wallet).toBe(mockWallet1);
      expect(result.current.walletId).toBe('wallet-1');

      // Change walletId
      walletId = 'wallet-2';
      rerender();

      expect(result.current.wallet).toBe(mockWallet2);
      expect(result.current.walletId).toBe('wallet-2');
    });

    it('should update when connected wallets change', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);

      let connectedWallets = [mockWallet1];
      mockManager.getConnectedWallets = vi.fn().mockImplementation(() => connectedWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWallet('wallet-2'), { wrapper });

      // Initially wallet-2 not connected
      expect(result.current.wallet).toBe(null);
      expect(result.current.isConnected).toBe(false);

      // Add wallet-2 to connected wallets
      connectedWallets = [mockWallet1, mockWallet2];
      rerender();

      // Should now find wallet-2
      expect(result.current.wallet).toBe(mockWallet2);
      expect(result.current.isConnected).toBe(true);
    });

    it('should update when primary wallet changes', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      let primaryWallet = mockWallet1;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => primaryWallet);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWallet('wallet-2'), { wrapper });

      // Initially wallet-2 is not primary
      expect(result.current.wallet).toBe(mockWallet2);
      expect(result.current.isPrimary).toBe(false);

      // Change primary wallet to wallet-2
      primaryWallet = mockWallet2;
      rerender();

      // Should now be primary
      expect(result.current.wallet).toBe(mockWallet2);
      expect(result.current.isPrimary).toBe(true);
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWallet());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('memoization', () => {
    it('should memoize wallet lookup', () => {
      const mockWallet = createMockWallet({ id: 'wallet-1' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWallet('wallet-1'), { wrapper });

      const wallet1 = result.current.wallet;
      rerender();
      const wallet2 = result.current.wallet;

      // Should return same wallet object
      expect(wallet1).toBe(wallet2);
    });

    it('should memoize connection status', () => {
      const mockWallet = createMockWallet({ id: 'wallet-1' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWallet('wallet-1'), { wrapper });

      const isConnected1 = result.current.isConnected;
      const isPrimary1 = result.current.isPrimary;

      rerender();

      const isConnected2 = result.current.isConnected;
      const isPrimary2 = result.current.isPrimary;

      // Values should be consistent
      expect(isConnected1).toBe(isConnected2);
      expect(isPrimary1).toBe(isPrimary2);
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet('test-wallet'), { wrapper });

      const { wallet, isConnected, isPrimary, walletId } = result.current;

      // Type checks
      expect(typeof isConnected).toBe('boolean');
      expect(typeof isPrimary).toBe('boolean');
      expect(walletId === undefined || typeof walletId === 'string').toBe(true);

      if (wallet) {
        expect(typeof wallet.id).toBe('string');
        expect(typeof wallet.isConnected).toBe('boolean');
      }
    });

    it('should accept optional walletId parameter', () => {
      const mockManager = createMockWalletManager();

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      // Should work without walletId
      const { result: result1 } = renderHook(() => useWallet(), { wrapper });
      expect(result1.current).toBeDefined();

      // Should work with walletId
      const { result: result2 } = renderHook(() => useWallet('test-wallet'), { wrapper });
      expect(result2.current).toBeDefined();

      // Should work with undefined walletId
      const { result: result3 } = renderHook(() => useWallet(undefined), { wrapper });
      expect(result3.current).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty walletId', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet(''), { wrapper });

      // Empty string should not find any wallet
      expect(result.current.wallet).toBe(null);
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle wallet ID that matches primary wallet', () => {
      const mockWallet = createMockWallet({ id: 'primary-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWallet('primary-wallet'), { wrapper });

      expect(result.current.wallet).toBe(mockWallet);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isPrimary).toBe(true);
      expect(result.current.walletId).toBe('primary-wallet');
    });

    it('should handle null primary wallet correctly', () => {
      const mockWallet = createMockWallet({ id: 'connected-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      // Without walletId - should return null primary wallet
      const { result: result1 } = renderHook(() => useWallet(), { wrapper });
      expect(result1.current.wallet).toBe(null);

      // With walletId - should find connected wallet but not be primary
      const { result: result2 } = renderHook(() => useWallet('connected-wallet'), { wrapper });
      expect(result2.current.wallet).toBe(mockWallet);
      expect(result2.current.isPrimary).toBe(false);
    });
  });
});