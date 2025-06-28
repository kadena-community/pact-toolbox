import type { Account, Transaction, Network } from '../types';
import type { WalletState, WalletEvents } from '../types/enhanced-types';
import { WalletError } from '../types/error-types';
import { handleErrors } from '../utils/error-handler';
import { AccountService } from './account-service';
import { SettingsService } from './settings-service';
import { TransactionService } from './transaction-service';

/**
 * Centralized wallet state management service
 */
export class WalletStateManager {
  private state: WalletState;
  private listeners: Map<string, ((state: WalletState) => void)[]> = new Map();
  private accountService: AccountService;
  private settingsService: SettingsService;
  private transactionService: TransactionService;

  constructor(
    accountService?: AccountService,
    settingsService?: SettingsService,
    transactionService?: TransactionService
  ) {
    this.accountService = accountService || new AccountService();
    this.settingsService = settingsService || new SettingsService();
    this.transactionService = transactionService || new TransactionService();

    // Initialize with default state
    this.state = {
      currentScreen: 'transactions',
      accounts: [],
      transactions: [],
      networks: [],
      isLocked: false,
      lastActivity: Date.now(),
    };
  }

  /**
   * Initialize wallet state from storage
   */
  @handleErrors({ component: 'WalletStateManager' })
  async initialize(): Promise<WalletState> {
    try {
      console.log('Initializing wallet state...');

      // Load data from services
      const [accounts, settings, transactions, networks] = await Promise.all([
        this.accountService.loadAccounts(),
        this.settingsService.loadSettings(),
        this.transactionService.getTransactionHistory({ limit: 100 }),
        this.loadNetworks(),
      ]);

      // Convert DevWalletTransactions to Transactions
      const convertedTransactions: Transaction[] = transactions.map(tx => ({
        id: tx.id,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        gas: tx.gas,
        status: tx.status as any,
        timestamp: tx.timestamp,
        chainId: tx.chainId,
        capability: tx.capability,
        data: tx.data,
        result: tx.result,
        updatedAt: tx.updatedAt,
      }));

      // Update state
      this.state = {
        ...this.state,
        accounts,
        settings,
        transactions: convertedTransactions,
        networks,
        selectedAccount: accounts[0],
        activeNetwork: networks.find(n => n.isActive) || networks[0],
      };

      console.log('Wallet state initialized successfully');
      this.notifyListeners();
      
      return this.state;
    } catch (error) {
      console.error('Failed to initialize wallet state:', error);
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to initialize wallet state',
        {
          severity: 'critical',
          cause: error as Error,
          context: { operation: 'initialize' },
        }
      );
    }
  }

  /**
   * Get current wallet state
   */
  getState(): Readonly<WalletState> {
    return { ...this.state };
  }

  /**
   * Update wallet state
   */
  @handleErrors({ component: 'WalletStateManager' })
  async updateState(updates: Partial<WalletState>): Promise<WalletState> {
    const previousState = { ...this.state };
    try {
      this.state = { ...this.state, ...updates, lastActivity: Date.now() };

      // Persist certain state changes
      await this.persistStateChanges(updates, previousState);

      this.notifyListeners();
      return this.state;
    } catch (error) {
      console.error('Failed to update state:', error);
      // Revert state on error
      this.state = previousState;
      throw error;
    }
  }

  /**
   * Set current screen
   */
  async setCurrentScreen(screen: WalletState['currentScreen']): Promise<void> {
    await this.updateState({ currentScreen: screen });
  }

  /**
   * Set selected account
   */
  async setSelectedAccount(account: Account): Promise<void> {
    await this.updateState({ selectedAccount: account });
    this.dispatchEvent('account-selected', { account });
  }

  /**
   * Add a new account
   */
  @handleErrors({ component: 'WalletStateManager' })
  async addAccount(account: Account): Promise<void> {
    try {
      // Save account via service
      await this.accountService.saveAccount(account);

      // Update state
      const accounts = [...this.state.accounts, account];
      const selectedAccount = this.state.accounts.length === 0 ? account : this.state.selectedAccount;

      await this.updateState({ 
        accounts,
        selectedAccount 
      });

      this.dispatchEvent('account-created', { account });
      console.log('Account added to state:', account.address);
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to add account to wallet state',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'addAccount', address: account.address },
        }
      );
    }
  }

  /**
   * Remove an account
   */
  @handleErrors({ component: 'WalletStateManager' })
  async removeAccount(address: string): Promise<void> {
    try {
      // Remove from storage
      await this.accountService.removeAccount(address);

      // Update state
      const accounts = this.state.accounts.filter(acc => acc.address !== address);
      const selectedAccount = this.state.selectedAccount?.address === address 
        ? accounts[0] 
        : this.state.selectedAccount;

      await this.updateState({ accounts, selectedAccount });
      console.log('Account removed from state:', address);
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to remove account from wallet state',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'removeAccount', address },
        }
      );
    }
  }

  /**
   * Set active network
   */
  async setActiveNetwork(network: Network): Promise<void> {
    // Update network active status
    const networks = this.state.networks.map(n => ({
      ...n,
      isActive: n.id === network.id,
    }));

    await this.updateState({ 
      networks,
      activeNetwork: network 
    });

    this.dispatchEvent('network-changed', { network });
  }

  /**
   * Add a transaction
   */
  @handleErrors({ component: 'WalletStateManager' })
  async addTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Add via transaction service
      const newTransaction = await this.transactionService.addTransaction({
        ...transaction,
        status: transaction.status as any,
      });

      // Update state
      const transactions = [newTransaction, ...this.state.transactions].slice(0, 100); // Keep last 100
      await this.updateState({ transactions: transactions as Transaction[] });

      console.log('Transaction added to state:', newTransaction.id);
    } catch (error) {
      throw WalletError.create(
        'TRANSACTION_FAILED',
        'Failed to add transaction to wallet state',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'addTransaction', from: transaction.from },
        }
      );
    }
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(id: string, status: Transaction['status'], result?: any): Promise<void> {
    const transactions = this.state.transactions.map(tx => 
      tx.id === id 
        ? { ...tx, status, result, updatedAt: Date.now() }
        : tx
    );

    await this.updateState({ transactions });
  }

  /**
   * Lock the wallet
   */
  async lockWallet(): Promise<void> {
    await this.updateState({ 
      isLocked: true,
      selectedAccount: undefined,
      currentScreen: 'accounts',
    });

    this.dispatchEvent('wallet-locked', { timestamp: Date.now() });
    console.log('Wallet locked');
  }

  /**
   * Unlock the wallet
   */
  async unlockWallet(): Promise<void> {
    await this.updateState({ 
      isLocked: false,
      lastActivity: Date.now(),
    });

    this.dispatchEvent('wallet-unlocked', { timestamp: Date.now() });
    console.log('Wallet unlocked');
  }

  /**
   * Clear all data and reset state
   */
  @handleErrors({ component: 'WalletStateManager' })
  async clearAllData(): Promise<void> {
    try {
      // Clear via settings service
      await this.settingsService.clearAllData();

      // Reset state
      this.state = {
        currentScreen: 'accounts',
        accounts: [],
        transactions: [],
        networks: this.state.networks, // Keep networks
        isLocked: false,
        lastActivity: Date.now(),
      };

      this.notifyListeners();
      console.log('All wallet data cleared');
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to clear wallet data',
        {
          severity: 'high',
          cause: error as Error,
          context: { operation: 'clearAllData' },
        }
      );
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: WalletState) => void): () => void {
    
    if (!this.listeners.has('stateChange')) {
      this.listeners.set('stateChange', []);
    }
    
    this.listeners.get('stateChange')!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get('stateChange');
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get wallet statistics
   */
  getStats(): {
    accountCount: number;
    transactionCount: number;
    pendingTransactions: number;
    isLocked: boolean;
    lastActivity: number;
  } {
    return {
      accountCount: this.state.accounts.length,
      transactionCount: this.state.transactions.length,
      pendingTransactions: this.state.transactions.filter(tx => tx.status === 'pending').length,
      isLocked: Boolean(this.state.isLocked),
      lastActivity: this.state.lastActivity || Date.now(),
    };
  }

  private async loadNetworks(): Promise<Network[]> {
    // Load from global context or use defaults
    const globalContext = (window as any).__PACT_TOOLBOX_CONTEXT__ || (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
    
    if (typeof globalContext?.getNetworkConfig === 'function') {
      const networkConfig = globalContext.getNetworkConfig();
      
      const networks: Network[] = [{
        id: networkConfig.networkId || 'development',
        name: networkConfig.networkId || 'Development',
        chainId: networkConfig.meta?.chainId || '0',
        rpcUrl: networkConfig.rpcUrl || 'http://localhost:8080',
        isActive: true,
      }];

      // Add additional networks if available
      if (typeof globalContext.getAllNetworkConfigs === 'function') {
        const allConfigs = globalContext.getAllNetworkConfigs();
        for (const config of allConfigs) {
          if (config.networkId && networks[0] && config.networkId !== networks[0].id) {
            networks.push({
              id: config.networkId,
              name: config.name || config.networkId,
              chainId: config.meta?.chainId || '0',
              rpcUrl: config.rpcUrl || 'http://localhost:8080',
              isActive: false,
            });
          }
        }
      }

      return networks;
    }

    // Default network
    return [{
      id: 'development',
      name: 'Development',
      chainId: '0',
      rpcUrl: 'http://localhost:8080',
      isActive: true,
    }];
  }

  private async persistStateChanges(updates: Partial<WalletState>, previousState: WalletState): Promise<void> {
    // Persist settings changes
    if (updates.settings && updates.settings !== previousState.settings) {
      await this.settingsService.updateSettings(updates.settings);
    }

    // Other state changes are handled by individual services
  }

  private notifyListeners(): void {
    const callbacks = this.listeners.get('stateChange') || [];
    for (const callback of callbacks) {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    }
  }

  private dispatchEvent<K extends keyof WalletEvents>(
    eventType: K,
    detail: WalletEvents[K]
  ): void {
    const event = new CustomEvent(eventType, {
      detail,
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }
}