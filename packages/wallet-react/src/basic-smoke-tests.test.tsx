/**
 * Basic smoke tests to verify wallet-react package functionality
 * These tests ensure components and hooks don't throw errors during basic usage
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Import all hooks
import { useWalletManager } from './hooks/useWalletManager';
import { useWallet } from './hooks/useWallet';
import { usePrimaryWallet } from './hooks/usePrimaryWallet';
import { useWalletConnection } from './hooks/useWalletConnection';
import { useAvailableWallets } from './hooks/useAvailableWallets';
import { useWalletAccounts } from './hooks/useWalletAccounts';
import { useWalletNetwork } from './hooks/useWalletNetwork';

// Import all components
import { WalletConnectButton } from './components/WalletConnectButton';
import { WalletInfo } from './components/WalletInfo';
import { WalletSelector } from './components/WalletSelector';

// Import context
import { WalletManagerProvider, useWalletContext } from './context';
import { createMockWalletManager, createMockWallet } from "./test-utils";

describe('Wallet React Package - Basic Smoke Tests', () => {
  describe('Context Provider', () => {
    it('should render without errors', () => {
      const mockManager = createMockWalletManager();

      expect(() => {
        render(
          <WalletManagerProvider walletManager={mockManager}>
            <div>Test Content</div>
          </WalletManagerProvider>
        );
      }).not.toThrow();
    });

    it('should render with config without errors', () => {
      expect(() => {
        render(
          <WalletManagerProvider config={{}}>
            <div>Test Content</div>
          </WalletManagerProvider>
        );
      }).not.toThrow();
    });
  });

  describe('Components - Basic Rendering', () => {
    const mockManager = createMockWalletManager();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletManagerProvider walletManager={mockManager}>
        {children}
      </WalletManagerProvider>
    );

    it('WalletConnectButton should render without errors', () => {
      expect(() => {
        render(<WalletConnectButton />, { wrapper: Wrapper });
      }).not.toThrow();
    });

    it('WalletInfo should render without errors', () => {
      expect(() => {
        render(<WalletInfo />, { wrapper: Wrapper });
      }).not.toThrow();
    });

    it('WalletSelector should render without errors', () => {
      expect(() => {
        render(<WalletSelector />, { wrapper: Wrapper });
      }).not.toThrow();
    });
  });

  describe('Hooks - Basic Usage', () => {
    const mockManager = createMockWalletManager();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletManagerProvider walletManager={mockManager}>
        {children}
      </WalletManagerProvider>
    );

    it('useWalletContext should work without errors', () => {
      expect(() => {
        renderHook(() => useWalletContext(), { wrapper });
      }).not.toThrow();
    });

    it('useWalletManager should work without errors', () => {
      expect(() => {
        renderHook(() => useWalletManager(), { wrapper });
      }).not.toThrow();
    });

    it('useWallet should work without errors', () => {
      expect(() => {
        renderHook(() => useWallet(), { wrapper });
      }).not.toThrow();
    });

    it('usePrimaryWallet should work without errors', () => {
      expect(() => {
        renderHook(() => usePrimaryWallet(), { wrapper });
      }).not.toThrow();
    });

    it('useWalletConnection should work without errors', () => {
      expect(() => {
        renderHook(() => useWalletConnection(), { wrapper });
      }).not.toThrow();
    });

    it('useAvailableWallets should work without errors', () => {
      expect(() => {
        renderHook(() => useAvailableWallets(), { wrapper });
      }).not.toThrow();
    });

    it('useWalletAccounts should work without errors', () => {
      expect(() => {
        renderHook(() => useWalletAccounts(), { wrapper });
      }).not.toThrow();
    });

    it('useWalletNetwork should work without errors', () => {
      expect(() => {
        renderHook(() => useWalletNetwork(), { wrapper });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('useWalletContext should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletContext());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Type Safety', () => {
    it('should export correct TypeScript interfaces', () => {
      // This test verifies that TypeScript compilation succeeds
      // and all expected exports are available
      expect(WalletManagerProvider).toBeDefined();
      expect(useWalletContext).toBeDefined();
      expect(useWalletManager).toBeDefined();
      expect(useWallet).toBeDefined();
      expect(usePrimaryWallet).toBeDefined();
      expect(useWalletConnection).toBeDefined();
      expect(useAvailableWallets).toBeDefined();
      expect(useWalletAccounts).toBeDefined();
      expect(useWalletNetwork).toBeDefined();
      expect(WalletConnectButton).toBeDefined();
      expect(WalletInfo).toBeDefined();
      expect(WalletSelector).toBeDefined();
    });
  });
});