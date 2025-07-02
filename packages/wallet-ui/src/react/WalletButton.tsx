import React from "react";
import type { Wallet, WalletAccount } from "@pact-toolbox/wallet-core";
import { createWalletButton, type WalletButtonRenderProps } from "../headless/wallet-button";

export interface WalletButtonProps {
  wallet: Wallet | null;
  account: WalletAccount | null;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  error?: Error | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onAddressClick?: () => void;
  children: (props: WalletButtonRenderProps) => React.ReactNode;
}

/**
 * React wallet button component with render props
 */
export function WalletButton({
  wallet,
  account,
  isConnecting = false,
  isDisconnecting = false,
  error = null,
  onConnect,
  onDisconnect,
  onAddressClick,
  children,
}: WalletButtonProps) {
  const state = {
    wallet,
    account,
    isConnecting,
    isDisconnecting,
    error,
  };

  const actions = {
    onConnect,
    onDisconnect,
    onAddressClick,
    clearError: () => {}, // Parent should handle this
  };

  const renderProps = createWalletButton(state, actions);

  return <>{children(renderProps)}</>;
}

/**
 * Example usage component
 */
export function WalletButtonExample() {
  return (
    <WalletButton
      wallet={null}
      account={null}
      onConnect={() => console.log("Connect")}
      onDisconnect={() => console.log("Disconnect")}
    >
      {({ isConnected, buttonText, displayBalance, onConnect, onDisconnect, isLoading }) => (
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isLoading}
        >
          {buttonText}
          {displayBalance && <span> ({displayBalance})</span>}
        </button>
      )}
    </WalletButton>
  );
}