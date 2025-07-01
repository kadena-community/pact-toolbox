import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletSelector, type WalletSelectorProps, type WalletSelectorRenderProps } from './WalletSelector';
import {
  renderWithWalletProvider,
  renderWithoutProvider,
  createMockWalletManager,
  createMockWallet,
  mockWalletMetadata,
  mockWalletMetadata2,
} from "../test-utils";
import type { WalletMetadata } from '@pact-toolbox/wallet-core';

describe('WalletSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should render available wallets', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Test Wallet')).toBeInTheDocument();
      expect(screen.getByText('Test Wallet 2')).toBeInTheDocument();
    });

    it('should render empty state when no wallets available', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([]);

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('No wallets available')).toBeInTheDocument();
    });

    it('should filter wallets by type', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);

      renderWithWalletProvider(
        <WalletSelector filterByType="browser-extension" />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Test Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Test Wallet 2')).not.toBeInTheDocument();
    });

    it('should filter wallets by multiple types', () => {
      const walletMetadata3: WalletMetadata = {
        ...mockWalletMetadata,
        id: 'wallet-3',
        name: 'Wallet 3',
        type: 'desktop',
      };

      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([
        mockWalletMetadata,
        mockWalletMetadata2,
        walletMetadata3,
      ]);

      renderWithWalletProvider(
        <WalletSelector filterByType={['browser-extension', 'mobile']} />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Test Wallet')).toBeInTheDocument();
      expect(screen.getByText('Test Wallet 2')).toBeInTheDocument();
      expect(screen.queryByText('Wallet 3')).not.toBeInTheDocument();
    });

    it('should order wallets according to walletOrder prop', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);

      renderWithWalletProvider(
        <WalletSelector walletOrder={['test-wallet-2', 'test-wallet']} />,
        { walletManager: mockManager }
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('Test Wallet 2');
      expect(buttons[1]).toHaveTextContent('Test Wallet');
    });

    it('should handle auto-connect on wallet selection', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const onSuccess = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector autoConnect={true} onSuccess={onSuccess} />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledWith('test-wallet');
        expect(onSuccess).toHaveBeenCalledWith('test-wallet');
      });
    });

    it('should not auto-connect when autoConnect is false', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn();

      const onWalletSelect = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector autoConnect={false} onWalletSelect={onWalletSelect} />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      expect(onWalletSelect).toHaveBeenCalledWith('test-wallet');
      expect(mockManager.connect).not.toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const onError = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector onError={onError} />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should show connecting state during connection', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockManager.connect = vi.fn().mockReturnValue(connectPromise);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(walletButton).toHaveClass('wallet-selector__wallet--connecting');

      // Resolve connection
      resolveConnect!(createMockWallet());
      await waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      });
    });

    it('should disable all buttons during connection', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);
      mockManager.connect = vi.fn().mockResolvedValue(createMockWallet());

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);

      // Click first wallet
      await user.click(buttons[0]);

      // During connection, buttons should be disabled
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should apply custom grid layout', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletSelector gridColumns={4} />,
        { walletManager: mockManager }
      );

      const container = screen.getByText('Test Wallet').closest('.wallet-selector');
      expect(container).toHaveStyle({ gridTemplateColumns: 'repeat(4, 1fr)' });
    });

    it('should show/hide wallet descriptions', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const { rerender } = renderWithWalletProvider(
        <WalletSelector showDescriptions={true} />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('A test wallet for unit testing')).toBeInTheDocument();

      rerender(<WalletSelector showDescriptions={false} />);

      expect(screen.queryByText('A test wallet for unit testing')).not.toBeInTheDocument();
    });

    it('should apply custom className and styles', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletSelector
          className="custom-class"
          style={{ backgroundColor: 'blue' }}
        />,
        { walletManager: mockManager }
      );

      const container = screen.getByText('Test Wallet').closest('.wallet-selector');
      expect(container).toHaveClass('custom-class');
      expect(container).toHaveStyle({ backgroundColor: 'blue' });
    });

    it('should render custom children with render props', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const customRender = (props: WalletSelectorRenderProps) => (
        <div data-testid="custom-render">
          <p>Available wallets: {props.wallets.length}</p>
          {props.wallets.map(wallet => (
            <button
              key={wallet.id}
              onClick={() => props.onSelectWallet(wallet.id)}
              data-testid={`custom-${wallet.id}`}
            >
              Custom {wallet.name}
            </button>
          ))}
        </div>
      );

      renderWithWalletProvider(
        <WalletSelector>{customRender}</WalletSelector>,
        { walletManager: mockManager }
      );

      expect(screen.getByTestId('custom-render')).toBeInTheDocument();
      expect(screen.getByText('Available wallets: 1')).toBeInTheDocument();
      expect(screen.getByText('Custom Test Wallet')).toBeInTheDocument();
    });

    it('should use custom wallet render function', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const renderWallet = (wallet: WalletMetadata, isConnecting: boolean, onSelect: () => void) => (
        <div key={wallet.id} data-testid={`custom-wallet-${wallet.id}`}>
          <span>Custom: {wallet.name}</span>
          <button onClick={onSelect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Select'}
          </button>
        </div>
      );

      renderWithWalletProvider(
        <WalletSelector renderWallet={renderWallet} />,
        { walletManager: mockManager }
      );

      expect(screen.getByTestId('custom-wallet-test-wallet')).toBeInTheDocument();
      expect(screen.getByText('Custom: Test Wallet')).toBeInTheDocument();
    });

    it('should use custom loading render function', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const renderLoading = () => <div data-testid="custom-loading">Please wait...</div>;

      renderWithWalletProvider(
        <WalletSelector renderLoading={renderLoading} />,
        { walletManager: mockManager }
      );

      // In this test, it's not connecting so loading won't show
      // But we can verify the prop is accepted
      expect(screen.queryByTestId('custom-loading')).not.toBeInTheDocument();
    });

    it('should use custom error render function', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const renderError = (error: Error) => (
        <div data-testid="custom-error">Custom Error: {error.message}</div>
      );

      renderWithWalletProvider(
        <WalletSelector renderError={renderError} />,
        { walletManager: mockManager }
      );

      // Error won't show initially, but prop is accepted
      expect(screen.queryByTestId('custom-error')).not.toBeInTheDocument();
    });

    it('should use custom empty render function', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([]);

      const renderEmpty = () => <div data-testid="custom-empty">No wallets found!</div>;

      renderWithWalletProvider(
        <WalletSelector renderEmpty={renderEmpty} />,
        { walletManager: mockManager }
      );

      expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
      expect(screen.getByText('No wallets found!')).toBeInTheDocument();
    });

    it('should render wallet icons when available', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const icon = screen.getByAltText('Test Wallet');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('src', mockWalletMetadata.icon);
    });

    it('should render icon placeholder when no icon available', () => {
      const walletWithoutIcon: WalletMetadata = {
        ...mockWalletMetadata,
        icon: undefined,
      };

      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([walletWithoutIcon]);

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('T')).toBeInTheDocument(); // First letter placeholder
    });

    it('should display connection error', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      await waitFor(() => {
        expect(screen.getByText('Connection failed: Connection failed')).toBeInTheDocument();
      });
    });

    it('should handle non-Error rejection', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue('String error');

      const onError = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector onError={onError} />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          message: 'String error'
        }));
      });
    });
  });

  describe('without wallet provider', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderWithoutProvider(<WalletSelector />);
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('props interface', () => {
    it('should accept all expected props', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const props: WalletSelectorProps = {
        filterByType: 'browser-extension',
        walletOrder: ['test-wallet'],
        className: 'custom',
        style: { color: 'blue' },
        children: (props) => <div>Custom</div>,
        renderWallet: vi.fn(),
        renderLoading: vi.fn(),
        renderError: vi.fn(),
        renderEmpty: vi.fn(),
        onWalletSelect: vi.fn(),
        onError: vi.fn(),
        onSuccess: vi.fn(),
        autoConnect: true,
        gridColumns: 3,
        showDescriptions: true,
      };

      // Should not throw
      renderWithWalletProvider(
        <WalletSelector {...props} />,
        { walletManager: mockManager }
      );

      expect(screen.getByRole('generic')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle wallets with missing properties', () => {
      const incompleteWallet: WalletMetadata = {
        id: 'incomplete',
        name: 'Incomplete Wallet',
        type: 'browser-extension',
        // Missing description, icon, etc.
      } as WalletMetadata;

      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([incompleteWallet]);

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Incomplete Wallet')).toBeInTheDocument();
    });

    it('should handle rapid wallet selections', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);
      mockManager.connect = vi.fn().mockResolvedValue(createMockWallet());

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const buttons = screen.getAllByRole('button');

      // Rapid clicks
      await user.click(buttons[0]);
      await user.click(buttons[1]);

      // Should handle gracefully
      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalled();
      });
    });

    it('should handle empty wallet order gracefully', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);

      renderWithWalletProvider(
        <WalletSelector walletOrder={[]} />,
        { walletManager: mockManager }
      );

      // Should show wallets in original order
      expect(screen.getByText('Test Wallet')).toBeInTheDocument();
      expect(screen.getByText('Test Wallet 2')).toBeInTheDocument();
    });

    it('should handle wallet order with non-existent wallet IDs', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletSelector walletOrder={['non-existent', 'test-wallet', 'another-non-existent']} />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Test Wallet')).toBeInTheDocument();
    });

    it('should handle wallet type filtering with no matches', () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletSelector filterByType="non-existent-type" />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('No wallets available')).toBeInTheDocument();
    });

    it('should provide correct ARIA attributes', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockManager.connect = vi.fn().mockReturnValue(connectPromise);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const walletButton = screen.getByText('Test Wallet');
      await user.click(walletButton);

      expect(walletButton).toHaveAttribute('aria-busy', 'true');

      resolveConnect!(createMockWallet());
      await waitFor(() => {
        expect(walletButton).toHaveAttribute('aria-busy', 'false');
      });
    });

    it('should maintain consistent state during multiple operations', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata, mockWalletMetadata2]);
      mockManager.connect = vi.fn()
        .mockResolvedValueOnce(createMockWallet())
        .mockRejectedValueOnce(new Error('Second failed'));

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletSelector />,
        { walletManager: mockManager }
      );

      const buttons = screen.getAllByRole('button');

      // First connection succeeds
      await user.click(buttons[0]);
      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledTimes(1);
      });

      // Second connection fails
      await user.click(buttons[1]);
      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });
  });
});