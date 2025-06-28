import { describe, it, expect, beforeEach } from 'vitest';
import { BaseWallet, detectBrowserExtension } from './base-wallet';
import { WalletError } from './types';
import type { WalletAccount, WalletNetwork } from './types';
import type { PartiallySignedTransaction, SignedTransaction } from '@pact-toolbox/types';

// Mock implementation for testing
class MockWallet extends BaseWallet {
  private mockAccount: WalletAccount = {
    address: 'k:test-public-key',
    publicKey: 'test-public-key',
  };

  private mockNetwork: WalletNetwork = {
    id: 'testnet',
    networkId: 'testnet04',
    name: 'Testnet',
    url: 'https://api.testnet.chainweb.com',
  };

  isInstalled(): boolean {
    return true;
  }

  async connect(_networkId?: string): Promise<WalletAccount> {
    this.connected = true;
    this.account = this.mockAccount;
    this.network = this.mockNetwork;
    return this.mockAccount;
  }

  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[]): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.connected) {
      throw new WalletError('NOT_CONNECTED', 'Wallet not connected');
    }
    
    if (Array.isArray(txOrTxs)) {
      return txOrTxs.map(tx => ({
        ...tx,
        sigs: [{ sig: 'mock-signature' }],
      } as SignedTransaction));
    } else {
      return {
        ...txOrTxs,
        sigs: [{ sig: 'mock-signature' }],
      } as SignedTransaction;
    }
  }
}

describe('BaseWallet', () => {
  let wallet: MockWallet;

  beforeEach(() => {
    wallet = new MockWallet();
  });

  describe('connection management', () => {
    it('should start disconnected', async () => {
      expect(await wallet.isConnected()).toBe(false);
    });

    it('should connect successfully', async () => {
      const account = await wallet.connect();
      expect(await wallet.isConnected()).toBe(true);
      expect(account.address).toBe('k:test-public-key');
      expect(account.publicKey).toBe('test-public-key');
    });

    it('should disconnect successfully', async () => {
      await wallet.connect();
      expect(await wallet.isConnected()).toBe(true);
      
      await wallet.disconnect();
      expect(await wallet.isConnected()).toBe(false);
    });
  });

  describe('account management', () => {
    it('should auto-connect when getting account', async () => {
      const account = await wallet.getAccount();
      expect(await wallet.isConnected()).toBe(true);
      expect(account.address).toBe('k:test-public-key');
    });

    it('should return account after connection', async () => {
      await wallet.connect();
      const account = await wallet.getAccount();
      expect(account.address).toBe('k:test-public-key');
    });

    // Note: getAccounts method is not part of the base interface
  });

  describe('network management', () => {
    it('should auto-connect when getting network', async () => {
      const network = await wallet.getNetwork();
      expect(await wallet.isConnected()).toBe(true);
      expect(network.networkId).toBe('testnet04');
    });

    it('should return network after connection', async () => {
      await wallet.connect();
      const network = await wallet.getNetwork();
      expect(network.networkId).toBe('testnet04');
      expect(network.name).toBe('Testnet');
    });
  });

  describe('transaction signing', () => {
    it('should sign transaction when connected', async () => {
      await wallet.connect();
      const mockTx = { cmd: 'test-cmd' } as PartiallySignedTransaction;
      const signedTx = await wallet.sign(mockTx);
      const signed = signedTx as SignedTransaction;
      expect(signed.sigs).toHaveLength(1);
      expect(signed.sigs![0]?.sig).toBe('mock-signature');
    });

    it('should throw error when signing without connection', async () => {
      const mockTx = { cmd: 'test-cmd' } as PartiallySignedTransaction;
      await expect(wallet.sign(mockTx)).rejects.toThrow('Wallet not connected');
    });

    it('should sign batch transactions when connected', async () => {
      await wallet.connect();
      const mockTxs = [
        { cmd: 'test-cmd-1' } as PartiallySignedTransaction,
        { cmd: 'test-cmd-2' } as PartiallySignedTransaction,
      ];
      const signedTxs = await wallet.sign(mockTxs);
      const signed = signedTxs as SignedTransaction[];
      expect(signed).toHaveLength(2);
      expect(signed[0]?.sigs?.[0]?.sig).toBe('mock-signature');
      expect(signed[1]?.sigs?.[0]?.sig).toBe('mock-signature');
    });
  });
});

describe('WalletError', () => {
  it('should create error with correct type and message', () => {
    const error = new WalletError('CONNECTION_FAILED', 'Connection failed');
    expect(error.type).toBe('CONNECTION_FAILED');
    expect(error.message).toBe('Connection failed');
    expect(error.name).toBe('WalletError');
  });

  it('should have static factory methods', () => {
    const notFoundError = WalletError.notFound('test-wallet');
    expect(notFoundError.type).toBe('NOT_FOUND');
    expect(notFoundError.message).toContain('test-wallet');

    const connectionError = WalletError.connectionFailed('Network error');
    expect(connectionError.type).toBe('CONNECTION_FAILED');
    expect(connectionError.message).toContain('Network error');
  });
});

describe('detectBrowserExtension', () => {
  it('should return false in non-browser environment', async () => {
    const result = await detectBrowserExtension('testExtension', 100);
    expect(result).toBe(false);
  });

  // Browser-specific tests would require a browser test environment
});