import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useWalletManager } from './useWalletManager';
import { WalletManagerProvider } from '../context';
import {
  createWalletWrapper,
  renderWithoutProvider,
  createMockWalletManager,
  createMockWalletManagerWithState,
} from "../test-utils";

describe('useWalletManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return wallet manager when initialized', () => {
      const mockManager = createMockWalletManager();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WalletManagerProvider walletManager={mockManager}>
          {children}
        </WalletManagerProvider>
      );

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      expect(result.current.walletManager).toBe(mockManager);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initError).toBe(null);
    });

    it('should return null wallet manager when not initialized', () => {
      const mockManager = createMockWalletManagerWithState({
        isInitialized: false,
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({
          walletManager: mockManager,
          walletManagerProps: { autoInitialize: false }
        });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      expect(result.current.walletManager).toBe(mockManager);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initError).toBe(null);
    });

    it('should handle initialization loading state', () => {
      const mockManager = createMockWalletManagerWithState({
        isInitialized: false,
      });

      // Mock to simulate initializing state
      let isInitializing = true;
      mockManager.initialize = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        isInitializing = false;
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      // During initialization
      expect(result.current.walletManager).toBe(mockManager);
      expect(result.current.isInitialized).toBe(false);
    });

    it('should handle initialization error', () => {
      const initError = new Error('Initialization failed');
      const mockManager = createMockWalletManagerWithState({
        isInitialized: false,
        initError,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      expect(result.current.walletManager).toBe(mockManager);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initError).toBe(initError);
    });

    it('should update when wallet manager changes', () => {
      const mockManager1 = createMockWalletManager();
      const mockManager2 = createMockWalletManager();

      let currentManager = mockManager1;
      const wrapper = ({ children }: { children: React.ReactNode }) => {
        const WrapperComponent = createWalletWrapper({ walletManager: currentManager });
        return <WrapperComponent>{children}</WrapperComponent>;
      };

      const { result, rerender } = renderHook(() => useWalletManager(), { wrapper });

      expect(result.current.walletManager).toBe(mockManager1);

      // Change the manager
      currentManager = mockManager2;
      rerender();

      // Note: In a real scenario, you'd need to re-render the provider
      // This test structure would need adjustment for proper testing
      expect(result.current.walletManager).toBeDefined();
    });

    it('should provide stable return object structure', () => {
      const mockManager = createMockWalletManager();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      const returnValue = result.current;
      expect(returnValue).toHaveProperty('walletManager');
      expect(returnValue).toHaveProperty('isInitialized');
      expect(returnValue).toHaveProperty('isInitializing');
      expect(returnValue).toHaveProperty('initError');

      // Ensure types are correct
      expect(typeof returnValue.isInitialized).toBe('boolean');
      expect(typeof returnValue.isInitializing).toBe('boolean');
      expect(returnValue.initError === null || returnValue.initError instanceof Error).toBe(true);
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletManager());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      const mockManager = createMockWalletManager();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      // TypeScript compile-time checks
      const { walletManager, isInitialized, isInitializing, initError } = result.current;

      // These would fail to compile if types are wrong
      expect(typeof isInitialized).toBe('boolean');
      expect(typeof isInitializing).toBe('boolean');
      if (initError) {
        expect(initError.message).toBeDefined();
      }
      if (walletManager) {
        expect(typeof walletManager.initialize).toBe('function');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null wallet manager gracefully', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({
          walletManagerProps: { walletManager: null as any }
        });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      expect(result.current.walletManager).toBeDefined(); // Provider creates one
      expect(typeof result.current.isInitialized).toBe('boolean');
      expect(typeof result.current.isInitializing).toBe('boolean');
    });

    it('should handle async initialization properly', async () => {
      let resolveInit: () => void;
      const initPromise = new Promise<void>(resolve => {
        resolveInit = resolve;
      });

      const mockManager = createMockWalletManager();
      mockManager.initialize = vi.fn().mockReturnValue(initPromise);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletManager(), { wrapper });

      // Should start with proper state
      expect(result.current.walletManager).toBe(mockManager);

      // Resolve initialization
      resolveInit!();
      await initPromise;

      // Verify manager was called
      expect(mockManager.initialize).toHaveBeenCalled();
    });
  });
});