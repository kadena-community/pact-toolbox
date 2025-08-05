import { generateKeyPair } from '@pact-toolbox/crypto';
import { CoinService, type CoinServiceConfig, type CreateAccountOptions } from '@pact-toolbox/kda';
import type { ChainId, INetworkProvider, ISignerResolver, IChainwebClient } from '@pact-toolbox/types';
import type { Account, DevWalletKey } from '../types';
import type { AccountValidationResult } from '../types/enhanced-types';
import { WalletError } from '../types/error-types';
import { handleErrors } from '../utils/error-handler';
import { DevWalletStorage } from '../storage';
import { accountLogger } from '../utils/logger';

/**
 * Service for managing wallet accounts
 */
export class AccountService {
  private storage: DevWalletStorage;
  private coinService?: CoinService;
  private networkProvider?: INetworkProvider;
  private signerResolver?: ISignerResolver;
  private chainwebClient?: IChainwebClient;

  constructor(storage?: DevWalletStorage, config?: Partial<CoinServiceConfig>) {
    this.storage = storage || new DevWalletStorage();
    if (config) {
      this.networkProvider = config.networkProvider;
      this.signerResolver = config.signerResolver;
      this.chainwebClient = config.chainwebClient;
      
      // Initialize CoinService if config is provided
      this.coinService = new CoinService({
        ...config,
        defaultChainId: config.defaultChainId || '0'
      });
    }
  }

  /**
   * Generate a new account with cryptographic keys
   */
  @handleErrors({ component: 'AccountService' })
  async generateAccount(name?: string): Promise<Account> {
    try {
      accountLogger.operation('Generate account', 'start');
      
      // Generate key pair
      const keyPair = await generateKeyPair();
      
      // Export keys to hex format
      const { exportBase16Key } = await import('@pact-toolbox/crypto');
      const publicKey = await exportBase16Key(keyPair.publicKey);
      const privateKey = await exportBase16Key(keyPair.privateKey);
      
      // Generate address (for now, use first 40 chars of public key as placeholder)
      const address = `k:${publicKey}`;
      
      const account: Account = {
        address,
        publicKey,
        privateKey,
        name: name || `Account ${Date.now()}`,
        chainId: '0',
        balance: 0,
      };

      // Validate the generated account
      const validation = await this.validateAccount(account);
      if (!validation.isValid) {
        throw WalletError.create(
          'CRYPTO_ERROR',
          `Generated account validation failed: ${validation.errors.join(', ')}`,
          { severity: 'high' }
        );
      }

      accountLogger.operation('Generate account', 'success', { address, name: account.name });
      return account;
    } catch (error) {
      accountLogger.operation('Generate account', 'error', { error });
      throw WalletError.create(
        'CRYPTO_ERROR',
        'Failed to generate new account',
        {
          severity: 'high',
          cause: error as Error,
          context: { operation: 'generateAccount', name },
        }
      );
    }
  }

  /**
   * Import an account from a private key
   */
  @handleErrors({ component: 'AccountService' })
  async importAccount(privateKeyHex: string, name?: string): Promise<Account> {
    try {
      accountLogger.operation('Import account', 'start');
      
      // Validate private key format
      const validation = await this.validatePrivateKey(privateKeyHex);
      if (!validation.isValid) {
        throw WalletError.create(
          'VALIDATION_ERROR',
          `Invalid private key: ${validation.errors.join(', ')}`,
          { severity: 'medium', recoverable: true }
        );
      }

      // Import the private key and derive public key
      const { createKeyPairFromPrivateKeyBytes, exportBase16Key } = await import('@pact-toolbox/crypto');
      const privateKeyBytes = this.hexToUint8Array(privateKeyHex);
      const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
      const publicKey = await exportBase16Key(keyPair.publicKey);
      
      const address = `k:${publicKey}`;
      
      const account: Account = {
        address,
        publicKey,
        privateKey: privateKeyHex,
        name: name || `Imported Account ${Date.now()}`,
        chainId: '0',
        balance: 0,
      };

      // Validate the imported account
      const accountValidation = await this.validateAccount(account);
      if (!accountValidation.isValid) {
        throw WalletError.create(
          'VALIDATION_ERROR',
          `Imported account validation failed: ${accountValidation.errors.join(', ')}`,
          { severity: 'medium' }
        );
      }

      accountLogger.operation('Import account', 'success', { address, name: account.name });
      return account;
    } catch (error) {
      accountLogger.operation('Import account', 'error', { error });
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'IMPORT_FAILED',
        'Failed to import account from private key',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'importAccount', hasName: !!name },
        }
      );
    }
  }

  /**
   * Validate a private key
   */
  async validatePrivateKey(privateKeyHex: string): Promise<AccountValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if key is provided
    if (!privateKeyHex) {
      errors.push('Private key is required');
      return { isValid: false, errors, warnings };
    }

    // Check hex format
    if (!/^[0-9a-fA-F]+$/.test(privateKeyHex)) {
      errors.push('Private key must be a valid hexadecimal string');
    }

    // Check length (64 chars for 32 bytes)
    if (privateKeyHex.length !== 64) {
      errors.push('Private key must be exactly 64 hexadecimal characters (32 bytes)');
    }

    // Check if key is all zeros (invalid)
    if (privateKeyHex === '0'.repeat(64)) {
      errors.push('Private key cannot be all zeros');
    }

    // Check if key is all ones (weak)
    if (privateKeyHex === 'f'.repeat(64)) {
      warnings.push('Private key appears to be weak (all ones)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate an account object
   */
  async validateAccount(account: Account): Promise<AccountValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate address
    if (!account.address) {
      errors.push('Account address is required');
    } else if (!account.address.startsWith('k:')) {
      warnings.push('Account address should start with "k:" for Kadena accounts');
    }

    // Validate public key
    if (!account.publicKey) {
      errors.push('Public key is required');
    } else if (!/^[0-9a-fA-F]{64}$/.test(account.publicKey)) {
      errors.push('Public key must be a 64-character hexadecimal string');
    }

    // Validate private key if present
    if (account.privateKey) {
      const privateKeyValidation = await this.validatePrivateKey(account.privateKey);
      errors.push(...privateKeyValidation.errors);
      warnings.push(...privateKeyValidation.warnings);
    }

    // Validate name
    if (!account.name || account.name.trim().length === 0) {
      warnings.push('Account name is empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Save an account to storage
   */
  @handleErrors({ component: 'AccountService' })
  async saveAccount(account: Account): Promise<void> {
    try {
      const validation = await this.validateAccount(account);
      if (!validation.isValid) {
        throw WalletError.create(
          'VALIDATION_ERROR',
          `Cannot save invalid account: ${validation.errors.join(', ')}`,
          { severity: 'medium', recoverable: true }
        );
      }

      const walletKey: DevWalletKey = {
        address: account.address,
        publicKey: account.publicKey,
        privateKey: account.privateKey || '',
        name: account.name,
        createdAt: Date.now(),
      };

      await this.storage.saveKey(walletKey);
      
      // Try to create account on blockchain if network context is available
      if (this.coinService && account.privateKey) {
        try {
          await this.createAccountOnBlockchain(walletKey);
        } catch (error) {
          accountLogger.warn('Failed to create account on blockchain, but saved locally', { 
            address: account.address, 
            error 
          });
        }
      }
      
      accountLogger.debug('Account saved successfully', { address: account.address });
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to save account to storage',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'saveAccount', address: account.address },
        }
      );
    }
  }

  /**
   * Load all accounts from storage
   */
  @handleErrors({ component: 'AccountService' })
  async loadAccounts(): Promise<Account[]> {
    try {
      const walletKeys = await this.storage.getKeys();
      
      const accounts: Account[] = walletKeys.map(key => ({
        address: key.address,
        publicKey: key.publicKey,
        privateKey: key.privateKey,
        name: key.name || 'Unnamed Account',
        chainId: '0',
        balance: 0,
      }));

      accountLogger.debug(`Loaded ${accounts.length} accounts from storage`);
      return accounts;
    } catch (error) {
      accountLogger.error('Failed to load accounts', { error });
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to load accounts from storage',
        {
          severity: 'medium',
          recoverable: true,
          cause: error as Error,
          context: { operation: 'loadAccounts' },
        }
      );
    }
  }

  /**
   * Remove an account from storage
   */
  @handleErrors({ component: 'AccountService' })
  async removeAccount(address: string): Promise<void> {
    try {
      if (!address) {
        throw WalletError.create(
          'VALIDATION_ERROR',
          'Account address is required for removal',
          { severity: 'low', recoverable: true }
        );
      }

      await this.storage.removeKey(address);
      accountLogger.operation('Remove account', 'success', { address });
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to remove account from storage',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'removeAccount', address },
        }
      );
    }
  }

  /**
   * Check if an account exists
   */
  async accountExists(address: string): Promise<boolean> {
    try {
      const accounts = await this.loadAccounts();
      return accounts.some(account => account.address === address);
    } catch (error) {
      accountLogger.error('Failed to check account existence', { error });
      return false; // Assume doesn't exist on error
    }
  }

  /**
   * Get account balance from blockchain
   */
  async getAccountBalance(address: string, chainId: ChainId = '0'): Promise<number> {
    try {
      if (!this.coinService) {
        accountLogger.warn('CoinService not initialized, returning 0 balance');
        return 0;
      }

      accountLogger.debug('Fetching balance from blockchain', { address, chainId });
      
      const balanceStr = await this.coinService.getBalance(address, { chainId });
      const balance = parseFloat(balanceStr);
      
      accountLogger.debug('Balance fetched successfully', { address, balance });
      return balance;
    } catch (error) {
      // Account might not exist on blockchain yet
      if (error instanceof Error && error.message.includes('row not found')) {
        accountLogger.debug('Account not found on blockchain', { address });
        return 0;
      }
      
      accountLogger.error('Failed to fetch balance', { address, error });
      return 0;
    }
  }

  /**
   * Create account on blockchain (devnet)
   */
  async createAccountOnBlockchain(account: DevWalletKey, chainId: ChainId = '0'): Promise<boolean> {
    try {
      if (!this.coinService) {
        accountLogger.warn('CoinService not initialized');
        return false;
      }

      accountLogger.operation('Create account on blockchain', 'start', { address: account.address, chainId });
      
      // Check if account already exists
      const exists = await this.coinService.accountExists(account.address, { chainId });
      if (exists) {
        accountLogger.debug('Account already exists on blockchain', { address: account.address });
        return true;
      }

      // Create the account with a single key guard
      const guard = {
        keys: [account.publicKey],
        pred: 'keys-all' as const
      };

      const createOptions: CreateAccountOptions = {
        account: account.address,
        guard,
        chainId,
        gasLimit: 1000,
        gasPrice: 0.000001,
        ttl: 28800
      };

      await this.coinService.createAccount(createOptions);
      
      accountLogger.operation('Create account on blockchain', 'success', { address: account.address });
      return true;
    } catch (error) {
      accountLogger.operation('Create account on blockchain', 'error', { address: account.address, error });
      return false;
    }
  }

  /**
   * Set network context for blockchain operations
   */
  setNetworkContext(config: Partial<CoinServiceConfig>): void {
    this.networkProvider = config.networkProvider;
    this.signerResolver = config.signerResolver;
    this.chainwebClient = config.chainwebClient;
    this.coinService = new CoinService({
      ...config,
      defaultChainId: config.defaultChainId || '0'
    });
    accountLogger.debug('Network context updated');
  }

  /**
   * Utility: Convert hex string to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    // Ensure even length
    const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;
    
    const bytes = new Uint8Array(paddedHex.length / 2);
    for (let i = 0; i < paddedHex.length; i += 2) {
      bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
    }
    return bytes;
  }
}