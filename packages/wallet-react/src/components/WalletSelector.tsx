import React, { useState, type ReactNode } from 'react';
import type { WalletMetadata } from '@pact-toolbox/wallet-core';
import { useAvailableWallets, useWalletConnection } from '../hooks';

/**
 * Props for WalletSelector component
 */
export interface WalletSelectorProps {
  /** Filter wallets by type */
  filterByType?: string | string[];
  /** Custom wallet ordering */
  walletOrder?: string[];
  /** Additional CSS class names */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Custom children render function */
  children?: (props: WalletSelectorRenderProps) => ReactNode;
  /** Custom render function for each wallet option */
  renderWallet?: (wallet: WalletMetadata, isConnecting: boolean, onSelect: () => void) => ReactNode;
  /** Custom render function for loading state */
  renderLoading?: () => ReactNode;
  /** Custom render function for error state */
  renderError?: (error: Error) => ReactNode;
  /** Custom render function for empty state */
  renderEmpty?: () => ReactNode;
  /** Selection handler */
  onWalletSelect?: (walletId: string) => void;
  /** Error handler */
  onError?: (error: Error) => void;
  /** Success handler */
  onSuccess?: (walletId: string) => void;
  /** Whether to auto-connect on selection */
  autoConnect?: boolean;
  /** Grid layout configuration */
  gridColumns?: number;
  /** Show wallet descriptions */
  showDescriptions?: boolean;
}

/**
 * Render props interface for custom rendering
 */
export interface WalletSelectorRenderProps {
  wallets: WalletMetadata[];
  isConnecting: boolean;
  connectingWalletId: string | null;
  onSelectWallet: (walletId: string) => void;
  error: Error | null;
}

/**
 * Wallet Selector Component
 *
 * Displays available wallets and allows users to select and connect to them.
 * Supports filtering, custom ordering, and flexible rendering options.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <WalletSelector />
 *
 * // Filter by wallet type
 * <WalletSelector filterByType={['browser-extension', 'mobile']} />
 *
 * // Custom ordering
 * <WalletSelector walletOrder={['ecko', 'chainweaver', 'zelcore']} />
 *
 * // Custom rendering
 * <WalletSelector>
 *   {({ wallets, onSelectWallet, isConnecting }) => (
 *     <div className="custom-wallet-grid">
 *       {wallets.map(wallet => (
 *         <button key={wallet.id} onClick={() => onSelectWallet(wallet.id)}>
 *           {wallet.name}
 *         </button>
 *       ))}
 *     </div>
 *   )}
 * </WalletSelector>
 * ```
 */
export function WalletSelector({
  filterByType,
  walletOrder = [],
  className = '',
  style,
  children,
  renderWallet,
  renderLoading,
  renderError,
  renderEmpty,
  onWalletSelect,
  onError,
  onSuccess,
  autoConnect = true,
  gridColumns = 3,
  showDescriptions = true,
}: WalletSelectorProps): React.JSX.Element {
  const { availableWallets, hasWallets } = useAvailableWallets();
  const { connect, isConnecting } = useWalletConnection();

  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Filter wallets by type
  const filteredWallets = React.useMemo(() => {
    if (!filterByType) return availableWallets;

    const types = Array.isArray(filterByType) ? filterByType : [filterByType];
    return availableWallets.filter(wallet => types.includes(wallet.type));
  }, [availableWallets, filterByType]);

  // Sort wallets by custom order
  const sortedWallets = React.useMemo(() => {
    if (walletOrder.length === 0) return filteredWallets;

    const ordered: WalletMetadata[] = [];
    const unordered: WalletMetadata[] = [];

    filteredWallets.forEach(wallet => {
      const orderIndex = walletOrder.indexOf(wallet.id);
      if (orderIndex >= 0) {
        ordered[orderIndex] = wallet;
      } else {
        unordered.push(wallet);
      }
    });

    return [...ordered.filter(Boolean), ...unordered];
  }, [filteredWallets, walletOrder]);

  const handleWalletSelect = async (walletId: string) => {
    setError(null);
    setConnectingWalletId(walletId);

    try {
      if (onWalletSelect) {
        onWalletSelect(walletId);
      }

      if (autoConnect) {
        await connect(walletId);
        if (onSuccess) {
          onSuccess(walletId);
        }
      }
    } catch (err) {
      const connectionError = err instanceof Error ? err : new Error(String(err));
      setError(connectionError);

      if (onError) {
        onError(connectionError);
      }
    } finally {
      setConnectingWalletId(null);
    }
  };

  // Render props
  const renderProps: WalletSelectorRenderProps = {
    wallets: sortedWallets,
    isConnecting: isConnecting || connectingWalletId !== null,
    connectingWalletId,
    onSelectWallet: handleWalletSelect,
    error,
  };

  // Custom children rendering
  if (children) {
    return (
      <div className={`wallet-selector ${className}`} style={style}>
        {children(renderProps)}
      </div>
    );
  }

  // Loading state
  if (isConnecting && renderLoading) {
    return (
      <div className={`wallet-selector wallet-selector--loading ${className}`} style={style}>
        {renderLoading()}
      </div>
    );
  }

  // Error state
  if (error && renderError) {
    return (
      <div className={`wallet-selector wallet-selector--error ${className}`} style={style}>
        {renderError(error)}
      </div>
    );
  }

  // Empty state
  if (!hasWallets) {
    if (renderEmpty) {
      return (
        <div className={`wallet-selector wallet-selector--empty ${className}`} style={style}>
          {renderEmpty()}
        </div>
      );
    }

    return (
      <div className={`wallet-selector wallet-selector--empty ${className}`} style={style}>
        <p>No wallets available</p>
      </div>
    );
  }

  // Default grid layout
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
    gap: '1rem',
    ...style,
  };

  return (
    <div className={`wallet-selector ${className}`} style={gridStyle}>
      {sortedWallets.map(wallet => {
        const isWalletConnecting = connectingWalletId === wallet.id;

        if (renderWallet) {
          return renderWallet(wallet, isWalletConnecting, () => handleWalletSelect(wallet.id));
        }

        return (
          <button
            key={wallet.id}
            type="button"
            className={`wallet-selector__wallet ${isWalletConnecting ? 'wallet-selector__wallet--connecting' : ''}`}
            disabled={isConnecting}
            onClick={() => handleWalletSelect(wallet.id)}
            aria-busy={isWalletConnecting}
          >
            {/* Wallet Icon */}
            <div className="wallet-selector__wallet-icon">
              {wallet.icon ? (
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="wallet-selector__wallet-icon-image"
                />
              ) : (
                <div className="wallet-selector__wallet-icon-placeholder">
                  {wallet.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Wallet Name */}
            <div className="wallet-selector__wallet-name">
              {wallet.name}
            </div>

            {/* Wallet Description */}
            {showDescriptions && wallet.description && (
              <div className="wallet-selector__wallet-description">
                {wallet.description}
              </div>
            )}

            {/* Loading indicator */}
            {isWalletConnecting && (
              <div className="wallet-selector__wallet-loading">
                Connecting...
              </div>
            )}
          </button>
        );
      })}

      {/* Error display */}
      {error && (
        <div className="wallet-selector__error">
          <p>Connection failed: {error.message}</p>
        </div>
      )}
    </div>
  );
}