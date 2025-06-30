import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from './wallet-service';
import { WalletError } from '@pact-toolbox/wallet-core';
import type { Wallet, WalletProvider, WalletAccount, WalletNetwork } from '@pact-toolbox/wallet-core';
import type { PartiallySignedTransaction, SignedTransaction } from '@pact-toolbox/types';

// Mock wallet implementation
class MockWallet implements Wallet {
  constructor(
    public id: string,
    private shouldConnect = true,
    private shouldSign = true
  ) {}

  isInstalled(): boolean {
    return true;
  }

  async connect(_networkId?: string): Promise<WalletAccount> {
    if (!this.shouldConnect) {
      throw new WalletError('CONNECTION_FAILED', 'Mock connection failed');
    }
    return {
      address: `k:${this.id}-address`,
      publicKey: `${this.id}-public-key`,
    };
  }

  async getAccount(_networkId?: string): Promise<WalletAccount> {
    return {
      address: `k:${this.id}-address`,
      publicKey: `${this.id}-public-key`,
    };
  }

  async getNetwork(): Promise<WalletNetwork> {
    return {
      id: 'testnet',
      networkId: 'testnet04',
      name: 'Testnet',
      url: 'https://api.testnet.chainweb.com',
    };
  }

  async isConnected(_networkId?: string): Promise<boolean> {
    return true;
  }

  async disconnect(_networkId?: string): Promise<void> {
    // Mock disconnect
  }

  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[]): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.shouldSign) {
      throw new WalletError('SIGNING_FAILED', 'Mock signing failed');
    }
    
    if (Array.isArray(txOrTxs)) {
      return txOrTxs.map(tx => ({
        ...tx,
        sigs: [{ sig: `${this.id}-signature` }],
      } as SignedTransaction));
    } else {
      return {
        ...txOrTxs,
        sigs: [{ sig: `${this.id}-signature` }],
      } as SignedTransaction;
    }
  }
}

// Mock provider implementation
class MockProvider implements WalletProvider {
  constructor(
    public metadata: {
      id: string;
      name: string;
      description: string;
      type: 'browser-extension' | 'mobile' | 'hardware' | 'built-in' | 'desktop' | 'web';
    },
    private available = true,
    private shouldConnect = true,
    private shouldSign = true
  ) {}

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async createWallet(): Promise<Wallet> {
    return new MockWallet(this.metadata.id, this.shouldConnect, this.shouldSign);
  }
}

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(() => {
    service = new WalletService();
    vi.clearAllMocks();
  });

  describe('provider management', () => {
    it('should register a single provider', () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet provider',
        type: 'built-in',
      });

      service.register(provider);
      const providers = service.getProviders();
      
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(provider);
    });

    it('should register multiple providers', () => {
      const providers = [
        new MockProvider({
          id: 'wallet-1',
          name: 'Wallet 1',
          description: 'First wallet',
          type: 'built-in',
        }),
        new MockProvider({
          id: 'wallet-2',
          name: 'Wallet 2',
          description: 'Second wallet',
          type: 'browser-extension',
        }),
      ];

      service.registerAll(providers);
      const registered = service.getProviders();
      
      expect(registered).toHaveLength(2);
      expect(registered[0].metadata.id).toBe('wallet-1');
      expect(registered[1].metadata.id).toBe('wallet-2');
    });

    it('should overwrite provider with same id', () => {
      const provider1 = new MockProvider({
        id: 'same-id',
        name: 'Original',
        description: 'Original provider',
        type: 'built-in',
      });

      const provider2 = new MockProvider({
        id: 'same-id',
        name: 'Replacement',
        description: 'Replacement provider',
        type: 'browser-extension',
      });

      service.register(provider1);
      service.register(provider2);
      
      const providers = service.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].metadata.name).toBe('Replacement');
    });
  });

  describe('wallet availability', () => {
    it('should return available wallets', async () => {
      const providers = [
        new MockProvider({
          id: 'available-wallet',
          name: 'Available Wallet',
          description: 'This wallet is available',
          type: 'built-in',
        }, true),
        new MockProvider({
          id: 'unavailable-wallet',
          name: 'Unavailable Wallet',
          description: 'This wallet is not available',
          type: 'browser-extension',
        }, false),
      ];

      service.registerAll(providers);
      const available = await service.getAvailableWallets();
      
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('available-wallet');
    });

    it('should handle errors in availability check', async () => {
      const errorProvider = new MockProvider({
        id: 'error-wallet',
        name: 'Error Wallet',
        description: 'This wallet throws errors',
        type: 'built-in',
      });
      
      errorProvider.isAvailable = vi.fn().mockRejectedValue(new Error('Availability check failed'));
      
      service.register(errorProvider);
      const available = await service.getAvailableWallets();
      
      expect(available).toHaveLength(0);
    });
  });

  describe('wallet connection', () => {
    it('should connect to a wallet', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      
      const connectedSpy = vi.fn();
      service.on('connected', connectedSpy);
      
      const wallet = await service.connect('test-wallet');
      
      expect(service.getConnectedWallets()).toContain(wallet);
      expect(service.getPrimaryWallet()).toBe(wallet);
      expect(connectedSpy).toHaveBeenCalledWith(wallet);
    });

    it('should throw error for non-existent wallet', async () => {
      await expect(service.connect('non-existent')).rejects.toThrow('Wallet "non-existent" not found');
    });

    it('should throw error for unavailable wallet', async () => {
      const provider = new MockProvider({
        id: 'unavailable',
        name: 'Unavailable',
        description: 'Unavailable wallet',
        type: 'built-in',
      }, false);

      service.register(provider);
      
      await expect(service.connect('unavailable')).rejects.toThrow('Wallet "unavailable" not found or not installed');
    });

    it('should handle connection failures', async () => {
      const provider = new MockProvider({
        id: 'fail-wallet',
        name: 'Fail Wallet',
        description: 'This wallet fails to connect',
        type: 'built-in',
      }, true, false);

      service.register(provider);
      
      const errorSpy = vi.fn();
      service.on('error', errorSpy);
      
      await expect(service.connect('fail-wallet')).rejects.toThrow('Mock connection failed');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle connection timeout', async () => {
      const provider = new MockProvider({
        id: 'slow-wallet',
        name: 'Slow Wallet',
        description: 'This wallet is slow',
        type: 'built-in',
      });

      // Mock slow connection
      provider.createWallet = vi.fn().mockImplementation(async () => {
        const wallet = new MockWallet('slow-wallet');
        wallet.connect = vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 1000))
        );
        return wallet;
      });

      service.register(provider);
      
      await expect(service.connect('slow-wallet', { timeout: 100 }))
        .rejects.toThrow('Connection timed out after 100ms');
    });

    it('should return already connected wallet', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      
      const wallet1 = await service.connect('test-wallet');
      const wallet2 = await service.connect('test-wallet');
      
      expect(wallet1).toBe(wallet2);
      expect(service.getConnectedWallets()).toHaveLength(1);
    });
  });

  describe('auto-connect', () => {
    it('should auto-connect to first available wallet', async () => {
      const providers = [
        new MockProvider({
          id: 'unavailable',
          name: 'Unavailable',
          description: 'Not available',
          type: 'browser-extension',
        }, false),
        new MockProvider({
          id: 'available',
          name: 'Available',
          description: 'Available wallet',
          type: 'built-in',
        }, true),
      ];

      service.registerAll(providers);
      
      const wallet = await service.autoConnect();
      
      expect(wallet).toBeDefined();
      expect(service.getPrimaryWallet()).toBe(wallet);
    });

    it('should prefer wallets in order', async () => {
      const providers = [
        new MockProvider({
          id: 'wallet-1',
          name: 'Wallet 1',
          description: 'First wallet',
          type: 'built-in',
        }),
        new MockProvider({
          id: 'wallet-2',
          name: 'Wallet 2',
          description: 'Second wallet',
          type: 'browser-extension',
        }),
        new MockProvider({
          id: 'wallet-3',
          name: 'Wallet 3',
          description: 'Third wallet',
          type: 'mobile',
        }),
      ];

      service.registerAll(providers);
      
      const wallet = await service.autoConnect({
        preferredWallets: ['wallet-3', 'wallet-1', 'wallet-2'],
      });
      
      expect(wallet).toBeDefined();
      // Should connect to wallet-3 as it's first in preferred list
      const account = await wallet!.getAccount();
      expect(account.address).toBe('k:wallet-3-address');
    });

    it('should skip unavailable wallets when skipUnavailable is true', async () => {
      const providers = [
        new MockProvider({
          id: 'unavailable-1',
          name: 'Unavailable 1',
          description: 'Not available',
          type: 'browser-extension',
        }, false),
        new MockProvider({
          id: 'unavailable-2',
          name: 'Unavailable 2',
          description: 'Also not available',
          type: 'mobile',
        }, false),
        new MockProvider({
          id: 'available',
          name: 'Available',
          description: 'This one works',
          type: 'built-in',
        }, true),
      ];

      service.registerAll(providers);
      
      const wallet = await service.autoConnect({ skipUnavailable: true });
      
      expect(wallet).toBeDefined();
      const account = await wallet!.getAccount();
      expect(account.address).toBe('k:available-address');
    });

    it('should throw when no wallets available', async () => {
      const provider = new MockProvider({
        id: 'unavailable',
        name: 'Unavailable',
        description: 'Not available',
        type: 'browser-extension',
      }, false);

      service.register(provider);
      
      await expect(service.autoConnect()).rejects.toThrow('Connection failed: Failed to connect to any wallet');
    });
  });

  describe('wallet disconnection', () => {
    it('should disconnect wallet', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      
      const wallet = await service.connect('test-wallet');
      const disconnectedSpy = vi.fn();
      service.on('disconnected', disconnectedSpy);
      
      await service.disconnect('test-wallet');
      
      expect(service.getConnectedWallets()).not.toContain(wallet);
      expect(service.getPrimaryWallet()).toBeNull();
      expect(disconnectedSpy).toHaveBeenCalledWith('test-wallet');
    });

    it('should handle disconnecting non-existent wallet gracefully', async () => {
      // Should not throw an error, just return silently
      await expect(service.disconnect('non-existent')).resolves.toBeUndefined();
    });

    it('should clear all connections', async () => {
      const providers = [
        new MockProvider({
          id: 'wallet-1',
          name: 'Wallet 1',
          description: 'First wallet',
          type: 'built-in',
        }),
        new MockProvider({
          id: 'wallet-2',
          name: 'Wallet 2',
          description: 'Second wallet',
          type: 'browser-extension',
        }),
      ];

      service.registerAll(providers);
      
      await service.connect('wallet-1');
      await service.connect('wallet-2');
      
      expect(service.getConnectedWallets()).toHaveLength(2);
      
      await service.clearConnections();
      
      expect(service.getConnectedWallets()).toHaveLength(0);
      expect(service.getPrimaryWallet()).toBeNull();
    });
  });

  describe('primary wallet management', () => {
    it('should set primary wallet', async () => {
      const providers = [
        new MockProvider({
          id: 'wallet-1',
          name: 'Wallet 1',
          description: 'First wallet',
          type: 'built-in',
        }),
        new MockProvider({
          id: 'wallet-2',
          name: 'Wallet 2',
          description: 'Second wallet',
          type: 'browser-extension',
        }),
      ];

      service.registerAll(providers);
      
      const wallet1 = await service.connect('wallet-1');
      await service.connect('wallet-2');
      
      expect(service.getPrimaryWallet()).toBe(wallet1); // First connected
      
      service.setPrimaryWallet(wallet1);
      expect(service.getPrimaryWallet()).toBe(wallet1);
    });

    it('should throw error when setting disconnected wallet as primary', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      
      const wallet = await service.connect('test-wallet');
      await service.disconnect('test-wallet');
      
      expect(() => service.setPrimaryWallet(wallet))
        .toThrow('Cannot set disconnected wallet as primary');
    });
  });

  describe('transaction signing', () => {
    it('should sign transaction with primary wallet', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      await service.connect('test-wallet');
      
      const tx = { cmd: 'test-tx' } as PartiallySignedTransaction;
      const signed = await service.sign(tx);
      
      expect(signed.sigs![0].sig).toBe('test-wallet-signature');
    });

    it('should sign batch transactions', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      await service.connect('test-wallet');
      
      const txs = [
        { cmd: 'tx-1' } as PartiallySignedTransaction,
        { cmd: 'tx-2' } as PartiallySignedTransaction,
      ];
      const signed = await service.sign(txs);
      
      expect(signed).toHaveLength(2);
      expect((signed as SignedTransaction[])[0].sigs![0].sig).toBe('test-wallet-signature');
      expect((signed as SignedTransaction[])[1].sigs![0].sig).toBe('test-wallet-signature');
    });

    it('should throw error when no primary wallet', async () => {
      const tx = { cmd: 'test-tx' } as PartiallySignedTransaction;
      
      await expect(service.sign(tx))
        .rejects.toThrow('Wallet "No primary wallet set" is not connected');
    });

    it('should handle signing failures', async () => {
      const provider = new MockProvider({
        id: 'fail-sign',
        name: 'Fail Sign',
        description: 'Fails to sign',
        type: 'built-in',
      }, true, true, false);

      service.register(provider);
      await service.connect('fail-sign');
      
      const tx = { cmd: 'test-tx' } as PartiallySignedTransaction;
      
      await expect(service.sign(tx))
        .rejects.toThrow('Mock signing failed');
    });
  });

  describe('service reset', () => {
    it('should reset service state', async () => {
      const provider = new MockProvider({
        id: 'test-wallet',
        name: 'Test Wallet',
        description: 'Test wallet',
        type: 'built-in',
      });

      service.register(provider);
      await service.connect('test-wallet');
      
      expect(service.getProviders()).toHaveLength(1);
      expect(service.getConnectedWallets()).toHaveLength(1);
      
      await service.reset();
      
      expect(service.getProviders()).toHaveLength(0);
      expect(service.getConnectedWallets()).toHaveLength(0);
      expect(service.getPrimaryWallet()).toBeNull();
    });
  });
});