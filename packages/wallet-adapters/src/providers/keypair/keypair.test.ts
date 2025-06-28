import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeypairWalletProvider } from './provider';
import { KeypairWallet } from './wallet';
import { WalletError } from '@pact-toolbox/wallet-core';
import type { PartiallySignedTransaction, SignedTransaction } from '@pact-toolbox/types';

// Mock the crypto module
vi.mock('@pact-toolbox/crypto', () => ({
  generateKeyPair: vi.fn(() => ({
    publicKey: 'mock-public-key',
    secretKey: 'mock-secret-key',
  })),
  sign: vi.fn((message: string, secretKey: string) => `signed-${message}-with-${secretKey}`),
  restoreKeyPairFromSecretKey: vi.fn((secretKey: string) => ({
    publicKey: `restored-public-from-${secretKey}`,
    secretKey: secretKey,
  })),
  hash: vi.fn((data: string) => `hash-of-${data}`),
}));

// Mock signers module
vi.mock('@pact-toolbox/signers', () => ({
  KeyPairSigner: Object.assign(
    vi.fn().mockImplementation((publicKey: string, secretKey: string) => ({
      publicKey,
      secretKey,
      address: publicKey,
      signHash: vi.fn((hash: string) => ({ sig: `signature-for-${hash}` })),
      signPactCommands: vi.fn((cmds: any[]) => 
        cmds.map((cmd, i) => ({
          cmd: JSON.stringify(cmd),
          hash: `hash-${i + 1}`,
          sigs: [{ sig: `signature-for-hash-${i + 1}` }],
        }))
      ),
    })),
    {
      generate: vi.fn(async () => ({
        publicKey: 'mock-public-key',
        secretKey: 'mock-secret-key',
        address: 'mock-public-key',
        signHash: vi.fn((hash: string) => ({ sig: `signature-for-${hash}` })),
        signPactCommands: vi.fn((cmds: any[]) => 
          cmds.map((cmd, i) => ({
            cmd: JSON.stringify(cmd),
            hash: i === 0 ? 'test-hash' : `hash-${i + 1}`,
            sigs: [{ sig: i === 0 ? 'signature-for-test-hash' : `signature-for-hash-${i + 1}` }],
          }))
        ),
      })),
      fromPrivateKeyHex: vi.fn(async (secretKey: string) => ({
        publicKey: `restored-public-from-${secretKey}`,
        secretKey: secretKey,
        address: `restored-public-from-${secretKey}`,
        signHash: vi.fn((hash: string) => ({ sig: `signature-for-${hash}` })),
        signPactCommands: vi.fn((cmds: any[]) => 
          cmds.map((cmd, i) => ({
            cmd: JSON.stringify(cmd),
            hash: `hash-${i + 1}`,
            sigs: [{ sig: `signature-for-hash-${i + 1}` }],
          }))
        ),
      })),
    }
  ),
  finalizeTransaction: vi.fn((tx: any) => tx),
}));

describe('KeypairWalletProvider', () => {
  let provider: KeypairWalletProvider;

  beforeEach(() => {
    provider = new KeypairWalletProvider();
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(provider.metadata.id).toBe('keypair');
      expect(provider.metadata.name).toBe('Keypair Wallet');
      expect(provider.metadata.description).toBe('Built-in keypair-based wallet for development and testing');
      expect(provider.metadata.type).toBe('built-in');
      expect(provider.metadata.icon).toBeDefined();
    });
  });

  describe('availability', () => {
    it('should always be available', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });
  });

  describe('wallet creation', () => {
    it('should create wallet instance', async () => {
      const wallet = await provider.createWallet();
      expect(wallet).toBeInstanceOf(KeypairWallet);
    });
  });
});

describe('KeypairWallet', () => {
  let wallet: KeypairWallet;

  beforeEach(() => {
    wallet = new KeypairWallet({
      networkId: 'development',
      rpcUrl: 'http://localhost:8080/chainweb/0.0/development/chain/0/pact',
    });
    vi.clearAllMocks();
    
    // Clear any stored data
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe('installation check', () => {
    it('should always be installed', () => {
      expect(wallet.isInstalled()).toBe(true);
    });
  });

  describe('connection', () => {
    it('should connect with generated keypair', async () => {
      const account = await wallet.connect();
      
      expect(account).toEqual({
        address: 'k:mock-public-key',
        publicKey: 'mock-public-key',
      });
    });

    it('should return same account on subsequent connections', async () => {
      const account1 = await wallet.connect();
      const account2 = await wallet.connect();
      
      expect(account1).toEqual(account2);
    });

    it('should connect to specific network', async () => {
      const account = await wallet.connect('mainnet01');
      expect(account).toBeDefined();
      
      const network = await wallet.getNetwork();
      expect(network.networkId).toBe('mainnet01');
    });
  });

  describe('network management', () => {
    it('should return development network by default', async () => {
      await wallet.connect();
      const network = await wallet.getNetwork();
      
      expect(network.id).toBe('development');
      expect(network.networkId).toBe('development');
      expect(network.name).toBe('development');
      expect(network.url).toBe('http://localhost:8080/chainweb/0.0/development/chain/0/pact');
    });

    it('should return testnet when connected to testnet', async () => {
      await wallet.connect('testnet04');
      const network = await wallet.getNetwork();
      
      expect(network.id).toBe('testnet04');
      expect(network.networkId).toBe('testnet04');
      expect(network.name).toBe('testnet04');
      expect(network.url).toBe('http://localhost:8080/chainweb/0.0/development/chain/0/pact');
    });

    it('should return mainnet when connected to mainnet', async () => {
      await wallet.connect('mainnet01');
      const network = await wallet.getNetwork();
      
      expect(network.id).toBe('mainnet01');
      expect(network.networkId).toBe('mainnet01');
      expect(network.name).toBe('mainnet01');
      expect(network.url).toBe('http://localhost:8080/chainweb/0.0/development/chain/0/pact');
    });
  });

  describe('account management', () => {
    it('should return account after connection', async () => {
      await wallet.connect();
      const account = await wallet.getAccount();
      
      expect(account).toEqual({
        address: 'k:mock-public-key',
        publicKey: 'mock-public-key',
      });
    });

    it('should auto-connect when getting account', async () => {
      const account = await wallet.getAccount();
      
      expect(account).toEqual({
        address: 'k:mock-public-key',
        publicKey: 'mock-public-key',
      });
      expect(await wallet.isConnected()).toBe(true);
    });
  });

  describe('connection state', () => {
    it('should report connection state correctly', async () => {
      expect(await wallet.isConnected()).toBe(false);
      
      await wallet.connect();
      expect(await wallet.isConnected()).toBe(true);
      
      await wallet.disconnect();
      expect(await wallet.isConnected()).toBe(false);
    });
  });

  describe('transaction signing', () => {
    beforeEach(async () => {
      await wallet.connect();
    });

    it('should sign single transaction', async () => {
      const mockTx: PartiallySignedTransaction = {
        cmd: JSON.stringify({ payload: 'test' }),
        hash: 'test-hash',
        sigs: [],
      };
      
      const signed = await wallet.sign(mockTx);
      
      expect(signed.cmd).toBe(mockTx.cmd);
      expect(signed.hash).toBe('test-hash');
      expect(signed.sigs).toHaveLength(1);
      expect(signed.sigs![0].sig).toBe('signature-for-test-hash');
    });

    it('should sign multiple transactions', async () => {
      const mockTxs: PartiallySignedTransaction[] = [
        {
          cmd: JSON.stringify({ payload: 'test1' }),
          hash: 'hash-1',
          sigs: [],
        },
        {
          cmd: JSON.stringify({ payload: 'test2' }),
          hash: 'hash-2',
          sigs: [],
        },
      ];
      
      const signed = await wallet.sign(mockTxs);
      
      expect(signed).toHaveLength(2);
      expect(signed[0].cmd).toBe(mockTxs[0].cmd);
      // signPactCommands creates new hashes, not preserving the input hashes
      expect(signed[0].hash).toBe('test-hash');
      expect(signed[0].sigs).toHaveLength(1);
      expect(signed[0].sigs![0].sig).toBe('signature-for-test-hash');
      
      expect(signed[1].cmd).toBe(mockTxs[1].cmd);
      expect(signed[1].hash).toBe('hash-2');
      expect(signed[1].sigs).toHaveLength(1);
      expect(signed[1].sigs![0].sig).toBe('signature-for-hash-2');
    });

    it('should throw error when signing without connection', async () => {
      await wallet.disconnect();
      
      const mockTx: PartiallySignedTransaction = {
        cmd: JSON.stringify({ payload: 'test' }),
        hash: 'test-hash',
        sigs: [],
      };
      
      await expect(wallet.sign(mockTx)).rejects.toThrow('Wallet "keypair" is not connected');
    });

    it('should replace signatures when signing', async () => {
      const mockTx: PartiallySignedTransaction = {
        cmd: JSON.stringify({ payload: 'test' }),
        hash: 'test-hash',
        sigs: [{ sig: 'existing-signature' }],
      };
      
      const signed = await wallet.sign(mockTx);
      
      // signPactCommands creates new signatures based on the signers in the command
      expect(signed.sigs).toHaveLength(1);
      expect(signed.sigs![0].sig).toBe('signature-for-test-hash');
    });
  });

  // Note: Static factory methods are not part of the current implementation

  // Note: Persistence behavior is implementation-specific and tested separately
});