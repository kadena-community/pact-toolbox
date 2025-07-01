import React, { type ReactNode } from 'react';
import { usePrimaryWallet, useWalletAccounts } from '../hooks';

/**
 * Props for WalletInfo component
 */
export interface WalletInfoProps {
  /** Wallet ID to display info for. If not provided, uses primary wallet */
  walletId?: string;
  /** Whether to show account balance */
  showBalance?: boolean;
  /** Whether to show network information */
  showNetwork?: boolean;
  /** Whether to show connection timestamp */
  showConnectionTime?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Custom render function for the entire component */
  children?: (props: WalletInfoRenderProps) => ReactNode;
  /** Custom render function for the wallet icon */
  renderIcon?: (iconUrl?: string, walletName?: string) => ReactNode;
  /** Custom render function for the wallet name */
  renderName?: (name?: string) => ReactNode;
  /** Custom render function for the account address */
  renderAddress?: (address: string) => ReactNode;
  /** Custom render function for the balance */
  renderBalance?: (balance?: number) => ReactNode;
  /** Custom render function for the network */
  renderNetwork?: (networkName?: string) => ReactNode;
}

/**
 * Render props interface for custom rendering
 */
export interface WalletInfoRenderProps {
  wallet: {
    id?: string;
    name?: string;
    icon?: string;
  };
  account: {
    address: string;
    balance?: number;
    connectedAt?: Date;
  } | null;
  network: {
    name: string;
    networkId: string;
    url: string;
  } | null;
  isConnected: boolean;
}

/**
 * Wallet Info Component
 *
 * Displays information about a connected wallet including account details,
 * balance, and network information.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <WalletInfo />
 *
 * // Show specific wallet
 * <WalletInfo walletId="ecko" showBalance showNetwork />
 *
 * // Custom rendering
 * <WalletInfo>
 *   {({ wallet, account, network, isConnected }) => (
 *     <div>
 *       <h3>{wallet.name}</h3>
 *       {account && <p>Address: {account.address}</p>}
 *       {network && <p>Network: {network.name}</p>}
 *     </div>
 *   )}
 * </WalletInfo>
 * ```
 */
export function WalletInfo({
  walletId,
  showBalance = true,
  showNetwork = true,
  showConnectionTime = false,
  className = '',
  style,
  children,
  renderIcon,
  renderName,
  renderAddress,
  renderBalance,
  renderNetwork,
}: WalletInfoProps): React.JSX.Element {
  const { wallet, account, network, isConnected } = usePrimaryWallet();
  const { accounts } = useWalletAccounts(walletId);

  // Use specific wallet if walletId provided
  const targetWallet = walletId ? { id: walletId } : wallet;
  const targetAccount = walletId ? accounts[0] : account;

  if (!isConnected || !targetWallet || !targetAccount) {
    return (
      <div className={`wallet-info wallet-info--disconnected ${className}`} style={style}>
        <p>No wallet connected</p>
      </div>
    );
  }

  // Prepare render props
  const renderProps: WalletInfoRenderProps = {
    wallet: {
      id: targetWallet.id,
      name: targetWallet.id, // Could be enhanced with metadata lookup
      icon: undefined, // Could be enhanced with metadata lookup
    },
    account: targetAccount ? {
      address: targetAccount.address,
      balance: targetAccount.balance,
      connectedAt: targetAccount.connectedAt,
    } : null,
    network: network ? {
      name: network.name,
      networkId: network.networkId,
      url: network.url,
    } : null,
    isConnected,
  };

  // Custom render function
  if (children) {
    return (
      <div className={`wallet-info ${className}`} style={style}>
        {children(renderProps)}
      </div>
    );
  }

  // Default rendering
  return (
    <div className={`wallet-info wallet-info--connected ${className}`} style={style}>
      {/* Wallet Header */}
      <div className="wallet-info__header">
        {renderIcon ? (
          renderIcon(renderProps.wallet.icon, renderProps.wallet.name)
        ) : (
          <div className="wallet-info__icon">
            {renderProps.wallet.icon ? (
              <img
                src={renderProps.wallet.icon}
                alt={renderProps.wallet.name}
                className="wallet-info__icon-image"
              />
            ) : (
              <div className="wallet-info__icon-placeholder">
                {renderProps.wallet.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {renderName ? (
          renderName(renderProps.wallet.name)
        ) : (
          <div className="wallet-info__name">
            {renderProps.wallet.name || 'Unknown Wallet'}
          </div>
        )}
      </div>

      {/* Account Information */}
      {targetAccount && (
        <div className="wallet-info__account">
          {renderAddress ? (
            renderAddress(targetAccount.address)
          ) : (
            <div className="wallet-info__address">
              <span className="wallet-info__label">Address:</span>
              <span className="wallet-info__value">{targetAccount.address}</span>
            </div>
          )}

          {showBalance && renderBalance ? (
            renderBalance(targetAccount.balance)
          ) : showBalance && targetAccount.balance !== undefined ? (
            <div className="wallet-info__balance">
              <span className="wallet-info__label">Balance:</span>
              <span className="wallet-info__value">{targetAccount.balance} KDA</span>
            </div>
          ) : null}

          {showConnectionTime && targetAccount.connectedAt && (
            <div className="wallet-info__connected-at">
              <span className="wallet-info__label">Connected:</span>
              <span className="wallet-info__value">
                {targetAccount.connectedAt.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Network Information */}
      {showNetwork && network && (
        <div className="wallet-info__network">
          {renderNetwork ? (
            renderNetwork(network.name)
          ) : (
            <>
              <div className="wallet-info__network-name">
                <span className="wallet-info__label">Network:</span>
                <span className="wallet-info__value">{network.name}</span>
              </div>
              <div className="wallet-info__network-id">
                <span className="wallet-info__label">Network ID:</span>
                <span className="wallet-info__value">{network.networkId}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}