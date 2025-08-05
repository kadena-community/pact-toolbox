import type { Account, Network, PendingTransaction } from "../types";
import type { WalletStateManager } from "../services/wallet-state-manager";
import type { ErrorHandler } from "../utils/error-handler";
import type { SettingsService } from "../services/settings-service";
import { uiLogger } from "../utils/logger";

/**
 * Centralized event coordination for wallet events
 */
export class WalletEventCoordinator {
  private stateManager: WalletStateManager;
  private errorHandler?: ErrorHandler;
  private settingsService?: SettingsService;
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(
    stateManager: WalletStateManager,
    errorHandler?: ErrorHandler,
    settingsService?: SettingsService
  ) {
    this.stateManager = stateManager;
    this.errorHandler = errorHandler;
    this.settingsService = settingsService;
  }

  /**
   * Setup all event listeners
   */
  setup(): void {
    uiLogger.operation('Event coordination setup', 'start');
    
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

    uiLogger.operation('Event coordination setup', 'success');
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    uiLogger.operation('Event coordination cleanup', 'start');
    
    for (const [eventType, listener] of this.eventListeners) {
      document.removeEventListener(eventType, listener);
    }
    
    this.eventListeners.clear();
    uiLogger.operation('Event coordination cleanup', 'success');
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
      const customEvent = event as CustomEvent<{ screen: string }>;
      const screen = customEvent.detail.screen as import('../types').WalletScreen;
      
      uiLogger.debug('Navigation requested', { screen });
      await this.stateManager.setCurrentScreen(screen);
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleNavigation',
        });
      } else {
        console.error('Error in handleNavigation:', error);
      }
    }
  }

  /**
   * Handle account selection events
   */
  private async handleAccountSelected(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      const account = customEvent.detail.account;
      
      uiLogger.debug('Account selected', { address: account.address });
      await this.stateManager.setSelectedAccount(account);
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleAccountSelected',
        });
      } else {
        console.error('Error in handleAccountSelected:', error);
      }
    }
  }

  /**
   * Handle network change events
   */
  private async handleNetworkChanged(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ network: Network }>;
      const network = customEvent.detail.network;
      
      uiLogger.debug('Network changed', { networkId: network.id });
      await this.stateManager.setActiveNetwork(network);
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleNetworkChanged',
        });
      } else {
        console.error('Error in handleNetworkChanged:', error);
      }
    }
  }

  /**
   * Handle sign request events
   */
  private async handleSignRequested(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ transaction: PendingTransaction }>;
      const transaction = customEvent.detail.transaction;
      
      uiLogger.debug('Sign requested', { transaction });
      
      const state = this.stateManager.getState();
      
      // Store the pending transaction
      await this.stateManager.updateState({ 
        pendingTransaction: transaction 
      });

      // Navigate based on connection state
      if (!state.selectedAccount || state.isConnecting) {
        uiLogger.debug('Not connected, showing connect screen first');
        await this.stateManager.updateState({
          currentScreen: "connect",
          isConnecting: true,
        });
      } else {
        uiLogger.debug('Already connected, showing sign screen');
        await this.stateManager.setCurrentScreen("sign");
      }
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleSignRequested',
        });
      } else {
        console.error('Error in handleSignRequested:', error);
      }
    }
  }

  /**
   * Handle connect request events
   */
  private async handleConnectRequested(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Connect requested');
      await this.stateManager.updateState({
        currentScreen: "connect",
        isConnecting: true,
      });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleConnectRequested',
        });
      } else {
        console.error('Error in handleConnectRequested:', error);
      }
    }
  }

  /**
   * Handle connect approval events
   */
  private async handleConnectApproved(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      uiLogger.debug('Connect approved', { address: customEvent.detail.account?.address });
      
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
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleConnectApproved',
        });
      } else {
        console.error('Error in handleConnectApproved:', error);
      }
    }
  }

  /**
   * Handle connect cancellation events
   */
  private async handleConnectCancelled(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Connect cancelled');
      await this.stateManager.updateState({
        currentScreen: "transactions",
        isConnecting: false,
        pendingTransaction: undefined,
      });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleConnectCancelled',
        });
      } else {
        console.error('Error in handleConnectCancelled:', error);
      }
    }
  }

  /**
   * Handle wallet close events
   */
  private async handleCloseWallet(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Wallet close requested');
      
      // Import and use modal manager to hide the wallet
      const { getDefaultModalManager } = await import("../ui/modal-manager");
      getDefaultModalManager().hideDevWallet();
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleCloseWallet',
        });
      } else {
        console.error('Error in handleCloseWallet:', error);
      }
    }
  }

  /**
   * Handle sign approval events
   */
  private async handleSignApproved(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Sign approved - clearing pending transaction');
      await this.stateManager.updateState({
        pendingTransaction: undefined,
        currentScreen: "transactions",
      });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleSignApproved',
        });
      } else {
        console.error('Error in handleSignApproved:', error);
      }
    }
  }

  /**
   * Handle sign rejection events
   */
  private async handleSignRejected(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Sign rejected - clearing pending transaction');
      await this.stateManager.updateState({
        pendingTransaction: undefined,
        currentScreen: "transactions",
      });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleSignRejected',
        });
      } else {
        console.error('Error in handleSignRejected:', error);
      }
    }
  }

  /**
   * Handle transaction added events
   */
  private async handleTransactionAdded(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent;
      uiLogger.debug('Transaction added event received', { detail: customEvent.detail });
      
      // The transaction service handles the actual addition,
      // we just need to trigger a state refresh if needed
      // This could be enhanced to update the UI immediately
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleTransactionAdded',
        });
      } else {
        console.error('Error in handleTransactionAdded:', error);
      }
    }
  }

  /**
   * Handle transaction updated events
   */
  private async handleTransactionUpdated(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent;
      uiLogger.debug('Transaction updated event received', { detail: customEvent.detail });
      
      // Update transaction status in state
      const { transactionId, status, result } = customEvent.detail;
      await this.stateManager.updateTransactionStatus(transactionId, status, result);
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleTransactionUpdated',
        });
      } else {
        console.error('Error in handleTransactionUpdated:', error);
      }
    }
  }

  /**
   * Handle account created events
   */
  private async handleAccountCreated(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ account: Account }>;
      const account = customEvent.detail.account;
      
      uiLogger.debug('Account created event received', { address: account.address });
      await this.stateManager.addAccount(account);
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleAccountCreated',
        });
      } else {
        console.error('Error in handleAccountCreated:', error);
      }
    }
  }

  /**
   * Handle wallet data cleared events
   */
  private async handleWalletDataCleared(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Wallet data cleared event received');
      await this.stateManager.clearAllData();
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleWalletDataCleared',
        });
      } else {
        console.error('Error in handleWalletDataCleared:', error);
      }
    }
  }

  /**
   * Handle wallet export requested events
   */
  private async handleWalletExportRequested(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Wallet export requested');
      
      // Use the injected settings service or create one if not available
      let settingsService = this.settingsService;
      if (!settingsService) {
        const { SettingsService } = await import("../services/settings-service");
        settingsService = new SettingsService();
      }
      
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
      
      uiLogger.operation('Wallet export', 'success');
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleWalletExportRequested',
        });
      } else {
        console.error('Error in handleWalletExportRequested:', error);
      }
    }
  }

  /**
   * Handle settings changed events
   */
  private async handleSettingsChanged(event: Event): Promise<void> {
    try {
      const customEvent = event as CustomEvent<{ settings: import('../types').DevWalletSettings }>;
      const settings = customEvent.detail.settings;
      
      uiLogger.debug('Settings changed event received', { settings });
      await this.stateManager.updateState({ settings });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleSettingsChanged',
        });
      } else {
        console.error('Error in handleSettingsChanged:', error);
      }
    }
  }

  /**
   * Handle connection state reset events
   */
  private async handleResetConnectionState(_event: Event): Promise<void> {
    try {
      uiLogger.debug('Reset connection state requested');
      await this.stateManager.updateState({
        isConnecting: false,
        pendingTransaction: undefined,
        currentScreen: "accounts",
      });
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'WalletEventCoordinator',
          operation: 'handleResetConnectionState',
        });
      } else {
        console.error('Error in handleResetConnectionState:', error);
      }
    }
  }
}