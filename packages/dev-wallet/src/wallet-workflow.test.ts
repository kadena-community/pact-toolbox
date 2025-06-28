import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletStateManager } from './services/wallet-state-manager';
import { AccountService } from './services/account-service';
import { SettingsService } from './services/settings-service';
import { TransactionService } from './services/transaction-service';
import { WalletEventCoordinator } from './components/wallet-event-coordinator';
import { AutoLockManager } from './components/auto-lock-manager';
import { DevWalletStorage } from './storage';
import { 
  setupBrowserMocks, 
  resetMocks, 
  createMockAccount,
  createMockTransaction,
  createMockSettings,
  waitFor,
  setupTimers,
  teardownTimers,
  advanceTimers
} from './test-utils/setup';

// Mock the crypto module
vi.mock('@pact-toolbox/crypto', () => ({
  generateKeyPair: vi.fn(),
  exportBase16Key: vi.fn(),
  createKeyPairFromPrivateKeyBytes: vi.fn(),
}));

describe.skip('Wallet Integration Tests', () => {
  let stateManager: WalletStateManager;
  let accountService: AccountService;
  let settingsService: SettingsService;
  let transactionService: TransactionService;
  let eventCoordinator: WalletEventCoordinator;
  let autoLockManager: AutoLockManager;
  let mockStorage: DevWalletStorage;

  beforeEach(async () => {
    setupBrowserMocks();
    resetMocks();
    setupTimers();

    // Setup mock storage
    mockStorage = {
      getKeys: vi.fn().mockResolvedValue([]),
      saveKey: vi.fn().mockResolvedValue(undefined),
      removeKey: vi.fn().mockResolvedValue(undefined),
      getTransactions: vi.fn().mockResolvedValue([]),
      saveTransaction: vi.fn().mockResolvedValue(undefined),
      saveTransactions: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue(createMockSettings()),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      clearAllData: vi.fn().mockResolvedValue(undefined),
      getSelectedKey: vi.fn().mockResolvedValue(null),
      setSelectedKey: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Create services
    accountService = new AccountService(mockStorage);
    settingsService = new SettingsService(mockStorage);
    transactionService = new TransactionService(mockStorage);
    
    // Create state manager
    stateManager = new WalletStateManager(accountService, settingsService, transactionService);
    
    // Create coordinators
    eventCoordinator = new WalletEventCoordinator(stateManager);
    autoLockManager = new AutoLockManager(stateManager);

    // Mock crypto functions
    const { generateKeyPair, exportBase16Key, createKeyPairFromPrivateKeyBytes } = await import('@pact-toolbox/crypto');
    (generateKeyPair as any).mockResolvedValue({
      publicKey: { type: 'public', algorithm: { name: 'Ed25519' }, extractable: true },
      privateKey: { type: 'private', algorithm: { name: 'Ed25519' }, extractable: true },
    });
    (createKeyPairFromPrivateKeyBytes as any).mockResolvedValue({
      publicKey: { type: 'public', algorithm: { name: 'Ed25519' }, extractable: true },
      privateKey: { type: 'private', algorithm: { name: 'Ed25519' }, extractable: true },
    });
    (exportBase16Key as any).mockImplementation(() => Promise.resolve('1'.repeat(64)));
  });

  afterEach(() => {
    teardownTimers();
    vi.clearAllMocks();
    eventCoordinator.cleanup();
    autoLockManager.cleanup();
  });

  describe('Complete Wallet Workflow', () => {
    it('should complete full initialization → generate account → sign transaction → lock workflow', async () => {
      // Step 1: Initialize wallet
      eventCoordinator.setup();
      await autoLockManager.initialize();
      await stateManager.initialize();

      let state = stateManager.getState();
      expect(state.accounts).toHaveLength(0);
      expect(state.currentScreen).toBe('transactions');

      // Step 2: Generate new account
      const account = await accountService.generateAccount('Test Account');
      await stateManager.addAccount(account);

      state = stateManager.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.selectedAccount).toEqual(account);

      // Step 3: Add a transaction
      const transaction = createMockTransaction({ from: account.address });
      await stateManager.addTransaction(transaction);

      state = stateManager.getState();
      expect(state.transactions).toHaveLength(1);

      // Step 4: Simulate sign request
      const pendingTx = { ...transaction, status: 'pending' };
      await stateManager.updateState({ pendingTransaction: pendingTx });

      state = stateManager.getState();
      expect(state.pendingTransaction).toEqual(pendingTx);

      // Step 5: Enable auto-lock and trigger it
      await settingsService.updateSetting('autoLock', true);
      
      // Fast-forward time to trigger auto-lock
      advanceTimers(300001); // Just over 5 minutes
      await waitFor(100);

      state = stateManager.getState();
      expect(state.isLocked).toBe(true);
      expect(state.selectedAccount).toBeUndefined();
    });

    it('should handle account import workflow', async () => {
      await stateManager.initialize();

      // Import account with valid private key
      const privateKey = '2'.repeat(64);
      const account = await accountService.importAccount(privateKey, 'Imported Account');
      await stateManager.addAccount(account);

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].name).toBe('Imported Account');
      expect(state.accounts[0].privateKey).toBe(privateKey);
    });

    it('should handle settings persistence across state changes', async () => {
      await stateManager.initialize();

      // Update multiple settings
      const newSettings = { autoLock: true, showTestNetworks: false };
      await settingsService.updateSettings(newSettings);
      
      let state = stateManager.getState();
      expect(state.settings).toMatchObject(newSettings);

      // Simulate state reset (like page reload)
      const newStateManager = new WalletStateManager(accountService, settingsService, transactionService);
      await newStateManager.initialize();

      const newState = newStateManager.getState();
      expect(newState.settings).toEqual(newSettings);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from storage errors', async () => {
      // Simulate storage failure during initialization
      mockStorage.getKeys = vi.fn().mockRejectedValueOnce(new Error('Storage failed'))
                                 .mockResolvedValue([]);
      mockStorage.getTransactions = vi.fn().mockResolvedValue([]);

      // Should handle error gracefully
      await expect(stateManager.initialize()).rejects.toThrow();

      // Should work on retry
      await expect(stateManager.initialize()).resolves.not.toThrow();
    });

    it('should handle account generation failures', async () => {
      const { generateKeyPair } = await import('@pact-toolbox/crypto');
      (generateKeyPair as any).mockRejectedValueOnce(new Error('Crypto failed'));

      await expect(accountService.generateAccount()).rejects.toThrow();
      
      // Should work on retry with fixed crypto
      (generateKeyPair as any).mockResolvedValueOnce({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      });

      await expect(accountService.generateAccount()).resolves.toBeDefined();
    });

    it('should handle transaction service failures', async () => {
      mockStorage.saveTransaction = vi.fn().mockRejectedValueOnce(new Error('Save failed'))
                                           .mockResolvedValue(undefined);

      const transaction = createMockTransaction();
      
      // First attempt should fail
      await expect(transactionService.addTransaction(transaction)).rejects.toThrow();
      
      // Second attempt should succeed
      await expect(transactionService.addTransaction(transaction)).resolves.toBeDefined();
    });
  });

  describe('Event Coordination Workflows', () => {
    it('should coordinate events between components', async () => {
      eventCoordinator.setup();
      await stateManager.initialize();

      // Simulate account creation event
      const account = createMockAccount();
      const event = new CustomEvent('account-created', {
        detail: { account },
        bubbles: true,
        composed: true,
      });

      document.dispatchEvent(event);
      await waitFor(() => stateManager.getState().accounts.length > 0);

      const state = stateManager.getState();
      expect(state.accounts).toContainEqual(account);
    });

    it('should handle navigation events', async () => {
      eventCoordinator.setup();
      await stateManager.initialize();

      // Simulate navigation event
      const event = new CustomEvent('toolbox-navigate', {
        detail: { screen: 'settings' },
        bubbles: true,
        composed: true,
      });

      document.dispatchEvent(event);
      await waitFor(() => stateManager.getState().currentScreen === 'settings');

      const state = stateManager.getState();
      expect(state.currentScreen).toBe('settings');
    });

    it('should handle settings change events', async () => {
      eventCoordinator.setup();
      await stateManager.initialize();

      const newSettings = { autoLock: true, showTestNetworks: false };
      const event = new CustomEvent('settings-changed', {
        detail: { settings: newSettings },
        bubbles: true,
        composed: true,
      });

      document.dispatchEvent(event);
      await waitFor(() => stateManager.getState().settings.autoLock === true);

      const state = stateManager.getState();
      expect(state.settings).toEqual(newSettings);
    });
  });

  describe('Auto-Lock Integration', () => {
    it('should integrate auto-lock with state management', async () => {
      await stateManager.initialize();
      await autoLockManager.initialize();

      // Enable auto-lock
      await stateManager.updateState({ 
        settings: { autoLock: true, showTestNetworks: true }
      });

      // Add an account
      const account = createMockAccount();
      await stateManager.addAccount(account);

      let state = stateManager.getState();
      expect(state.selectedAccount).toEqual(account);
      expect(state.isLocked).toBe(false);

      // Trigger auto-lock
      advanceTimers(300001);
      await waitFor(100);

      state = stateManager.getState();
      expect(state.isLocked).toBe(true);
      expect(state.selectedAccount).toBeUndefined();
    });

    it('should not auto-lock when disabled', async () => {
      await stateManager.initialize();
      await autoLockManager.initialize();

      // Ensure auto-lock is disabled
      await stateManager.updateState({ 
        settings: { autoLock: false, showTestNetworks: true }
      });

      const account = createMockAccount();
      await stateManager.addAccount(account);

      // Try to trigger auto-lock
      advanceTimers(300001);
      await waitFor(100);

      const state = stateManager.getState();
      expect(state.isLocked).toBe(false);
      expect(state.selectedAccount).toEqual(account);
    });
  });

  describe('Data Export/Import Workflows', () => {
    it('should export and clear wallet data', async () => {
      await stateManager.initialize();

      // Add test data
      const account = createMockAccount();
      await stateManager.addAccount(account);

      const transaction = createMockTransaction({ from: account.address });
      await stateManager.addTransaction(transaction);

      // Export data
      const blob = await settingsService.exportWalletData();
      expect(blob).toBeInstanceOf(globalThis.Blob);

      // Clear data
      await stateManager.clearAllData();

      const state = stateManager.getState();
      expect(state.accounts).toHaveLength(0);
      expect(state.transactions).toHaveLength(0);
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes across service instances', async () => {
      // Create first instance and add data
      await stateManager.initialize();
      
      const account = createMockAccount();
      await stateManager.addAccount(account);
      
      const settings = { autoLock: true, showTestNetworks: false };
      await settingsService.updateSettings(settings);

      // Create new instances (simulating app restart)
      const newAccountService = new AccountService(mockStorage);
      const newSettingsService = new SettingsService(mockStorage);
      const newTransactionService = new TransactionService(mockStorage);
      const newStateManager = new WalletStateManager(
        newAccountService, 
        newSettingsService, 
        newTransactionService
      );

      await newStateManager.initialize();
      const newState = newStateManager.getState();

      expect(newState.accounts).toHaveLength(1);
      expect(newState.accounts[0]).toEqual(account);
      expect(newState.settings).toEqual(settings);
    });
  });
});