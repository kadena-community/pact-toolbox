import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletConnectButton, type WalletConnectButtonProps } from './WalletConnectButton';
import {
  renderWithWalletProvider,
  renderWithoutProvider,
  createMockWalletManager,
  createMockWallet,
  mockWalletMetadata,
  mockWalletMetadata2,
} from "../test-utils";

describe('WalletConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with wallet provider', () => {
    it('should render connect button when no wallet connected', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('should render connected state when wallet is connected', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    });

    it('should render specific wallet name when walletId provided', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton walletId="test-wallet" />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Connect Test Wallet')).toBeInTheDocument();
    });

    it('should render connecting state during connection', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      // Mock connect to take time
      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockManager.connect = vi.fn().mockReturnValue(connectPromise);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Resolve the connection
      resolveConnect!(createMockWallet());
      await waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      });
    });

    it('should handle successful connection', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const onSuccess = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton onSuccess={onSuccess} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledWith(undefined);
        expect(onSuccess).toHaveBeenCalledWith('test-wallet');
      });
    });

    it('should handle connection with specific walletId', async () => {
      const mockWallet = createMockWallet({ id: 'specific-wallet' });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton walletId="specific-wallet" />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledWith('specific-wallet');
      });
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const onError = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton onError={onError} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });

      consoleSpy.mockRestore();
    });

    it('should handle connection error with console fallback', async () => {
      const error = new Error('Connection failed');
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Wallet connection error:', error);
      });

      consoleSpy.mockRestore();
    });

    it('should handle disconnection when connected and showDisconnect enabled', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton showDisconnect={true} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(mockManager.disconnect).toHaveBeenCalledWith(undefined);
      });
    });

    it('should not disconnect when showDisconnect is false', async () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);
      mockManager.disconnect = vi.fn().mockResolvedValue(undefined);

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton showDisconnect={false} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalled();
        expect(mockManager.disconnect).not.toHaveBeenCalled();
      });
    });

    it('should call custom onClick handler', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(createMockWallet());

      const onClick = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton onClick={onClick} walletId="test-wallet" />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onClick).toHaveBeenCalledWith('test-wallet');
    });

    it('should render custom children', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton>
          <span>Custom Connect Text</span>
        </WalletConnectButton>,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Custom Connect Text')).toBeInTheDocument();
    });

    it('should apply custom className and styles', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton
          className="custom-class"
          style={{ backgroundColor: 'red' }}
        />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveStyle({ backgroundColor: 'red' });
    });

    it('should be disabled when disabled prop is true', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton disabled={true} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when no wallets available', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([]);

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should use custom text props', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton
          connectingText="Please wait..."
          disconnectedText="Link Wallet"
          connectedText="Wallet Linked"
        />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Link Wallet')).toBeInTheDocument();
    });

    it('should apply state-based CSS classes', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton disabled={true} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('wallet-button');
      expect(button).toHaveClass('wallet-button--disabled');
    });

    it('should set ARIA attributes correctly', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(mockWallet);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('aria-busy', 'false');
    });

    it('should handle non-Error rejection', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockRejectedValue('String error');

      const onError = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton onError={onError} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

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
        renderWithoutProvider(<WalletConnectButton />);
      }).toThrow('useWalletContext must be used within a WalletManagerProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('props interface', () => {
    it('should accept all expected props', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const props: WalletConnectButtonProps = {
        walletId: 'test-wallet',
        children: <span>Custom</span>,
        className: 'custom',
        style: { color: 'blue' },
        disabled: false,
        onClick: vi.fn(),
        onError: vi.fn(),
        onSuccess: vi.fn(),
        connectingText: 'Connecting...',
        disconnectedText: 'Connect',
        connectedText: 'Connected',
        showDisconnect: true,
      };

      // Should not throw
      renderWithWalletProvider(
        <WalletConnectButton {...props} />,
        { walletManager: mockManager }
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle wallet with undefined ID', async () => {
      const mockWallet = createMockWallet({ id: undefined as any });
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(mockWallet);

      const onSuccess = vi.fn();
      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton onSuccess={onSuccess} />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('unknown');
      });
    });

    it('should handle wallet metadata not found for walletId', () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      renderWithWalletProvider(
        <WalletConnectButton walletId="non-existent-wallet" />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Connect non-existent-wallet')).toBeInTheDocument();
    });

    it('should handle rapid button clicks', async () => {
      const mockManager = createMockWalletManager();
      mockManager.getPrimaryWallet = vi.fn().mockReturnValue(null);
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);
      mockManager.connect = vi.fn().mockResolvedValue(createMockWallet());

      const user = userEvent.setup();

      renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      const button = screen.getByRole('button');

      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only call connect once due to disabled state during connection
      await waitFor(() => {
        expect(mockManager.connect).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain button state consistency', () => {
      const mockWallet = createMockWallet();
      const mockManager = createMockWalletManager();

      let isConnected = false;
      mockManager.getPrimaryWallet = vi.fn().mockImplementation(() =>
        isConnected ? mockWallet : null
      );
      mockManager.getAvailableWallets = vi.fn().mockReturnValue([mockWalletMetadata]);

      const { rerender } = renderWithWalletProvider(
        <WalletConnectButton />,
        { walletManager: mockManager }
      );

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();

      // Simulate connection
      isConnected = true;
      rerender(<WalletConnectButton />);

      // Note: In real app, this would be updated through context events
      // Here we just verify the component structure is consistent
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});