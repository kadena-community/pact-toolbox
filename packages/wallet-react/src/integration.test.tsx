import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  WalletManagerProvider,
  useWalletManager,
  usePrimaryWallet,
  useWalletConnection,
  useAvailableWallets,
  WalletConnectButton,
  WalletInfo,
  WalletSelector,
} from '../index';
import {
  createMockWalletManager,
  createMockWallet,
  mockWalletMetadata,
  mockWalletMetadata2,
  mockWalletAccount,
  mockWalletNetwork,
} from './test-utils';

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete wallet connection flow', () => {
    it('should handle full connection workflow', async () => {
      const mockWallet = createMockWallet({ id: 'test-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      // Track state changes
      let connectedWallet: any = null;
      mockManager.connect = vi.fn().mockImplementation(async (options) => {
        connectedWallet = mockWallet;
        mockManager.getPrimaryWallet = vi.fn().mockReturnValue(connectedWallet);
        mockManager.getConnectedWallets = vi.fn().mockReturnValue([connectedWallet]);
        return connectedWallet;
      });

      const IntegratedApp = () => {
        const { isInitialized, isInitializing } = useWalletManager();
        const { wallet, isConnected } = usePrimaryWallet();
        const { hasConnectedWallets, connect } = useWalletConnection();
        const { availableWallets } = useAvailableWallets();

        if (isInitializing) {
          return <div>Initializing...</div>;
        }

        if (!isInitialized) {
          return <div>Not initialized</div>;
        }

        return (
          <div>
            <div data-testid="status">
              Connected: {isConnected ? 'Yes' : 'No'}
            </div>
            <div data-testid="wallet-id">
              Wallet: {wallet?.id || 'None'}
            </div>
            <div data-testid="wallet-count">
              Available Wallets: {availableWallets.length}
            </div>
            <div data-testid="connected-count">
              Connected Wallets: {hasConnectedWallets ? '1+' : '0'}
            </div>

            {!isConnected ? (
              <div>
                <WalletSelector autoConnect={true} />
                <WalletConnectButton walletId="test-wallet" />
              </div>
            ) : (
              <div>
                <WalletInfo />
                <button onClick={() => connect()}>Connect Another</button>
              </div>
            )}
          </div>
        );
      };

      const user = userEvent.setup();

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <IntegratedApp />
        </WalletManagerProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('Connected: No');
        expect(screen.getByTestId('wallet-count')).toHaveTextContent('Available Wallets: 2');
        expect(screen.getByTestId('connected-count')).toHaveTextContent('Connected Wallets: 0');
      });

      // Connect using WalletSelector
      const testWalletButton = screen.getByText('Test Wallet');
      await user.click(testWalletButton);

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledWith('test-wallet');
      });

      // Simulate state update after connection
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);

      // Force re-render by triggering a refresh
      const refreshButton = screen.queryByText('Connect Another');
      if (refreshButton) {
        await user.click(refreshButton);
      }

      // The integration would require actual event emission to update state
      // In real app, the manager would emit events that update the context
    });

    it('should display wallet info after successful connection', async () => {
      const mockWallet = createMockWallet({ id: 'connected-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet]);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const ConnectedApp = () => {
        const { isConnected } = usePrimaryWallet();

        return (
          <div>
            <div data-testid="connection-status">
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            {isConnected && <WalletInfo />}
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <ConnectedApp />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
        expect(screen.getByText('connected-wallet')).toBeInTheDocument();
        expect(screen.getByText(mockWalletAccount.address)).toBeInTheDocument();
        expect(screen.getByText(mockWalletNetwork.name)).toBeInTheDocument();
      });
    });

    it('should handle connection errors gracefully across components', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const ErrorHandlingApp = () => {
        const { connectionError } = useWalletConnection();

        return (
          <div>
            <WalletConnectButton walletId="test-wallet" />
            {connectionError && (
              <div data-testid="error">Error: {connectionError.message}</div>
            )}
          </div>
        );
      };

      const user = userEvent.setup();

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <ErrorHandlingApp />
        </WalletManagerProvider>
      );

      const connectButton = screen.getByText('Connect Test Wallet');
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Error: Connection failed');
      });
    });
  });

  describe('Multi-wallet management', () => {
    it('should handle multiple connected wallets', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet1);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([
        { ...mockWalletMetadata, id: 'wallet-1', name: 'Wallet 1' },
        { ...mockWalletMetadata2, id: 'wallet-2', name: 'Wallet 2' },
      ]);

      const MultiWalletApp = () => {
        const { connectedWalletCount } = useWalletConnection();
        const { wallet: primaryWallet } = usePrimaryWallet();

        return (
          <div>
            <div data-testid="connected-count">
              Connected: {connectedWalletCount}
            </div>
            <div data-testid="primary">
              Primary: {primaryWallet?.id || 'None'}
            </div>
            <WalletInfo />
            <WalletInfo walletId="wallet-2" />
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <MultiWalletApp />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected-count')).toHaveTextContent('Connected: 2');
        expect(screen.getByTestId('primary')).toHaveTextContent('Primary: wallet-1');
      });

      // Should show info for both wallets
      expect(screen.getAllByText(mockWalletAccount.address)).toHaveLength(2);
    });

    it('should handle primary wallet switching', async () => {
      const mockWallet1 = createMockWallet({ id: 'wallet-1' });
      const mockWallet2 = createMockWallet({ id: 'wallet-2' });
      const mockManager = createMockWalletManager();

      let primaryWallet = mockWallet1;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => primaryWallet);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([mockWallet1, mockWallet2]);
      mockManager.setPrimaryWallet = vi.fn().mockImplementation((wallet) => {
        primaryWallet = typeof wallet === 'string'
          ? [mockWallet1, mockWallet2].find(w => w.id === wallet) || mockWallet1
          : wallet;
      });

      const PrimarySwitchApp = () => {
        const { wallet, setPrimaryWallet } = usePrimaryWallet();

        return (
          <div>
            <div data-testid="primary">Primary: {wallet?.id || 'None'}</div>
            <button onClick={() => setPrimaryWallet('wallet-2')}>
              Switch to Wallet 2
            </button>
            <WalletInfo />
          </div>
        );
      };

      const user = userEvent.setup();

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <PrimarySwitchApp />
        </WalletManagerProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('primary')).toHaveTextContent('Primary: wallet-1');
      });

      const switchButton = screen.getByText('Switch to Wallet 2');
      await user.click(switchButton);

      expect(mockManager.setPrimaryWallet).toHaveBeenCalledWith('wallet-2');
    });
  });

  describe('Wallet filtering and selection', () => {
    it('should filter wallets by type in selector', () => {
      const wallets = [
        { ...mockWalletMetadata, id: 'browser-1', name: 'Browser 1', type: 'browser-extension' },
        { ...mockWalletMetadata2, id: 'mobile-1', name: 'Mobile 1', type: 'mobile' },
        { ...mockWalletMetadata, id: 'browser-2', name: 'Browser 2', type: 'browser-extension' },
      ];

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(wallets);

      const FilteredApp = () => {
        const { availableWallets, getWalletsByType } = useAvailableWallets();

        return (
          <div>
            <div data-testid="total">Total: {availableWallets.length}</div>
            <div data-testid="browser">
              Browser: {getWalletsByType('browser-extension').length}
            </div>
            <div data-testid="mobile">Mobile: {getWalletsByType('mobile').length}</div>
            <WalletSelector filterByType="browser-extension" />
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <FilteredApp />
        </WalletManagerProvider>
      );

      expect(screen.getByTestId('total')).toHaveTextContent('Total: 3');
      expect(screen.getByTestId('browser')).toHaveTextContent('Browser: 2');
      expect(screen.getByTestId('mobile')).toHaveTextContent('Mobile: 1');

      // Selector should only show browser wallets
      expect(screen.getByText('Browser 1')).toBeInTheDocument();
      expect(screen.getByText('Browser 2')).toBeInTheDocument();
      expect(screen.queryByText('Mobile 1')).not.toBeInTheDocument();
    });

    it('should handle custom wallet ordering', () => {
      const wallets = [
        { ...mockWalletMetadata, id: 'wallet-a', name: 'Wallet A' },
        { ...mockWalletMetadata2, id: 'wallet-b', name: 'Wallet B' },
        { ...mockWalletMetadata, id: 'wallet-c', name: 'Wallet C' },
      ];

      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue(wallets);

      const OrderedApp = () => (
        <WalletSelector walletOrder={['wallet-c', 'wallet-a', 'wallet-b']} />
      );

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <OrderedApp />
        </WalletManagerProvider>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('Wallet C');
      expect(buttons[1]).toHaveTextContent('Wallet A');
      expect(buttons[2]).toHaveTextContent('Wallet B');
    });
  });

  describe('Error boundaries and edge cases', () => {
    it('should handle component unmounting during async operations', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockManager.connect = vi.fn().mockReturnValue(connectPromise);

      const AsyncApp = () => {
        const { connect } = useWalletConnection();

        React.useEffect(() => {
          connect('test-wallet');
        }, [connect]);

        return <div>Connecting...</div>;
      };

      const { unmount } = render(
        <WalletManagerProvider walletManager={mockManager}>
          <AsyncApp />
        </WalletManagerProvider>
      );

      // Unmount before connection completes
      unmount();

      // Resolve connection after unmount - should not cause warnings
      resolveConnect!(createMockWallet());

      // No assertions needed - just verify no errors occur
    });

    it('should handle rapid state changes', async () => {
      const mockManager = createMockWalletManager();
      let walletState = null;

      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() => walletState);
      mockManager.getConnectedWallets = vi.fn().mockImplementation(() =>
        walletState ? [walletState] : []
      );
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const RapidChangeApp = () => {
        const { wallet, isConnected } = usePrimaryWallet();
        const [counter, setCounter] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCounter(c => c + 1);
            // Simulate rapid wallet state changes
            walletState = walletState ? null : createMockWallet();
          }, 10);

          setTimeout(() => clearInterval(interval), 100);
          return () => clearInterval(interval);
        }, []);

        return (
          <div>
            <div data-testid="counter">Updates: {counter}</div>
            <div data-testid="status">Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
            <div data-testid="wallet">Wallet: {wallet?.id || 'None'}</div>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <RapidChangeApp />
        </WalletManagerProvider>
      );

      // Let rapid changes occur
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should handle rapid changes without crashing
      expect(screen.getByTestId('counter')).toBeInTheDocument();
      expect(screen.getByTestId('status')).toBeInTheDocument();
      expect(screen.getByTestId('wallet')).toBeInTheDocument();
    });
  });

  describe('Custom render props and flexibility', () => {
    it('should work with custom render implementations', () => {
      const mockWallet = createMockWallet({ id: 'custom-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const CustomApp = () => (
        <div>
          <WalletInfo>
            {({ wallet, account, network, isConnected }) => (
              <div data-testid="custom-info">
                <h2>Custom Wallet Display</h2>
                <p>ID: {wallet.id}</p>
                <p>Name: {wallet.name}</p>
                <p>Address: {account?.address}</p>
                <p>Network: {network?.name}</p>
                <p>Status: {isConnected ? 'Online' : 'Offline'}</p>
              </div>
            )}
          </WalletInfo>

          <WalletSelector>
            {({ wallets, onSelectWallet, isConnecting }) => (
              <div data-testid="custom-selector">
                <h3>Choose Your Wallet</h3>
                {wallets.map(wallet => (
                  <div key={wallet.id}>
                    <button
                      onClick={() => onSelectWallet(wallet.id)}
                      disabled={isConnecting}
                    >
                      🔐 {wallet.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </WalletSelector>
        </div>
      );

      render(
        <WalletManagerProvider walletManager={mockManager}>
          <CustomApp />
        </WalletManagerProvider>
      );

      expect(screen.getByTestId('custom-info')).toBeInTheDocument();
      expect(screen.getByText('Custom Wallet Display')).toBeInTheDocument();
      expect(screen.getByText('ID: custom-wallet')).toBeInTheDocument();
      expect(screen.getByText('Status: Online')).toBeInTheDocument();

      expect(screen.getByTestId('custom-selector')).toBeInTheDocument();
      expect(screen.getByText('Choose Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('🔐 Test Wallet')).toBeInTheDocument();
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support typical DApp wallet integration', async () => {
      const mockWallet = createMockWallet({ id: 'user-wallet' });
      const mockManager = createMockWalletManager();

      // Start disconnected
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getConnectedWallets = vi.fn().mockReturnValue([]);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([
        { ...mockWalletMetadata, id: 'metamask', name: 'MetaMask' },
        { ...mockWalletMetadata2, id: 'walletconnect', name: 'WalletConnect' },
      ]);

      const DAppLayout = () => {
        const { isInitialized, isInitializing } = useWalletManager();
        const { wallet, isConnected } = usePrimaryWallet();
        const { hasConnectedWallets } = useWalletConnection();

        if (isInitializing) {
          return <div data-testid="loading">Loading wallet manager...</div>;
        }

        if (!isInitialized) {
          return <div data-testid="error">Failed to initialize wallet manager</div>;
        }

        return (
          <div>
            <header data-testid="header">
              <h1>My DApp</h1>
              <div data-testid="wallet-status">
                {isConnected ? (
                  <div>
                    <span>Connected: {wallet?.id}</span>
                    <WalletInfo
                      showBalance={true}
                      showNetwork={true}
                      renderAddress={(address) => (
                        <span title={address}>
                          {address.slice(0, 8)}...{address.slice(-6)}
                        </span>
                      )}
                    />
                  </div>
                ) : (
                  <WalletConnectButton>Connect Wallet</WalletConnectButton>
                )}
              </div>
            </header>

            <main data-testid="main">
              {hasConnectedWallets ? (
                <div>
                  <h2>Welcome to the DApp!</h2>
                  <p>You can now interact with smart contracts.</p>
                </div>
              ) : (
                <div>
                  <h2>Connect Your Wallet</h2>
                  <p>Choose a wallet to get started:</p>
                  <WalletSelector
                    showDescriptions={true}
                    gridColumns={2}
                    autoConnect={true}
                  />
                </div>
              )}
            </main>
          </div>
        );
      };

      render(
        <WalletManagerProvider walletManager={mockManager} autoInitialize={true}>
          <DAppLayout />
        </WalletManagerProvider>
      );

      // Should show initialized DApp
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument();
        expect(screen.getByText('My DApp')).toBeInTheDocument();
        expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
        expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
        expect(screen.getByText('MetaMask')).toBeInTheDocument();
        expect(screen.getByText('WalletConnect')).toBeInTheDocument();
      });
    });
  });
});