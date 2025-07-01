import React, { type ReactNode } from 'react';
import { useWalletConnection, useAvailableWallets, usePrimaryWallet } from '../hooks';

/**
 * Props for WalletConnectButton component
 */
export interface WalletConnectButtonProps {
  /** Wallet ID to connect to. If not provided, shows wallet selector */
  walletId?: string;
  /** Custom children content. If not provided, uses default text */
  children?: ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler for additional custom logic */
  onClick?: (walletId?: string) => void;
  /** Error handler */
  onError?: (error: Error) => void;
  /** Success handler */
  onSuccess?: (walletId: string) => void;
  /** Text to show when connecting */
  connectingText?: string;
  /** Text to show when disconnected */
  disconnectedText?: string;
  /** Text to show when connected */
  connectedText?: string;
  /** Whether to show disconnect option when connected */
  showDisconnect?: boolean;
}

/**
 * Wallet Connect Button Component
 *
 * A simple button component for connecting/disconnecting wallets.
 * Handles loading states and error states automatically.
 *
 * @example
 * ```tsx
 * // Basic usage - shows wallet selector
 * <WalletConnectButton />
 *
 * // Connect to specific wallet
 * <WalletConnectButton walletId="ecko" />
 *
 * // Custom styling and handlers
 * <WalletConnectButton
 *   className="my-button"
 *   onSuccess={(walletId) => console.log('Connected to', walletId)}
 *   onError={(error) => console.error('Connection failed:', error)}
 * >
 *   Connect My Wallet
 * </WalletConnectButton>
 * ```
 */
export function WalletConnectButton({
  walletId,
  children,
  className = '',
  style,
  disabled = false,
  onClick,
  onError,
  onSuccess,
  connectingText = 'Connecting...',
  disconnectedText = 'Connect Wallet',
  connectedText = 'Wallet Connected',
  showDisconnect = true,
}: WalletConnectButtonProps): React.JSX.Element {
  const { connect, disconnect, isConnecting, connectionError } = useWalletConnection();
  const { hasWallets, getWalletById } = useAvailableWallets();
  const { isConnected } = usePrimaryWallet();

  const handleClick = async () => {
    try {
      if (onClick) {
        onClick(walletId);
      }

      if (isConnected && showDisconnect) {
        await disconnect(walletId);
      } else {
        const wallet = await connect(walletId);
        if (onSuccess) {
          onSuccess(wallet.id || 'unknown');
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      } else {
        console.error('Wallet connection error:', err);
      }
    }
  };

  // Determine button text
  const getButtonText = (): ReactNode => {
    if (children) {
      return children;
    }

    if (isConnecting) {
      return connectingText;
    }

    if (isConnected && showDisconnect) {
      return connectedText;
    }

    if (walletId) {
      const wallet = getWalletById(walletId);
      return `Connect ${wallet?.name || walletId}`;
    }

    return disconnectedText;
  };

  // Button state classes
  const stateClasses = [
    isConnecting && 'wallet-button--connecting',
    isConnected && 'wallet-button--connected',
    connectionError && 'wallet-button--error',
    disabled && 'wallet-button--disabled',
  ].filter(Boolean).join(' ');

  const finalClassName = `wallet-button ${stateClasses} ${className}`.trim();

  return (
    <button
      type="button"
      className={finalClassName}
      style={style}
      disabled={disabled || isConnecting || !hasWallets}
      onClick={handleClick}
      aria-busy={isConnecting}
      aria-pressed={isConnected}
    >
      {getButtonText()}
    </button>
  );
}