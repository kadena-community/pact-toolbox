import type { Account, Network } from "../types";
import { WalletStateManager } from "../services/wallet-state-manager";
import { errorHandler } from "../utils/error-handler";

/**
 * Centralized event coordination for wallet events
 */
export class WalletEventCoordinator {
  private stateManager: WalletStateManager;
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(stateManager: WalletStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Setup all event listeners
   */
  setup(): void {
    console.log('Setting up wallet event coordination...');
    
    // Setup event listeners
    this.addListener("toolbox-navigate", this.handleNavigation);
    this.addListener("toolbox-account-selected", this.handleAccountSelected);
    this.addListener("toolbox-network-changed", this.handleNetworkChanged);
    this.addListener("toolbox-sign-requested", this.handleSignRequested);
    this.addListener("toolbox-connect-requested", this.handleConnectRequested);
    this.addListener("connect-approved", this.handleConnectApproved);
    this.addListener("connect-cancelled", this.handleConnectCancelled);
    this.addListener("toolbox-close-wallet", this.handleCloseWallet);
    this.addListener("sign-approved", this.handleSignApproved);
    this.addListener("sign-rejected", this.handleSignRejected);
    this.addListener("toolbox-transaction-added", this.handleTransactionAdded);
    this.addListener("toolbox-transaction-updated", this.handleTransactionUpdated);
    this.addListener("account-created", this.handleAccountCreated);
    this.addListener("wallet-data-cleared", this.handleWalletDataCleared);
    this.addListener("wallet-export-requested", this.handleWalletExportRequested);
    this.addListener("settings-changed", this.handleSettingsChanged);
    this.addListener("reset-connection-state", this.handleResetConnectionState);

    console.log('Wallet event coordination setup complete');
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    console.log('Cleaning up wallet event coordination...');
    
    for (const [eventType, listener] of this.eventListeners) {
      document.removeEventListener(eventType, listener);
    }
    
    this.eventListeners.clear();
    console.log('Wallet event coordination cleanup complete');
  }

  /**
   * Add an event listener with automatic cleanup tracking
   */
  private addListener(eventType: string, handler: (event: Event) => void): void {
    const listener = handler.bind(this) as EventListener;
    document.addEventListener(eventType, listener);
    this.eventListeners.set(eventType, listener);
  }

  /**
   * Handle navigation events
   */
  private async handleNavigation(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ screen: any }>;
      const screen = customEvent.detail.screen;
      
      console.log('Navigation requested:', screen);
      await this.stateManager.setCurrentScreen(screen);
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleNavigation',
      });
    }
  }

  /**
   * Handle account selection events
   */
  private async handleAccountSelected(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      const account = customEvent.detail.account;
      
      console.log('Account selected:', account.address);
      await this.stateManager.setSelectedAccount(account);
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleAccountSelected',
      });
    }
  }

  /**
   * Handle network change events
   */
  private async handleNetworkChanged(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ network: Network }>;
      const network = customEvent.detail.network;
      
      console.log('Network changed:', network.id);
      await this.stateManager.setActiveNetwork(network);
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleNetworkChanged',
      });
    }
  }

  /**
   * Handle sign request events
   */
  private async handleSignRequested(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ transaction: any }>;
      const transaction = customEvent.detail.transaction;
      
      console.log('Sign requested for transaction:', transaction);
      
      const state = this.stateManager.getState();
      
      // Store the pending transaction
      await this.stateManager.updateState({ 
        pendingTransaction: transaction 
      });

      // Navigate based on connection state
      if (!state.selectedAccount || state.isConnecting) {
        console.log('Not connected, showing connect screen first');
        await this.stateManager.updateState({
          currentScreen: "connect",
          isConnecting: true,
        });
      } else {
        console.log('Already connected, showing sign screen');
        await this.stateManager.setCurrentScreen("sign");
      }
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleSignRequested',
      });
    }
  }

  /**
   * Handle connect request events
   */
  private async handleConnectRequested(_event: Event): Promise<void> {
    try {
      console.log('Connect requested');
      await this.stateManager.updateState({
        currentScreen: "connect",
        isConnecting: true,
      });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleConnectRequested',
      });
    }
  }

  /**
   * Handle connect approval events
   */
  private async handleConnectApproved(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      console.log('Connect approved for account:', customEvent.detail.account?.address);
      
      const state = this.stateManager.getState();
      
      if (state.pendingTransaction) {
        // Continue to sign screen
        await this.stateManager.updateState({
          currentScreen: "sign",
          isConnecting: false,
        });
      } else {
        // Just connected, show transactions screen
        await this.stateManager.updateState({
          currentScreen: "transactions",
          isConnecting: false,
        });
      }
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleConnectApproved',
      });
    }
  }

  /**
   * Handle connect cancellation events
   */
  private async handleConnectCancelled(_event: Event): Promise<void> {
    try {
      console.log('Connect cancelled');
      await this.stateManager.updateState({
        currentScreen: "transactions",
        isConnecting: false,
        pendingTransaction: undefined,
      });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleConnectCancelled',
      });
    }
  }

  /**
   * Handle wallet close events
   */
  private async handleCloseWallet(_event: Event): Promise<void> {
    try {
      console.log('Wallet close requested');
      
      // Import and use modal manager to hide the wallet
      const { ModalManager } = await import("../ui/modal-manager");
      ModalManager.getInstance().hideDevWallet();
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleCloseWallet',
      });
    }
  }

  /**
   * Handle sign approval events
   */
  private async handleSignApproved(_event: Event): Promise<void> {
    try {
      console.log('Sign approved - clearing pending transaction');
      await this.stateManager.updateState({
        pendingTransaction: undefined,
        currentScreen: "transactions",
      });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleSignApproved',
      });
    }
  }

  /**
   * Handle sign rejection events
   */
  private async handleSignRejected(_event: Event): Promise<void> {
    try {
      console.log('Sign rejected - clearing pending transaction');
      await this.stateManager.updateState({
        pendingTransaction: undefined,
        currentScreen: "transactions",
      });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleSignRejected',
      });
    }
  }

  /**
   * Handle transaction added events
   */
  private async handleTransactionAdded(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent;
      console.log('Transaction added event received:', customEvent.detail);
      
      // The transaction service handles the actual addition,
      // we just need to trigger a state refresh if needed
      // This could be enhanced to update the UI immediately
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleTransactionAdded',
      });
    }
  }

  /**
   * Handle transaction updated events
   */
  private async handleTransactionUpdated(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent;
      console.log('Transaction updated event received:', customEvent.detail);
      
      // Update transaction status in state
      const { transactionId, status, result } = customEvent.detail;
      await this.stateManager.updateTransactionStatus(transactionId, status, result);
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleTransactionUpdated',
      });
    }
  }

  /**
   * Handle account created events
   */
  private async handleAccountCreated(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      const account = customEvent.detail.account;
      
      console.log('Account created event received:', account.address);
      await this.stateManager.addAccount(account);
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleAccountCreated',
      });
    }
  }

  /**
   * Handle wallet data cleared events
   */
  private async handleWalletDataCleared(_event: Event): Promise<void> {
    try {
      console.log('Wallet data cleared event received');
      await this.stateManager.clearAllData();
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleWalletDataCleared',
      });
    }
  }

  /**
   * Handle wallet export requested events
   */
  private async handleWalletExportRequested(_event: Event): Promise<void> {
    try {
      console.log('Wallet export requested');
      
      // Use the settings service to handle export
      const { SettingsService } = await import("../services/settings-service");
      const settingsService = new SettingsService();
      
      const blob = await settingsService.exportWalletData();
      
      // Create download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pact-toolbox-wallet-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Wallet data exported successfully');
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleWalletExportRequested',
      });
    }
  }

  /**
   * Handle settings changed events
   */
  private async handleSettingsChanged(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ settings: any }>;
      const settings = customEvent.detail.settings;
      
      console.log('Settings changed event received:', settings);
      await this.stateManager.updateState({ settings });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleSettingsChanged',
      });
    }
  }

  /**
   * Handle connection state reset events
   */
  private async handleResetConnectionState(_event: Event): Promise<void> {
    try {
      console.log('Reset connection state requested');
      await this.stateManager.updateState({
        isConnecting: false,
        pendingTransaction: undefined,
        currentScreen: "accounts",
      });
    } catch (error) {
      await errorHandler.handle(error as Error, {
        component: 'WalletEventCoordinator',
        operation: 'handleResetConnectionState',
      });
    }
  }
}