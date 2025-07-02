import React, { useEffect, useState } from "react";
import type { WalletMetadata } from "@pact-toolbox/wallet-core";
import { createWalletSelector, type WalletSelectorRenderProps } from "../headless/wallet-selector";

export interface WalletSelectorProps {
  wallets: WalletMetadata[];
  loading?: boolean;
  error?: Error | null;
  onSelect?: (walletId: string) => void;
  onAutoConnect?: () => void;
  children: (props: WalletSelectorRenderProps) => React.ReactNode;
}

/**
 * React wallet selector component with render props
 */
export function WalletSelector({
  wallets,
  loading = false,
  error = null,
  onSelect,
  onAutoConnect,
  children,
}: WalletSelectorProps) {
  const [selector] = useState(() => createWalletSelector(onSelect, onAutoConnect));

  // Update state when props change
  useEffect(() => {
    selector.actions.setWallets(wallets);
  }, [wallets, selector]);

  useEffect(() => {
    selector.actions.setLoading(loading);
  }, [loading, selector]);

  useEffect(() => {
    selector.actions.setError(error);
  }, [error, selector]);

  // Force re-render when state changes
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 100);
    return () => clearInterval(interval);
  }, []);

  return <>{children(selector.getRenderProps())}</>;
}

/**
 * Example usage component
 */
export function WalletSelectorExample() {
  return (
    <WalletSelector
      wallets={[]}
      onSelect={(walletId) => console.log("Selected:", walletId)}
      onAutoConnect={() => console.log("Auto-connect")}
    >
      {({ filteredWallets, filter, setFilter, selectWallet, hasWallets, canAutoConnect }) => (
        <div>
          {hasWallets ? (
            <>
              <input
                type="text"
                placeholder="Search wallets..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              
              {canAutoConnect && (
                <button onClick={() => selectWallet("auto")}>
                  Auto Connect
                </button>
              )}
              
              <div>
                {filteredWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => selectWallet(wallet.id)}
                  >
                    {wallet.icon && <img src={wallet.icon} alt="" />}
                    <span>{wallet.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>No wallets available</p>
          )}
        </div>
      )}
    </WalletSelector>
  );
}