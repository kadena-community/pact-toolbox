import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAvailableWallets } from './useAvailableWallets';
import {
  createWalletWrapper,
  createMockWalletManager,
  mockWalletMetadata,
  mockWalletMetadata2,
} from "../test-utils";
import type { WalletMetadata } from '@pact-toolbox/wallet-core';

describe('useAvailableWallets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return available wallets when provided', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.availableWallets).toEqual(availableWallets);
      expect(result.current.hasWallets).toBe(true);
      expect(result.current.walletCount).toBe(2);
    });

    it('should return empty state when no wallets available', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([]);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.availableWallets).toEqual([]);
      expect(result.current.hasWallets).toBe(false);
      expect(result.current.walletCount).toBe(0);
    });

    it('should provide getWalletById function', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.getWalletById('test-wallet')).toBe(mockWalletMetadata);
      expect(result.current.getWalletById('test-wallet-2')).toBe(mockWalletMetadata2);
      expect(result.current.getWalletById('non-existent')).toBe(undefined);
    });

    it('should group wallets by type', () => {
      const walletMetadata3: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'test-wallet-3',
        name: 'Test Wallet 3',
        type: 'browser-extension',
      };

      const availableWallets = [mockWalletMetadata, mockWalletMetadata2, walletMetadata3];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletsByType).toEqual({
        'browser-extension': [mockWalletMetadata, walletMetadata3],
        'mobile': [mockWalletMetadata2],
      });

      expect(result.current.walletTypes).toEqual(['browser-extension', 'mobile']);
    });

    it('should handle wallets without type', () => {
      const walletWithoutType: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'no-type-wallet',
        type: undefined as any,
      };

      const availableWallets = [mockWalletMetadata, walletWithoutType];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletsByType).toEqual({
        'browser-extension': [mockWalletMetadata],
        'unknown': [walletWithoutType],
      });
    });

    it('should provide getWalletsByType function', () => {
      const walletMetadata3: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'test-wallet-3',
        name: 'Test Wallet 3',
        type: 'browser-extension',
      };

      const availableWallets = [mockWalletMetadata, mockWalletMetadata2, walletMetadata3];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.getWalletsByType('browser-extension')).toEqual([
        mockWalletMetadata,
        walletMetadata3,
      ]);
      expect(result.current.getWalletsByType('mobile')).toEqual([mockWalletMetadata2]);
      expect(result.current.getWalletsByType('non-existent')).toEqual([]);
    });

    it('should update when available wallets change', () => {
      const mockManager = createMockWalletManager();

      let availableWallets = [mockWalletMetadata];
      mockManager.getAvailableWallets = vi.fn().mockImplementation(() => availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletCount).toBe(1);
      expect(result.current.getWalletById('test-wallet')).toBe(mockWalletMetadata);

      // Add another wallet
      availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      rerender();

      expect(result.current.walletCount).toBe(2);
      expect(result.current.getWalletById('test-wallet-2')).toBe(mockWalletMetadata2);
    });

    it('should memoize walletsByType computation', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useAvailableWallets(), { wrapper });

      const walletsByType1 = result.current.walletsByType;
      rerender();
      const walletsByType2 = result.current.walletsByType;

      // Should be same object reference if wallets haven't changed
      expect(walletsByType1).toBe(walletsByType2);
    });

    it('should memoize getWalletById function', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useAvailableWallets(), { wrapper });

      const getWalletById1 = result.current.getWalletById;
      rerender();
      const getWalletById2 = result.current.getWalletById;

      // Should be same function reference if wallets haven't changed
      expect(getWalletById1).toBe(getWalletById2);
    });

    it('should memoize getWalletsByType function', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useAvailableWallets(), { wrapper });

      const getWalletsByType1 = result.current.getWalletsByType;
      rerender();
      const getWalletsByType2 = result.current.getWalletsByType;

      // Should be same function reference if wallets haven't changed
      expect(getWalletsByType1).toBe(getWalletsByType2);
    });

    it('should handle large number of wallets efficiently', () => {
      const largeWalletList: WalletMetadata[] = [];
      for (let i = 0; i < 100; i++) {
        largeWalletList.push({
          ...mockWalletMetadata,
          id: `wallet-${i}`,
          name: `Wallet ${i}`,
          type: i % 2 === 0 ? 'browser-extension' : 'mobile',
        });
      }

      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(largeWalletList);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletCount).toBe(100);
      expect(result.current.getWalletById('wallet-50')).toBeDefined();
      expect(result.current.getWalletsByType('browser-extension')).toHaveLength(50);
      expect(result.current.getWalletsByType('mobile')).toHaveLength(50);
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAvailableWallets());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      const availableWallets = [mockWalletMetadata, mockWalletMetadata2];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      const {
        availableWallets: wallets,
        hasWallets,
        walletCount,
        getWalletById,
        walletsByType,
        getWalletsByType,
        walletTypes,
      } = result.current;

      // Type checks
      expect(Array.isArray(wallets)).toBe(true);
      expect(typeof hasWallets).toBe('boolean');
      expect(typeof walletCount).toBe('number');
      expect(typeof getWalletById).toBe('function');
      expect(typeof walletsByType).toBe('object');
      expect(typeof getWalletsByType).toBe('function');
      expect(Array.isArray(walletTypes)).toBe(true);

      // Function return type checks
      const wallet = getWalletById('test-wallet');
      if (wallet) {
        expect(typeof wallet.id).toBe('string');
        expect(typeof wallet.name).toBe('string');
      }

      const walletsOfType = getWalletsByType('browser-extension');
      expect(Array.isArray(walletsOfType)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty wallet type gracefully', () => {
      const walletWithEmptyType: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'empty-type-wallet',
        type: '' as any,
      };

      const availableWallets = [mockWalletMetadata, walletWithEmptyType];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletsByType).toEqual({
        'browser-extension': [mockWalletMetadata],
        'unknown': [walletWithEmptyType],
      });
    });

    it('should handle null/undefined wallet type', () => {
      const walletWithNullType: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'null-type-wallet',
        type: null as any,
      };

      const availableWallets = [mockWalletMetadata, walletWithNullType];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.walletsByType).toEqual({
        'browser-extension': [mockWalletMetadata],
        'unknown': [walletWithNullType],
      });
    });

    it('should handle duplicate wallet IDs', () => {
      const duplicateWallet: WalletMetadata = {
        ...mockWalletMetadata,
        name: 'Duplicate Test Wallet',
      };

      const availableWallets = [mockWalletMetadata, duplicateWallet];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      // getWalletById should return the first matching wallet
      const wallet = result.current.getWalletById('test-wallet');
      expect(wallet).toBe(duplicateWallet); // Map uses last entry for duplicate keys
    });

    it('should handle wallets with special characters in ID', () => {
      const specialWallet: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'test-wallet@special#chars',
        name: 'Special Chars Wallet',
      };

      const availableWallets = [mockWalletMetadata, specialWallet];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useAvailableWallets(), { wrapper });

      expect(result.current.getWalletById('test-wallet@special#chars')).toBe(specialWallet);
    });

    it('should provide stable return values', () => {
      const availableWallets = [mockWalletMetadata];
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(availableWallets);

      const wrapper = createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useAvailableWallets(), { wrapper });

      const wallets1 = result.current.availableWallets;
      const hasWallets1 = result.current.hasWallets;
      const walletCount1 = result.current.walletCount;

      rerender();

      const wallets2 = result.current.availableWallets;
      const hasWallets2 = result.current.hasWallets;
      const walletCount2 = result.current.walletCount;

      // Values should be consistent
      expect(wallets1).toBe(wallets2);
      expect(hasWallets1).toBe(hasWallets2);
      expect(walletCount1).toBe(walletCount2);
    });
  });
});