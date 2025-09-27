import type { Component } from 'solid-js';
import type { DevWalletSettings, PendingTransaction } from '../types';
import { onCleanup, onMount, Show } from 'solid-js';
import { css } from 'goober';
import { useToast } from '@pact-toolbox/ui-shared';
import { walletState, walletActions, walletEventEmitter, initializeWalletStore, getWalletStorage } from '../stores/wallet-store';
import { getDefaultDevWalletManager } from '../manager';
import { WalletHeader } from './wallet-header';
import { BottomNavigation } from './bottom-navigation';
import { AccountsScreen } from '../screens/accounts-screen';
import { TransactionsScreen } from '../screens/transactions-screen';
import { NetworksScreen } from '../screens/networks-screen';
import { SettingsScreen } from '../screens/settings-screen';
import { ConnectScreen } from '../screens/connect-screen';
import { SignScreen } from '../screens/sign-screen';

const containerStyles = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--pact-color-bg-primary);
  color: var(--pact-color-text-primary);
  font-family: var(--pact-font-family);
  overflow: hidden;
  position: relative;
  border-radius: var(--pact-border-radius-xl);
`;

const walletContainerStyles = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--pact-color-bg-primary);
  isolation: isolate;
  overflow: hidden;
`;

const walletContentStyles = css`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--pact-color-bg-primary);
  position: relative;
  min-height: 0; /* Important for Firefox */

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--pact-color-bg-secondary);
    border-radius: var(--pact-border-radius-full);
    margin: var(--pact-spacing-2) 0;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--pact-color-border-secondary);
    border-radius: var(--pact-border-radius-full);
    border: 2px solid var(--pact-color-bg-secondary);

    &:hover {
      background: var(--pact-color-border-primary);
    }
  }

  /* Firefox scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--pact-color-border-secondary) var(--pact-color-bg-secondary);
`;


export const WalletContainer: Component = () => {
  let autoLockTimer: NodeJS.Timeout | null = null;
  const toast = useToast();

  // Event handlers using the new SolidJS approach

  const AUTO_LOCK_DURATION = 5 * 60 * 1000; // 5 minutes
  const startAutoLockTimer = () => {
    stopAutoLockTimer();
    autoLockTimer = setTimeout(() => {
      walletActions.lock();
    }, AUTO_LOCK_DURATION);
  };

  const stopAutoLockTimer = () => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }
  };

  // Initialize and setup event listeners
  onMount(async () => {
    await initializeWalletStore();

    // Setup event listeners for auto-lock
    const settingsHandler = (settings: DevWalletSettings) => {
      if (settings.autoLock) {
        startAutoLockTimer();
      } else {
        stopAutoLockTimer();
      }
    };

    const activityHandler = () => {
      walletActions.updateActivity();
      if (walletState.settings.autoLock) {
        startAutoLockTimer();
      }
    };

    const exportHandler = async () => {
      try {
        const storage = getWalletStorage();
        const accounts = await storage.getKeys();
        const transactions = await storage.getTransactions();

        if (accounts.length === 0) {
          toast.showToast({
            variant: "warning",
            title: "No accounts",
            message: "No accounts to export",
            duration: 3000
          });
          return;
        }

        const exportData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          accounts: accounts.map(account => ({
            address: account.address,
            publicKey: account.publicKey,
            privateKey: account.privateKey,
            name: account.name,
            createdAt: account.createdAt,
          })),
          transactions: transactions.slice(0, 100),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pact-toolbox-wallet-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Failed to export wallet data:", error);
        toast.showToast({
          variant: "error",
          title: "Export failed",
          message: "Failed to export wallet data. Please try again.",
          duration: 5000
        });
      }
    };

    const closeHandler = () => {
      getDefaultDevWalletManager().hideDevWallet();
    };

    const connectRequestHandler = () => {
      // When a connection is requested, switch to connect screen
      walletActions.setCurrentScreen('connect');
    };

    const signRequestHandler = (transaction: PendingTransaction) => {
      // When a signing is requested, switch to sign screen and set pending transaction
      if (transaction) {
        walletActions.setPendingTransaction(transaction);
      }
      walletActions.setCurrentScreen('sign');
    };

    // Add wallet event listeners for requests
    walletEventEmitter.on('connect-requested', connectRequestHandler);
    walletEventEmitter.on('sign-requested', signRequestHandler);

    // Add event listeners
    walletEventEmitter.on('settings-changed', settingsHandler);
    walletEventEmitter.on('account-selected', activityHandler);
    walletEventEmitter.on('wallet-export-requested', exportHandler);
    walletEventEmitter.on('close-wallet', closeHandler);

    // Start auto-lock if enabled
    if (walletState.settings.autoLock) {
      startAutoLockTimer();
    }

    // Cleanup event listeners and auto-lock timer
    onCleanup(() => {
      stopAutoLockTimer();
      // Remove wallet event listeners
      walletEventEmitter.off('connect-requested', connectRequestHandler);
      walletEventEmitter.off('sign-requested', signRequestHandler);
      walletEventEmitter.off('settings-changed', settingsHandler);
      walletEventEmitter.off('account-selected', activityHandler);
      walletEventEmitter.off('wallet-export-requested', exportHandler);
      walletEventEmitter.off('close-wallet', closeHandler);
    });
  });

  return (
    <div class={containerStyles}>
      <div class={walletContainerStyles}>
        <Show when={walletState.currentScreen !== 'connect' && walletState.currentScreen !== 'sign'}>
          <WalletHeader
            selectedAccount={walletState.selectedAccount}
            activeNetwork={walletState.activeNetwork}
          />
        </Show>

        <div class={walletContentStyles}>
          <Show when={walletState.currentScreen === 'accounts'}>
            <AccountsScreen
              accounts={walletState.accounts}
              selectedAccount={walletState.selectedAccount}
            />
          </Show>

          <Show when={walletState.currentScreen === 'transactions'}>
            <TransactionsScreen
              transactions={walletState.transactions}
              selectedAccount={walletState.selectedAccount}
            />
          </Show>

          <Show when={walletState.currentScreen === 'networks'}>
            <NetworksScreen
              networks={walletState.networks}
              activeNetwork={walletState.activeNetwork}
            />
          </Show>

          <Show when={walletState.currentScreen === 'settings'}>
            <SettingsScreen />
          </Show>

          <Show when={walletState.currentScreen === 'connect'}>
            <ConnectScreen
              accounts={walletState.accounts}
              selectedAccount={walletState.selectedAccount}
            />
          </Show>

          <Show when={walletState.currentScreen === 'sign'}>
            <SignScreen
              transaction={walletState.pendingTransaction}
              selectedAccount={walletState.selectedAccount}
              network={walletState.activeNetwork}
            />
          </Show>
        </div>

        <Show when={walletState.currentScreen !== 'connect' && walletState.currentScreen !== 'sign'}>
          <BottomNavigation
            currentScreen={walletState.currentScreen}
          />
        </Show>
      </div>
    </div>
  );
};