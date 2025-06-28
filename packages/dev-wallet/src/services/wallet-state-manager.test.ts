import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletStateManager } from './wallet-state-manager';
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

describe.skip('WalletStateManager', () => {
  let stateManager: WalletStateManager;
  let storage: DevWalletStorage;

  beforeEach(() => {
    setupBrowserMocks();
    storage = new DevWalletStorage();
    stateManager = new WalletStateManager(storage);
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
      // Mock storage to throw error
      vi.spyOn(storage, 'getAccounts').mockRejectedValueOnce(new Error('Storage error'));

      const state = await stateManager.initialize();
      
      // Should still initialize with empty state
      expect(state.accounts).toEqual([]);
      expect(state.errors).toHaveLength(1);
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should add new account', async () => {
      const newAccount = await stateManager.generateAccount('Test Account');

      expect(newAccount).toBeDefined();
      expect(newAccount.name).toBe('Test Account');
      expect(newAccount.publicKey).toBe('mock-public-key');

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].id).toBe(newAccount.id);
    });

    it('should update existing account', async () => {
      const account = await stateManager.generateAccount('Original Name');
      
      const updated = await stateManager.updateAccount(account.id, {
        name: 'Updated Name'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(account.id);
    });

    it('should remove account', async () => {
      const account = await stateManager.generateAccount('To Remove');
      
      await stateManager.removeAccount(account.id);

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(0);
    });

    it('should set active account', async () => {
      const _account1 = await stateManager.generateAccount('Account 1');
      const account2 = await stateManager.generateAccount('Account 2');

      await stateManager.setActiveAccount(account2.id);

      const state = stateManager.getState();
      expect(state.activeAccountId).toBe(account2.id);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should add transaction', async () => {
      const transaction = createMockTransaction({
        cmd: JSON.stringify({
          payload: { exec: { code: 'test-code', data: {} } },
          signers: [{ pubKey: 'mock-public-key' }],
          meta: { chainId: '0', sender: 'test-sender' },
          networkId: 'testnet04',
          nonce: 'test-nonce',
        })
      });

      const added = await stateManager.addTransaction(transaction);

      expect(added).toBeDefined();
      const state = stateManager.getState();
      expect(state.transactions).toHaveLength(1);
    });

    it('should update transaction status', async () => {
      const transaction = createMockTransaction({
        cmd: JSON.stringify({
          payload: { exec: { code: 'test-code', data: {} } },
          signers: [{ pubKey: 'mock-public-key' }],
          meta: { chainId: '0', sender: 'test-sender' },
          networkId: 'testnet04',
          nonce: 'test-nonce',
        })
      });
      
      await stateManager.addTransaction(transaction);
      
      const updated = await stateManager.updateTransactionStatus(
        transaction.id,
        'success',
        'Transaction completed'
      );

      expect(updated.status).toBe('success');
      expect(updated.result).toBe('Transaction completed');
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should update settings', async () => {
      const newSettings = await stateManager.updateSettings({
        theme: 'light',
        autoLockEnabled: false
      });

      expect(newSettings.theme).toBe('light');
      expect(newSettings.autoLockEnabled).toBe(false);

      const state = stateManager.getState();
      expect(state.settings.theme).toBe('light');
    });

    it('should persist settings updates', async () => {
      await stateManager.updateSettings({ theme: 'light' });

      // Create new instance to verify persistence
      const newStateManager = new WalletStateManager(storage);
      await newStateManager.initialize();

      const state = newStateManager.getState();
      expect(state.settings.theme).toBe('light');
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