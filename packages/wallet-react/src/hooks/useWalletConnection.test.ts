import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWalletConnection } from './useWalletConnection';
import {
  createWalletWrapper,
  createMockWalletManager,
  createMockWallet,
} from "../test-utils";

describe('useWalletConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should return initial connection state', () => {
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([]);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBe(null);
      expect(result.current.hasConnectedWallets).toBe(false);
      expect(result.current.connectedWalletCount).toBe(0);
      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.disconnectAll).toBe('function');
    });

    it('should return connected wallets state', () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      expect(result.current.hasConnectedWallets).toBe(true);
      expect(result.current.connectedWalletCount).toBe(2);
    });

    it('should connect to wallet successfully', async () => {
      const mockWallet = createMockWallet({ id: 'test-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      let connectedWallet: any;
      await act(async () => {
        connectedWallet = await result.current.connect('test-wallet');
      });

      expect(mockManager.connect).toHaveBeenCalledWith('test-wallet');
      expect(connectedWallet).toBe(mockWallet);
    });

    it('should connect without walletId', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      expect(mockManager.connect).toHaveBeenCalledWith(undefined);
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await expect(
        act(async () => {
          await result.current.connect('test-wallet');
        })
      ).rejects.toThrow('Connection failed');

      expect(mockManager.connect).toHaveBeenCalledWith('test-wallet');
    });

    it('should handle connecting state', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();

      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockManager.connect = vi.fn().mockReturnValue(connectPromise);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      // Start connection
      act(() => {
        result.current.connect('test-wallet');
      });

      // Should be in connecting state
      expect(result.current.isConnecting).toBe(true);

      // Resolve connection
      act(() => {
        resolveConnect!(mockWallet);
      });

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
      });
    });

    it('should disconnect from wallet successfully', async () => {
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.disconnect('test-wallet');
      });

      expect(mockManager.disconnect).toHaveBeenCalledWith('test-wallet');
    });

    it('should disconnect without walletId', async () => {
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockManager.disconnect).toHaveBeenCalledWith(undefined);
    });

    it('should handle disconnection error', async () => {
      const error = new Error('Disconnection failed');
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockRejectedValue(error);

      const onError = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({
          walletManager: mockManager,
          walletManagerProps: { onError }
        });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await expect(
        act(async () => {
          await result.current.disconnect('test-wallet');
        })
      ).rejects.toThrow('Disconnection failed');

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should disconnect all wallets', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.disconnectAll();
      });

      expect(mockManager.disconnect).toHaveBeenCalledTimes(2);
      expect(mockManager.disconnect).toHaveBeenCalledWith('wallet-1');
      expect(mockManager.disconnect).toHaveBeenCalledWith('wallet-2');
    });

    it('should handle disconnectAll with no connected wallets', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([]);
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.disconnectAll();
      });

      expect(mockManager.disconnect).not.toHaveBeenCalled();
    });

    it('should handle partial failures in disconnectAll', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);

      // First disconnect succeeds, second fails
      mockManager.disconnect = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disconnect failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        await result.current.disconnectAll();
      });

      expect(mockManager.disconnect).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should update when connected wallets change', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();

      let connectedWallets: any[] = [];
      mockManager.getConnectedWallets = vi.fn().mockImplementation(() => connectedWallets);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletConnection(), { wrapper });

      expect(result.current.hasConnectedWallets).toBe(false);
      expect(result.current.connectedWalletCount).toBe(0);

      // Add connected wallet
      connectedWallets = [mockWallet];
      rerender();

      expect(result.current.hasConnectedWallets).toBe(true);
      expect(result.current.connectedWalletCount).toBe(1);
    });

    it('should provide stable function references', () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result, rerender } = renderHook(() => useWalletConnection(), { wrapper });

      const connect1 = result.current.connect;
      const disconnect1 = result.current.disconnect;
      const disconnectAll1 = result.current.disconnectAll;

      rerender();

      const connect2 = result.current.connect;
      const disconnect2 = result.current.disconnect;
      const disconnectAll2 = result.current.disconnectAll;

      // Functions should be stable between renders
      expect(connect1).toBe(connect2);
      expect(disconnect1).toBe(disconnect2);
      expect(disconnectAll1).toBe(disconnectAll2);
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletConnection());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('type safety', () => {
    it('should have correct TypeScript types', () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      const {
        isConnecting,
        connectionError,
        hasConnectedWallets,
        connectedWalletCount,
        connect,
        disconnect,
        disconnectAll
      } = result.current;

      // Type checks
      expect(typeof isConnecting).toBe('boolean');
      expect(connectionError === null || connectionError instanceof Error).toBe(true);
      expect(typeof hasConnectedWallets).toBe('boolean');
      expect(typeof connectedWalletCount).toBe('number');
      expect(typeof connect).toBe('function');
      expect(typeof disconnect).toBe('function');
      expect(typeof disconnectAll).toBe('function');
    });

    it('should accept optional walletId in connect and disconnect', async () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      // Should accept walletId
      await act(async () => {
        await result.current.connect('test-wallet');
        await result.current.disconnect('test-wallet');
      });

      // Should accept no walletId
      await act(async () => {
        await result.current.connect();
        await result.current.disconnect();
      });

      expect(mockManager.connect).toHaveBeenCalledTimes(2);
      expect(mockManager.disconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid connect/disconnect calls', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await act(async () => {
        // Rapid calls
        const promises = [
          result.current.connect('wallet-1'),
          result.current.connect('wallet-2'),
          result.current.disconnect('wallet-1'),
          result.current.connect('wallet-3'),
        ];
        await Promise.all(promises);
      });

      expect(mockManager.connect).toHaveBeenCalledTimes(3);
      expect(mockManager.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error rejection in connect', async () => {
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockRejectedValue('Connection failed string');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await expect(
        act(async () => {
          await result.current.connect('test-wallet');
        })
      ).rejects.toThrow('Connection failed string');
    });

    it('should handle non-Error rejection in disconnect', async () => {
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockRejectedValue('Disconnection failed string');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await expect(
        act(async () => {
          await result.current.disconnect('test-wallet');
        })
      ).rejects.toThrow('Disconnection failed string');
    });

    it('should handle manager not initialized error', async () => {
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockRejectedValue(new Error('Wallet manager not initialized'));

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createWalletWrapper({ walletManager: mockManager });

      const { result } = renderHook(() => useWalletConnection(), { wrapper });

      await expect(
        act(async () => {
          await result.current.connect();
        })
      ).rejects.toThrow('Wallet manager not initialized');
    });
  });
});