import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountService } from './account-service';
import { DevWalletStorage } from '../storage';
import { WalletError } from '../types/error-types';
import { 
  setupBrowserMocks, 
  resetMocks, 
  createMockAccount, 
  createMockDevWalletKey 
} from '../test-utils/setup';

// Mock the crypto module
vi.mock('@pact-toolbox/crypto', () => ({
  generateKeyPair: vi.fn(),
  exportBase16Key: vi.fn(),
  createKeyPairFromPrivateKeyBytes: vi.fn(),
}));

describe('AccountService', () => {
  let accountService: AccountService;
  let mockStorage: DevWalletStorage;

  beforeEach(() => {
    setupBrowserMocks();
    resetMocks();
    
    // Create mock storage
    mockStorage = {
      saveKey: vi.fn(),
      getKeys: vi.fn(),
      removeKey: vi.fn(),
    } as any;

    accountService = new AccountService(mockStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAccount', () => {
    it('should generate a valid account with keys', async () => {
      // Mock crypto functions
      const { generateKeyPair, exportBase16Key } = await import('@pact-toolbox/crypto');
      const mockKeyPair = {
        publicKey: { type: 'public', algorithm: { name: 'Ed25519' }, extractable: true },
        privateKey: { type: 'private', algorithm: { name: 'Ed25519' }, extractable: true },
      };
      
      (generateKeyPair as any).mockResolvedValue(mockKeyPair);
      (exportBase16Key as any)
        .mockResolvedValueOnce('1'.repeat(64)) // public key
        .mockResolvedValueOnce('2'.repeat(64)); // private key

      const account = await accountService.generateAccount('Test Account');

      expect(account).toEqual({
        address: 'k:' + '1'.repeat(64),
        publicKey: '1'.repeat(64),
        privateKey: '2'.repeat(64),
        name: 'Test Account',
        chainId: '0',
        balance: 0,
      });

      expect(generateKeyPair).toHaveBeenCalledOnce();
      expect(exportBase16Key).toHaveBeenCalledTimes(2);
    });

    it('should generate account with default name if not provided', async () => {
      const { generateKeyPair, exportBase16Key } = await import('@pact-toolbox/crypto');
      (generateKeyPair as any).mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      });
      (exportBase16Key as any)
        .mockResolvedValueOnce('1'.repeat(64))
        .mockResolvedValueOnce('2'.repeat(64));

      const account = await accountService.generateAccount();

      expect(account.name).toMatch(/^Account \d+$/);
    });

    it('should throw WalletError on key generation failure', async () => {
      const { generateKeyPair } = await import('@pact-toolbox/crypto');
      (generateKeyPair as any).mockRejectedValue(new Error('Key generation failed'));

      await expect(accountService.generateAccount()).rejects.toThrow(WalletError);
      await expect(accountService.generateAccount()).rejects.toThrow('Failed to generate new account');
    });

    it('should throw WalletError on key export failure', async () => {
      const { generateKeyPair, exportBase16Key } = await import('@pact-toolbox/crypto');
      (generateKeyPair as any).mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      });
      (exportBase16Key as any).mockRejectedValue(new Error('Export failed'));

      await expect(accountService.generateAccount()).rejects.toThrow(WalletError);
    });
  });

  describe('importAccount', () => {
    it('should import account from valid private key', async () => {
      const { createKeyPairFromPrivateKeyBytes, exportBase16Key } = await import('@pact-toolbox/crypto');
      (createKeyPairFromPrivateKeyBytes as any).mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      });
      (exportBase16Key as any).mockResolvedValue('1'.repeat(64));

      const privateKey = '2'.repeat(64);
      const account = await accountService.importAccount(privateKey, 'Imported Account');

      expect(account.privateKey).toBe(privateKey);
      expect(account.name).toBe('Imported Account');
      expect(account.address).toMatch(/^k:/);
    });

    it('should throw WalletError for invalid private key', async () => {
      await expect(accountService.importAccount('invalid')).rejects.toThrow(WalletError);
      await expect(accountService.importAccount('invalid')).rejects.toThrow('Invalid private key');
    });

    it('should generate default name for imported account', async () => {
      const { createKeyPairFromPrivateKeyBytes, exportBase16Key } = await import('@pact-toolbox/crypto');
      (createKeyPairFromPrivateKeyBytes as any).mockResolvedValue({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      });
      (exportBase16Key as any).mockResolvedValue('1'.repeat(64));

      const account = await accountService.importAccount('2'.repeat(64));
      expect(account.name).toMatch(/^Imported Account \d+$/);
    });
  });

  describe('validatePrivateKey', () => {
    it('should validate correct private key format', async () => {
      const result = await accountService.validatePrivateKey('2'.repeat(64));
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty private key', async () => {
      const result = await accountService.validatePrivateKey('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private key is required');
    });

    it('should reject invalid hex format', async () => {
      const result = await accountService.validatePrivateKey('invalid_hex');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private key must be a valid hexadecimal string');
    });

    it('should reject wrong length', async () => {
      const result = await accountService.validatePrivateKey('abc123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private key must be exactly 64 hexadecimal characters (32 bytes)');
    });

    it('should reject all zeros', async () => {
      const result = await accountService.validatePrivateKey('0'.repeat(64));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Private key cannot be all zeros');
    });

    it('should warn about weak keys', async () => {
      const result = await accountService.validatePrivateKey('f'.repeat(64));
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Private key appears to be weak (all ones)');
    });
  });

  describe('validateAccount', () => {
    it('should validate correct account', async () => {
      const account = createMockAccount();
      const result = await accountService.validateAccount(account);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject account without address', async () => {
      const account = createMockAccount({ address: '' });
      const result = await accountService.validateAccount(account);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Account address is required');
    });

    it('should reject account without public key', async () => {
      const account = createMockAccount({ publicKey: '' });
      const result = await accountService.validateAccount(account);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Public key is required');
    });

    it('should reject invalid public key format', async () => {
      const account = createMockAccount({ publicKey: 'invalid' });
      const result = await accountService.validateAccount(account);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Public key must be a 64-character hexadecimal string');
    });

    it('should warn about non-Kadena address format', async () => {
      const account = createMockAccount({ address: 'invalid_address' });
      const result = await accountService.validateAccount(account);
      
      expect(result.warnings).toContain('Account address should start with "k:" for Kadena accounts');
    });

    it('should warn about empty name', async () => {
      const account = createMockAccount({ name: '' });
      const result = await accountService.validateAccount(account);
      
      expect(result.warnings).toContain('Account name is empty');
    });
  });

  describe('saveAccount', () => {
    it('should save valid account to storage', async () => {
      const account = createMockAccount();
      mockStorage.saveKey = vi.fn().mockResolvedValue(undefined);

      await accountService.saveAccount(account);

      expect(mockStorage.saveKey).toHaveBeenCalledWith({
        address: account.address,
        publicKey: account.publicKey,
        privateKey: account.privateKey,
        name: account.name,
        createdAt: expect.any(Number),
      });
    });

    it('should throw WalletError for invalid account', async () => {
      const account = createMockAccount({ address: '' });

      await expect(accountService.saveAccount(account)).rejects.toThrow(WalletError);
      await expect(accountService.saveAccount(account)).rejects.toThrow('Cannot save invalid account');
    });

    it('should handle storage errors', async () => {
      const account = createMockAccount();
      mockStorage.saveKey = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(accountService.saveAccount(account)).rejects.toThrow(WalletError);
    });
  });

  describe('loadAccounts', () => {
    it('should load accounts from storage', async () => {
      const mockKeys = [createMockDevWalletKey(), createMockDevWalletKey({ address: 'k:different' })];
      mockStorage.getKeys = vi.fn().mockResolvedValue(mockKeys);

      const accounts = await accountService.loadAccounts();

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        address: mockKeys[0].address,
        publicKey: mockKeys[0].publicKey,
        privateKey: mockKeys[0].privateKey,
        name: mockKeys[0].name,
        chainId: '0',
        balance: 0,
      });
    });

    it('should handle empty storage', async () => {
      mockStorage.getKeys = vi.fn().mockResolvedValue([]);

      const accounts = await accountService.loadAccounts();

      expect(accounts).toHaveLength(0);
    });

    it('should handle storage errors', async () => {
      mockStorage.getKeys = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(accountService.loadAccounts()).rejects.toThrow(WalletError);
    });

    it('should handle accounts without names', async () => {
      const mockKeys = [createMockDevWalletKey({ name: undefined })];
      mockStorage.getKeys = vi.fn().mockResolvedValue(mockKeys);

      const accounts = await accountService.loadAccounts();

      expect(accounts[0].name).toBe('Unnamed Account');
    });
  });

  describe('removeAccount', () => {
    it('should remove account from storage', async () => {
      const address = 'k:test_address';
      mockStorage.removeKey = vi.fn().mockResolvedValue(undefined);

      await accountService.removeAccount(address);

      expect(mockStorage.removeKey).toHaveBeenCalledWith(address);
    });

    it('should throw WalletError for empty address', async () => {
      await expect(accountService.removeAccount('')).rejects.toThrow(WalletError);
      await expect(accountService.removeAccount('')).rejects.toThrow('Account address is required for removal');
    });

    it('should handle storage errors', async () => {
      mockStorage.removeKey = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(accountService.removeAccount('k:address')).rejects.toThrow(WalletError);
    });
  });

  describe('accountExists', () => {
    it('should return true for existing account', async () => {
      const mockKeys = [createMockDevWalletKey({ address: 'k:existing' })];
      mockStorage.getKeys = vi.fn().mockResolvedValue(mockKeys);

      const exists = await accountService.accountExists('k:existing');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing account', async () => {
      mockStorage.getKeys = vi.fn().mockResolvedValue([]);

      const exists = await accountService.accountExists('k:non_existing');

      expect(exists).toBe(false);
    });

    it('should return false on storage error', async () => {
      mockStorage.getKeys = vi.fn().mockRejectedValue(new Error('Storage error'));

      const exists = await accountService.accountExists('k:address');

      expect(exists).toBe(false);
    });
  });

  describe('getAccountBalance', () => {
    it('should return 0 for placeholder implementation', async () => {
      const balance = await accountService.getAccountBalance('k:address');
      expect(balance).toBe(0);
    });
  });
});