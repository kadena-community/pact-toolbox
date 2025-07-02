import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletStateManager } from './wallet-state-manager';
import { AccountService } from './account-service';
import { SettingsService } from './settings-service';
import { TransactionService } from './transaction-service';
import { DevWalletStorage } from '../storage';
import { WalletError } from '../types/error-types';
import { 
  setupBrowserMocks, 
  resetMocks, 
  createMockTransaction
} from '../test-utils/setup';

// Mock crypto module
vi.mock('@pact-toolbox/crypto', () => ({
  generateKeyPair: vi.fn().mockResolvedValue({
    publicKey: { type: 'public' },
    privateKey: { type: 'private' },
  }),
  exportBase16Key: vi.fn().mockResolvedValue('1'.repeat(64)),
  createKeyPairFromPrivateKeyBytes: vi.fn().mockResolvedValue({
    publicKey: { type: 'public' },
    privateKey: { type: 'private' },
  }),
}));

describe('WalletStateManager', () => {
  let stateManager: WalletStateManager;
  let accountService: AccountService;
  let settingsService: SettingsService;
  let transactionService: TransactionService;
  let storage: DevWalletStorage;

  beforeEach(() => {
    setupBrowserMocks();
    storage = new DevWalletStorage();
    accountService = new AccountService(storage);
    settingsService = new SettingsService(storage);
    transactionService = new TransactionService(storage);
    stateManager = new WalletStateManager(accountService, settingsService, transactionService);
  });

  afterEach(() => {
    resetMocks();
  });

  describe('initialize', () => {
    it('should initialize all services and load state', async () => {
      const state = await stateManager.initialize();

      expect(state).toBeDefined();
      expect(state.accounts).toBeDefined();
      expect(state.settings).toBeDefined();
      expect(state.transactions).toBeDefined();
      expect(state.isLocked).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock account service to throw error
      vi.spyOn(accountService, 'loadAccounts').mockRejectedValueOnce(new Error('Storage error'));

      const state = await stateManager.initialize();
      
      // Should still initialize with empty state
      expect(state.accounts).toEqual([]);
      expect(state.isLocked).toBe(false);
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should add new account', async () => {
      const mockAccount = {
        address: 'k:123456',
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
        name: 'Test Account',
        chainId: '0' as const,
        balance: 0
      };
      
      // Mock account generation
      vi.spyOn(accountService, 'generateAccount').mockResolvedValueOnce(mockAccount);
      
      await stateManager.addAccount(mockAccount);

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0]).toEqual(mockAccount);
    });

    it('should set selected account', async () => {
      const mockAccount = {
        address: 'k:123456',
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
        name: 'Test Account',
        chainId: '0' as const,
        balance: 0
      };
      
      await stateManager.addAccount(mockAccount);
      await stateManager.setSelectedAccount(mockAccount);

      const state = stateManager.getState();
      expect(state.selectedAccount).toEqual(mockAccount);
    });

    it('should remove account', async () => {
      const mockAccount = {
        address: 'k:123456',
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
        name: 'Test Account',
        chainId: '0' as const,
        balance: 0
      };
      
      await stateManager.addAccount(mockAccount);
      await stateManager.removeAccount(mockAccount.address);

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(0);
    });

    it('should set active network', async () => {
      const mockNetwork = {
        id: 'testnet',
        name: 'Test Network',
        chainId: '0' as const,
        rpcUrl: 'http://localhost:8080',
        isActive: false
      };

      await stateManager.setActiveNetwork(mockNetwork);

      const state = stateManager.getState();
      expect(state.activeNetwork).toEqual(mockNetwork);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should add transaction', async () => {
      const transactionData = {
        from: 'k:test-sender',
        to: 'k:test-receiver',
        amount: 10.5,
        gas: 1000,
        status: 'pending' as const,
        chainId: '0' as const,
        capability: 'coin.TRANSFER'
      };

      await stateManager.addTransaction(transactionData);

      const state = stateManager.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].from).toBe('k:test-sender');
      expect(state.transactions[0].amount).toBe(10.5);
    });

    it('should update transaction status', async () => {
      // First add a transaction
      const transactionData = {
        from: 'k:test-sender',
        to: 'k:test-receiver',
        amount: 10.5,
        gas: 1000,
        status: 'pending' as const,
        chainId: '0' as const
      };
      
      await stateManager.addTransaction(transactionData);
      const state = stateManager.getState();
      const transactionId = state.transactions[0].id;
      
      // Update the status
      await stateManager.updateTransactionStatus(transactionId, 'success');
      
      const updatedState = stateManager.getState();
      const updatedTransaction = updatedState.transactions.find(tx => tx.id === transactionId);
      
      expect(updatedTransaction?.status).toBe('success');
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should handle settings updates', async () => {
      const newSettings = {
        autoLock: false,
        showTestNetworks: true
      };
      
      await stateManager.updateState({ settings: newSettings });

      const state = stateManager.getState();
      expect(state.settings?.autoLock).toBe(false);
      expect(state.settings?.showTestNetworks).toBe(true);
    });

    it('should lock and unlock wallet', async () => {
      await stateManager.lockWallet();
      let state = stateManager.getState();
      expect(state.isLocked).toBe(true);
      
      await stateManager.unlockWallet();
      state = stateManager.getState();
      expect(state.isLocked).toBe(false);
    });
  });

  describe('Lock/Unlock', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should lock wallet', async () => {
      await stateManager.lock();

      const state = stateManager.getState();
      expect(state.isLocked).toBe(true);
    });

    it('should unlock wallet', async () => {
      await stateManager.lock();
      await stateManager.unlock();

      const state = stateManager.getState();
      expect(state.isLocked).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should add errors to state', async () => {
      const error = WalletError.create(
        'TEST_ERROR',
        'Test error message',
        'high'
      );

      stateManager.addError(error);

      const state = stateManager.getState();
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].code).toBe('TEST_ERROR');
    });

    it('should clear errors', () => {
      const error = WalletError.create(
        'TEST_ERROR',
        'Test error message',
        'high'
      );

      stateManager.addError(error);
      stateManager.clearErrors();

      const state = stateManager.getState();
      expect(state.errors).toHaveLength(0);
    });
  });

  describe('State Export/Clear', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should export complete state', async () => {
      await stateManager.generateAccount('Test Account');
      await stateManager.updateSettings({ theme: 'light' });

      const exported = await stateManager.exportState();

      expect(exported.accounts).toHaveLength(1);
      expect(exported.settings.theme).toBe('light');
      expect(exported.version).toBeDefined();
    });

    it('should clear all data', async () => {
      await stateManager.generateAccount('Test Account');
      await stateManager.clearAllData();

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(0);
      expect(state.transactions).toHaveLength(0);
      expect(state.settings).toEqual(expect.objectContaining({
        theme: 'dark'
      }));
    });
  });

  describe('Event Subscriptions', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should notify subscribers on state changes', async () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      await stateManager.generateAccount('Test Account');

      expect(listener).toHaveBeenCalled();
      const [newState] = listener.mock.calls[0];
      expect(newState.accounts).toHaveLength(1);

      unsubscribe();
    });

    it('should not notify after unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      unsubscribe();
      await stateManager.generateAccount('Test Account');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});