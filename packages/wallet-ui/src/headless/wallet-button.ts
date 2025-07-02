import type { Wallet, WalletAccount } from "@pact-toolbox/wallet-core";
import { truncateAddress } from "@pact-toolbox/ui-shared";

/**
 * Wallet button state
 */
export interface WalletButtonState {
  wallet: Wallet | null;
  account: WalletAccount | null;
  isConnecting: boolean;
  isDisconnecting: boolean;
  error: Error | null;
}

/**
 * Wallet button actions
 */
export interface WalletButtonActions {
  onConnect: () => void;
  onDisconnect: () => void;
  onAddressClick?: () => void;
  clearError: () => void;
}

/**
 * Wallet button render props
 */
export interface WalletButtonRenderProps extends WalletButtonState, WalletButtonActions {
  // Computed properties
  isConnected: boolean;
  displayAddress: string;
  displayBalance: string | null;
  buttonText: string;
  isLoading: boolean;
}

/**
 * Create headless wallet button
 */
export function createWalletButton(
  state: WalletButtonState,
  actions: WalletButtonActions
): WalletButtonRenderProps {
  const isConnected = !!state.wallet && !!state.account;
  const isLoading = state.isConnecting || state.isDisconnecting;

  // Compute display values
  const displayAddress = state.account ? truncateAddress(state.account.address) : "";
  const displayBalance = state.account?.balance != null 
    ? `${state.account.balance.toFixed(2)} KDA`
    : null;

  // Compute button text
  let buttonText = "Connect Wallet";
  if (state.isConnecting) {
    buttonText = "Connecting...";
  } else if (state.isDisconnecting) {
    buttonText = "Disconnecting...";
  } else if (isConnected && state.account) {
    buttonText = displayAddress;
  }

  return {
    ...state,
    ...actions,
    isConnected,
    displayAddress,
    displayBalance,
    buttonText,
    isLoading,
  };
}