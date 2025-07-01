import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWalletNetwork } from './useWalletNetwork';
import {
  createWalletWrapper,
  createMockWalletManager,
  createMockWallet,
  mockWalletNetwork,
} from "../test-utils";
import type { WalletNetwork } from '@pact-toolbox/wallet-core';

describe('useWalletNetwork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return network from primary wallet when no walletId provided', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentNetwork).toBe(mockWalletNetwork);
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBe(null);
        expect(result.current.hasMultipleNetworks).toBe(false);
        expect(result.current.networkCount).toBe(1);
        expect(result.current.wallet).toBe(mockWallet);
      });
    });

    it('should return network from specific wallet when walletId provided', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork('wallet-2'), { wrapper });

      await waitFor(() => {
        expect(result.current.wallet).toBe(mockWallet2);
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
      });
    });

    it('should handle wallet with multiple networks', async () => {
      const network1: WalletNetwork = { ...mockWalletNetwork, id: 'network-1', name: 'Network 1' };
      const network2: WalletNetwork = { ...mockWalletNetwork, id: 'network-2', name: 'Network 2' };
      const networks = [network1, network2];

      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue(networks);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual(networks);
        expect(result.current.hasMultipleNetworks).toBe(true);
        expect(result.current.networkCount).toBe(2);
      });
    });

    it('should handle wallet without multi-network support', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockRejectedValue(new Error('Not supported'));
      mockWallet.getNetwork = vi.fn().mockResolvedValue(mockWalletNetwork);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
        expect(result.current.currentNetwork).toBe(mockWalletNetwork);
        expect(result.current.hasMultipleNetworks).toBe(false);
      });
    });

    it('should handle wallet without getNetworks method', async () => {
      const mockWallet = createMockWallet();
      delete (mockWallet as any).getNetworks; // Remove method
      mockWallet.getNetwork = vi.fn().mockResolvedValue(mockWalletNetwork);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
        expect(result.current.currentNetwork).toBe(mockWalletNetwork);
      });
    });

    it('should handle no wallet connected', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([]);
        expect(result.current.currentNetwork).toBe(null);
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

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork('non-existent-wallet'), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([]);
        expect(result.current.wallet).toBe(null);
      });
    });

    it('should handle network loading error', async () => {
      const error = new Error('Failed to load networks');
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockRejectedValue(error);
      mockWallet.getNetwork = vi.fn().mockRejectedValue(error);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toEqual(expect.objectContaining({
          message: 'Failed to get wallet networks'
        }));
        expect(result.current.availableNetworks).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle loading state', async () => {
      let resolveGetNetworks: (value: WalletNetwork[]) => void;
      const networksPromise = new Promise<WalletNetwork[]>(resolve => {
        resolveGetNetworks = resolve;
      });

      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockReturnValue(networksPromise);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      // Should start loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      act(() => {
        resolveGetNetworks!([mockWalletNetwork]);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
      });
    });

    it('should refresh networks when refreshNetworks is called', async () => {
      const newNetwork: WalletNetwork = { ...mockWalletNetwork, id: 'new-network', name: 'New Network' };
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn()
        .mockResolvedValueOnce([mockWalletNetwork])
        .mockResolvedValueOnce([newNetwork]);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
      });

      // Refresh networks
      await act(async () => {
        await result.current.refreshNetworks();
      });

      expect(result.current.availableNetworks).toEqual([newNetwork]);
      expect(mockWallet.getNetworks).toHaveBeenCalledTimes(2);
    });

    it('should update when wallet changes', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();

      let currentWallet = mockWallet1;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => currentWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletNetwork(), { wrapper });

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

    it('should find current network in available networks', async () => {
      const contextNetwork: WalletNetwork = { ...mockWalletNetwork, id: 'context-network' };
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue([mockWalletNetwork, contextNetwork]);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork, contextNetwork]);
        // Current network should be from context or default
        expect(result.current.currentNetwork).toBeDefined();
      });
    });

    it('should fall back to default network when context network not in list', async () => {
      const defaultNetwork: WalletNetwork = { ...mockWalletNetwork, isDefault: true };
      const networks = [defaultNetwork];
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue(networks);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentNetwork).toBe(defaultNetwork);
      });
    });

    it('should fall back to first network when no default', async () => {
      const networks = [mockWalletNetwork];
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue(networks);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentNetwork).toBe(mockWalletNetwork);
      });
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletNetwork());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        const {
          currentNetwork,
          availableNetworks,
          isLoading,
          error,
          hasMultipleNetworks,
          networkCount,
          refreshNetworks,
          wallet,
        } = result.current;

        // Type checks
        expect(currentNetwork === null || typeof currentNetwork.name === 'string').toBe(true);
        expect(Array.isArray(availableNetworks)).toBe(true);
        expect(typeof isLoading).toBe('boolean');
        expect(error === null || error instanceof Error).toBe(true);
        expect(typeof hasMultipleNetworks).toBe('boolean');
        expect(typeof networkCount).toBe('number');
        expect(typeof refreshNetworks).toBe('function');
        expect(wallet === null || typeof wallet.id === 'string').toBe(true);
      });
    });

    it('should accept optional walletId parameter', async () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      // Should work without walletId
      const { result: result1 } = renderHook(() => useWalletNetwork(), { wrapper });
      expect(result1.current).toBeDefined();

      // Should work with walletId
      const { result: result2 } = renderHook(() => useWalletNetwork('test-wallet'), { wrapper });
      expect(result2.current).toBeDefined();

      // Should work with undefined walletId
      const { result: result3 } = renderHook(() => useWalletNetwork(undefined), { wrapper });
      expect(result3.current).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty networks array from getNetworks', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue([]);
      mockWallet.getNetwork = vi.fn().mockResolvedValue(mockWalletNetwork);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([mockWalletNetwork]);
        expect(result.current.hasMultipleNetworks).toBe(false);
      });
    });

    it('should handle rapid wallet changes', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      let walletId = 'wallet-1';
      const { result, rerender } = renderHook(() => useWalletNetwork(walletId), { wrapper });

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
      mockWallet.getNetworks = vi.fn().mockRejectedValue('String error');
      mockWallet.getNetwork = vi.fn().mockRejectedValue('String error');

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toEqual(expect.objectContaining({
          message: 'Failed to get wallet networks'
        }));
      });
    });

    it('should handle refreshNetworks with no wallet', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await act(async () => {
        await result.current.refreshNetworks();
      });

      expect(result.current.availableNetworks).toEqual([]);
      expect(result.current.wallet).toBe(null);
    });

    it('should provide stable refreshNetworks function', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletNetwork(), { wrapper });

      const refreshNetworks1 = result.current.refreshNetworks;
      rerender();
      const refreshNetworks2 = result.current.refreshNetworks;

      // Function should be stable between renders
      expect(refreshNetworks1).toBe(refreshNetworks2);
    });

    it('should handle network with missing properties', async () => {
      const incompleteNetwork: WalletNetwork = {
        id: 'incomplete',
        name: 'Incomplete Network',
        networkId: 'incomplete',
        url: 'https://incomplete.network',
        chainId: '0',
        // missing isDefault
      } as WalletNetwork;

      const mockWallet = createMockWallet();
      mockWallet.getNetworks = vi.fn().mockResolvedValue([incompleteNetwork]);

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletNetwork(), { wrapper });

      await waitFor(() => {
        expect(result.current.availableNetworks).toEqual([incompleteNetwork]);
        expect(result.current.currentNetwork).toBe(incompleteNetwork);
      });
    });
  });
});