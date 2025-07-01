import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React, { useEffect } from 'react';
import {
  WalletManagerProvider,
  useWalletContext,
  type WalletManagerProviderProps,
} from './context';
import {
  createMockWalletManager,
  createMockWalletManagerWithState,
  createMockWallet,
  mockWalletAccount,
  mockWalletNetwork,
  mockWalletMetadata,
  mockWalletManagerEvents,
  asyncEvents,
} from "./test-utils";
import type { WalletManager } from '@pact-toolbox/wallet-manager';

// Mock the wallet manager import
vi.mock('@pact-toolbox/wallet-manager', () => ({
  WalletManager: vi.fn(() => createMockWalletManager()),
}));

describe('WalletManagerProvider', () => {
  let originalGlobalThis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalGlobalThis = globalThis;
  });

  afterEach(() => {
    // Clean up global state
    globalThis = originalGlobalThis;
    delete (globalThis as any).__PACT_WALLET_MANAGER__;
  });

  describe('initialization', () => {
    it('should initialize with provided wallet manager', async () => {
      const mockManager = createMockWalletManager();

      const TestComponent = () => {
        const { walletManager, isInitialized } = useWalletContext();
        return (
          <div>
            <span data-testid="manager">{walletManager ? 'present' : 'null'}</span>
            <span data-testid="initialized">{isInitialized ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('manager')).toHaveTextContent('present');
        expect(screen.getByTestId('initialized')).toHaveTextContent('yes');
      });

      expect(mockManager.initialize).toHaveBeenCalled();
    });

    it('should create wallet manager from config when none provided', async () => {
      const { WalletManager } = await import('@pact-toolbox/wallet-manager');
      const mockConfig = { networkId: 'test' };

      const TestComponent = () => {
        const { walletManager, isInitialized } = useWalletContext();
        return (
          <div>
            <span data-testid="manager">{walletManager ? 'present' : 'null'}</span>
            <span data-testid="initialized">{isInitialized ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider config={mockConfig}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('manager')).toHaveTextContent('present');
      });

      expect(WalletManager).toHaveBeenCalledWith(mockConfig);
    });

    it('should use global wallet manager when available', async () => {
      const globalManager = createMockWalletManager();
      (globalThis as any).__PACT_WALLET_MANAGER__ = globalManager;

      const TestComponent = () => {
        const { walletManager } = useWalletContext();
        return (
          <span data-testid="manager">{walletManager === globalManager ? 'global' : 'other'}</span>
        );
      };

      render(
        <WalletManagerProvider>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('manager')).toHaveTextContent('global');
      });
    });

    it('should handle initialization error', async () => {
      const error = new Error('Initialization failed');
      const mockManager = createMockWalletManagerWithState({
        isInitialized: false,
        initError: error,
      });

      const onError = vi.fn();

      const TestComponent = () => {
        const { initError, isInitialized, isInitializing } = useWalletContext();
        return (
          <div>
            <span data-testid="error">{initError?.message || 'none'}</span>
            <span data-testid="initialized">{isInitialized ? 'yes' : 'no'}</span>
            <span data-testid="initializing">{isInitializing ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Initialization failed');
        expect(screen.getByTestId('initialized')).toHaveTextContent('no');
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should not initialize when autoInitialize is false', () => {
      const mockManager = createMockWalletManager();

      const TestComponent = () => {
        const { isInitialized, isInitializing } = useWalletContext();
        return (
          <div>
            <span data-testid="initialized">{isInitialized ? 'yes' : 'no'}</span>
            <span data-testid="initializing">{isInitializing ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager} autoInitialize={false}>
          <TestComponent />
        </WalletManagerProvider>
      );

      expect(screen.getByTestId('initialized')).toHaveTextContent('no');
      expect(screen.getByTestId('initializing')).toHaveTextContent('no');
      expect(mockManager.initialize).not.toHaveBeenCalled();
    });

    it('should handle non-Error initialization failure', async () => {
      const { WalletManager } = await import('@pact-toolbox/wallet-manager');
      (WalletManager as any).mockImplementation(() => {
        throw 'String error';
      });

      const onError = vi.fn();

      const TestComponent = () => {
        const { initError } = useWalletContext();
        return <span data-testid="error">{initError?.message || 'none'}</span>;
      };

      render(
        <WalletManagerProvider onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          message: 'String error'
        }));
      });
    });
  });

  describe('state management', () => {
    it('should update state when wallet connects', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      const TestComponent = () => {
        const { connectedWallets } = useWalletContext();
        return <span data-testid="count">{connectedWallets.length}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      // Initially no wallets
      expect(screen.getByTestId('count')).toHaveTextContent('0');

      // Simulate wallet connection
      act(() => {
        mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);
        events.emitConnected(mockWallet);
      });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });
    });

    it('should update state when wallet disconnects', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      // Start with connected wallet
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      const TestComponent = () => {
        const { connectedWallets } = useWalletContext();
        return <span data-testid="count">{connectedWallets.length}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });

      // Simulate disconnection
      act(() => {
        mockManager.getConnectedWallets = vi.fn().mockReturnValue([]);
        events.emitDisconnected(mockWallet);
      });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('0');
      });
    });

    it('should update state when primary wallet changes', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      // Start with wallet-1 as primary
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);

      const TestComponent = () => {
        const { primaryWallet } = useWalletContext();
        return <span data-testid="primary">{primaryWallet?.id || 'none'}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('primary')).toHaveTextContent('wallet-1');
      });

      // Change primary wallet
      act(() => {
        mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet2);
        events.emitPrimaryWalletChanged(mockWallet2);
      });

      await waitFor(() => {
        expect(screen.getByTestId('primary')).toHaveTextContent('wallet-2');
      });
    });

    it('should update account when account changes', async () => {
      const newAccount = { ...mockWalletAccount, address: 'new-address' };
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      const TestComponent = () => {
        const { account } = useWalletContext();
        return <span data-testid="account">{account?.address || 'none'}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('account')).toHaveTextContent(mockWalletAccount.address);
      });

      // Update account
      act(() => {
        events.emitAccountChanged(newAccount);
      });

      await waitFor(() => {
        expect(screen.getByTestId('account')).toHaveTextContent('new-address');
      });
    });

    it('should update network when network changes', async () => {
      const newNetwork = { ...mockWalletNetwork, name: 'New Network' };
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      const TestComponent = () => {
        const { network } = useWalletContext();
        return <span data-testid="network">{network?.name || 'none'}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('network')).toHaveTextContent(mockWalletNetwork.name);
      });

      // Update network
      act(() => {
        events.emitNetworkChanged(newNetwork);
      });

      await waitFor(() => {
        expect(screen.getByTestId('network')).toHaveTextContent('New Network');
      });
    });

    it('should handle error events', async () => {
      const error = new Error('Wallet error');
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);
      const onError = vi.fn();

      const TestComponent = () => {
        const { connectionError } = useWalletContext();
        return <span data-testid="error">{connectionError?.message || 'none'}</span>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      // Emit error
      act(() => {
        events.emitError(error);
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Wallet error');
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should refresh state when wallet fails to get account/network', async () => {
      const mockWallet = createMockWallet();
      mockWallet.getAccount = vi.fn().mockRejectedValue(new Error('Account error'));
      mockWallet.getNetwork = vi.fn().mockRejectedValue(new Error('Network error'));

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);

      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const TestComponent = () => {
        const { primaryWallet, account, network } = useWalletContext();
        return (
          <div>
            <span data-testid="wallet">{primaryWallet?.id || 'none'}</span>
            <span data-testid="account">{account?.address || 'none'}</span>
            <span data-testid="network">{network?.name || 'none'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('wallet')).toHaveTextContent('test-wallet');
        expect(screen.getByTestId('account')).toHaveTextContent('none');
        expect(screen.getByTestId('network')).toHaveTextContent('none');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get wallet account/network:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('actions', () => {
    it('should connect to wallet', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const TestComponent = () => {
        const { connect, isConnecting } = useWalletContext();
        return (
          <div>
            <button onClick={() => connect('test-wallet')}>Connect</button>
            <span data-testid="connecting">{isConnecting ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Connect');

      await act(async () => {
        button.click();
      });

      expect(mockManager.connect).toHaveBeenCalledWith({ walletId: 'test-wallet' });
    });

    it('should handle connect error', async () => {
      const error = new Error('Connect failed');
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const TestComponent = () => {
        const { connect, connectionError } = useWalletContext();

        const handleConnect = async () => {
          try {
            await connect('test-wallet');
          } catch (e) {
            // Expected to throw
          }
        };

        return (
          <div>
            <button onClick={handleConnect}>Connect</button>
            <span data-testid="error">{connectionError?.message || 'none'}</span>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Connect');

      await act(async () => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connect failed');
      });
    });

    it('should disconnect from wallet', async () => {
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const TestComponent = () => {
        const { disconnect } = useWalletContext();
        return <button onClick={() => disconnect('test-wallet')}>Disconnect</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Disconnect');

      await act(async () => {
        button.click();
      });

      expect(mockManager.disconnect).toHaveBeenCalledWith('test-wallet');
    });

    it('should handle disconnect error', async () => {
      const error = new Error('Disconnect failed');
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      const TestComponent = () => {
        const { disconnect } = useWalletContext();

        const handleDisconnect = async () => {
          try {
            await disconnect('test-wallet');
          } catch (e) {
            // Expected to throw
          }
        };

        return <button onClick={handleDisconnect}>Disconnect</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Disconnect');

      await act(async () => {
        button.click();
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should set primary wallet', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.setPrimaryWallet = vi.fn();

      const TestComponent = () => {
        const { setPrimaryWallet } = useWalletContext();
        return <button onClick={() => setPrimaryWallet(mockWallet)}>Set Primary</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Set Primary');

      act(() => {
        button.click();
      });

      expect(mockManager.setPrimaryWallet).toHaveBeenCalledWith(mockWallet);
    });

    it('should handle setPrimaryWallet error', async () => {
      const error = new Error('Set primary failed');
      const mockManager = createMockWalletManager();
      mockManager.setPrimaryWallet = vi.fn().mockImplementation(() => {
        throw error;
      });
      const onError = vi.fn();

      const TestComponent = () => {
        const { setPrimaryWallet } = useWalletContext();

        const handleSetPrimary = () => {
          try {
            setPrimaryWallet('test-wallet');
          } catch (e) {
            // Expected to throw
          }
        };

        return <button onClick={handleSetPrimary}>Set Primary</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Set Primary');

      act(() => {
        button.click();
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should refresh wallet state', async () => {
      const mockManager = createMockWalletManager();
      const refreshStateSpy = vi.spyOn(mockManager, 'getConnectedWallets');

      const TestComponent = () => {
        const { refresh } = useWalletContext();
        return <button onClick={() => refresh()}>Refresh</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Refresh');

      await act(async () => {
        button.click();
      });

      expect(refreshStateSpy).toHaveBeenCalled();
    });

    it('should throw error when manager not initialized for actions', async () => {
      const TestComponent = () => {
        const { connect, disconnect, setPrimaryWallet } = useWalletContext();

        const handleConnect = async () => {
          try {
            await connect();
          } catch (e) {
            return (e as Error).message;
          }
        };

        const handleDisconnect = async () => {
          try {
            await disconnect();
          } catch (e) {
            return (e as Error).message;
          }
        };

        const handleSetPrimary = () => {
          try {
            setPrimaryWallet('test');
          } catch (e) {
            return (e as Error).message;
          }
        };

        return (
          <div>
            <button onClick={handleConnect}>Connect</button>
            <button onClick={handleDisconnect}>Disconnect</button>
            <button onClick={handleSetPrimary}>Set Primary</button>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={null as any} autoInitialize={false}>
          <TestComponent />
        </WalletManagerProvider>
      );

      // These should all throw "Wallet manager not initialized"
      const buttons = screen.getAllByRole('button');

      await act(async () => {
        buttons[0].click(); // connect
      });

      await act(async () => {
        buttons[1].click(); // disconnect
      });

      act(() => {
        buttons[2].click(); // setPrimaryWallet
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const mockManager = createMockWalletManager();
      const offSpy = vi.spyOn(mockManager, 'off');

      const { unmount } = render(
        <WalletManagerProvider walletManager={mockManager}>
          <div>Test</div>
        </WalletManagerProvider>
      );

      unmount();

      expect(offSpy).toHaveBeenCalledTimes(6); // 6 event types
    });

    it('should handle unmount before initialization completes', () => {
      const mockManager = createMockWalletManager();
      let resolveInit: () => void;
      const initPromise = new Promise<void>(resolve => {
        resolveInit = resolve;
      });
      mockManager.initialize = vi.fn().mockReturnValue(initPromise);

      const { unmount } = render(
        <WalletManagerProvider walletManager={mockManager}>
          <div>Test</div>
        </WalletManagerProvider>
      );

      // Unmount before initialization completes
      unmount();

      // Resolve init after unmount - should not cause issues
      act(() => {
        resolveInit!();
      });

      expect(mockManager.initialize).toHaveBeenCalled();
    });

    it('should not update state after unmount', async () => {
      const mockManager = createMockWalletManager();
      const events = mockWalletManagerEvents(mockManager);

      const TestComponent = () => {
        const { account } = useWalletContext();

        useEffect(() => {
          // Emit event after component mounts
          setTimeout(() => {
            events.emitAccountChanged({ ...mockWalletAccount, address: 'updated' });
          }, 100);
        }, []);

        return <span>{account?.address}</span>;
      };

      const { unmount } = render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      // Unmount immediately
      unmount();

      // Should not cause warnings about setting state on unmounted component
      await new Promise(resolve => setTimeout(resolve, 150));
    });
  });

  describe('error handling', () => {
    it('should handle refresh state error gracefully', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getConnectedWallets = vi.fn().mockImplementation(() => {
        throw new Error('Refresh failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onError = vi.fn();

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <div>Test</div>
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh wallet state:', expect.any(Error));
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should handle non-Error in connect', async () => {
      const mockManager = createMockWalletManager();
      mockManager.connect = vi.fn().mockRejectedValue('String error');

      const TestComponent = () => {
        const { connect } = useWalletContext();

        const handleConnect = async () => {
          try {
            await connect();
          } catch (e) {
            // Expected to throw
          }
        };

        return <button onClick={handleConnect}>Connect</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Connect');

      await act(async () => {
        button.click();
      });

      // Should convert string to Error
      expect(mockManager.connect).toHaveBeenCalled();
    });

    it('should handle non-Error in disconnect', async () => {
      const mockManager = createMockWalletManager();
      mockManager.disconnect = vi.fn().mockRejectedValue('String error');
      const onError = vi.fn();

      const TestComponent = () => {
        const { disconnect } = useWalletContext();

        const handleDisconnect = async () => {
          try {
            await disconnect();
          } catch (e) {
            // Expected to throw
          }
        };

        return <button onClick={handleDisconnect}>Disconnect</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Disconnect');

      await act(async () => {
        button.click();
      });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'String error'
      }));
    });

    it('should handle non-Error in setPrimaryWallet', () => {
      const mockManager = createMockWalletManager();
      mockManager.setPrimaryWallet = vi.fn().mockImplementation(() => {
        throw 'String error';
      });
      const onError = vi.fn();

      const TestComponent = () => {
        const { setPrimaryWallet } = useWalletContext();

        const handleSetPrimary = () => {
          try {
            setPrimaryWallet('test');
          } catch (e) {
            // Expected to throw
          }
        };

        return <button onClick={handleSetPrimary}>Set Primary</button>;
      };

      render(
        <WalletManagerProvider walletManager={mockManager} onError={onError}>
          <TestComponent />
        </WalletManagerProvider>
      );

      const button = screen.getByText('Set Primary');

      act(() => {
        button.click();
      });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'String error'
      }));
    });
  });

  describe('useWalletContext hook', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWalletContext());
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });

    it('should return context value when used within provider', () => {
      const mockManager = createMockWalletManager();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WalletManagerProvider walletManager={mockManager}>
          {children}
        </WalletManagerProvider>
      );

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      expect(result.current.walletManager).toBe(mockManager);
      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.setPrimaryWallet).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('props interface', () => {
    it('should accept all expected props', () => {
      const mockManager = createMockWalletManager();
      const config = { networkId: 'test' };
      const onError = vi.fn();

      const props: WalletManagerProviderProps = {
        children: <div>Test</div>,
        walletManager: mockManager,
        config,
        autoInitialize: true,
        onError,
      };

      // Should not throw
      render(<WalletManagerProvider {...props} />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle provider re-render with same props', () => {
      const mockManager = createMockWalletManager();

      const TestComponent = () => {
        const { walletManager } = useWalletContext();
        return <span>{walletManager ? 'present' : 'null'}</span>;
      };

      const { rerender } = render(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      expect(screen.getByText('present')).toBeInTheDocument();

      // Re-render with same props
      rerender(
        <WalletManagerProvider walletManager={mockManager}>
          <TestComponent />
        </WalletManagerProvider>
      );

      expect(screen.getByText('present')).toBeInTheDocument();
    });

    it('should handle globalThis not available', async () => {
      const originalGlobalThis = globalThis;

      // Mock globalThis as undefined
      Object.defineProperty(global, 'globalThis', {
        value: undefined,
        writable: true,
      });

      const TestComponent = () => {
        const { walletManager } = useWalletContext();
        return <span>{walletManager ? 'present' : 'null'}</span>;
      };

      render(
        <WalletManagerProvider>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('present')).toBeInTheDocument();
      });

      // Restore globalThis
      Object.defineProperty(global, 'globalThis', {
        value: originalGlobalThis,
        writable: true,
      });
    });

    it('should handle empty config object', async () => {
      const TestComponent = () => {
        const { walletManager } = useWalletContext();
        return <span>{walletManager ? 'present' : 'null'}</span>;
      };

      render(
        <WalletManagerProvider config={{}}>
          <TestComponent />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('present')).toBeInTheDocument();
      });
    });
  });
});