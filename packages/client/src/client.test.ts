import { describe, test, expect, beforeEach, vi } from 'vitest';
import { 
  PactTransactionBuilder,
  PactTransactionDispatcher,
  EckoWallet,
  ToolboxWallet,
  isTransactionSuccess,
  isTransactionFailure,
  coin
} from './index';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { ICommand } from '@kadena/types';

// Mock dependencies
vi.mock('@pact-toolbox/runtime');
vi.mock('@kadena/client');

describe('@pact-toolbox/client', () => {
  let mockClient: PactToolboxClient;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn(),
      submit: vi.fn(),
      local: vi.fn(),
      listen: vi.fn(),
      pollOne: vi.fn(),
      networkConfig: {
        apiUrl: 'http://localhost:8080',
        networkId: 'development'
      }
    } as any;

    vi.clearAllMocks();
  });

  describe('PactTransactionBuilder', () => {
    test('creates basic transaction', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(coin.details "alice")')
        .setMeta({ chainId: '0', senderAccount: 'alice' });

      const tx = await builder.build();
      
      expect(tx.cmd).toBeDefined();
      const cmd = JSON.parse(tx.cmd);
      expect(cmd.payload.exec.code).toBe('(coin.details "alice")');
      expect(cmd.meta.chainId).toBe('0');
      expect(cmd.meta.sender).toBe('alice');
    });

    test('adds capabilities', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(coin.transfer "alice" "bob" 10.0)')
        .addCapability('coin.TRANSFER', 'alice', 'bob', 10.0);

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.signers).toHaveLength(1);
      expect(cmd.signers[0].clist).toContainEqual({
        name: 'coin.TRANSFER',
        args: ['alice', 'bob', 10.0]
      });
    });

    test('adds signers', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(coin.transfer "alice" "bob" 10.0)')
        .addSigner({
          pubKey: 'alice-public-key',
          scheme: 'ED25519',
          caps: [['coin.TRANSFER', 'alice', 'bob', 10.0]]
        });

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.signers).toHaveLength(1);
      expect(cmd.signers[0].pubKey).toBe('alice-public-key');
      expect(cmd.signers[0].scheme).toBe('ED25519');
    });

    test('adds keysets', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(create-account "new" (read-keyset "ks"))')
        .addKeyset('ks', {
          keys: ['key1', 'key2'],
          pred: 'keys-all'
        });

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.payload.exec.data.ks).toEqual({
        keys: ['key1', 'key2'],
        pred: 'keys-all'
      });
    });

    test('adds data', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(my-module.process data)')
        .addData({ 
          data: { 
            items: ['item1', 'item2'],
            metadata: { version: '1.0' }
          }
        });

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.payload.exec.data.data).toEqual({
        items: ['item1', 'item2'],
        metadata: { version: '1.0' }
      });
    });

    test('sets namespace', async () => {
      const builder = PactTransactionBuilder.create()
        .namespace('my-namespace')
        .code('(my-module.function)');

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.payload.exec.code).toContain('(namespace "my-namespace")');
    });

    test('handles continuation', async () => {
      const builder = PactTransactionBuilder.create()
        .continuation({
          pactId: 'cross-chain-transfer',
          step: 1,
          rollback: false,
          data: { amount: 10.0 }
        });

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.payload.cont).toEqual({
        pactId: 'cross-chain-transfer',
        step: 1,
        rollback: false,
        data: { amount: 10.0 }
      });
    });

    test('executes transaction', async () => {
      mockClient.execute.mockResolvedValue({
        status: 'success',
        data: { balance: 100 }
      });

      const result = await PactTransactionBuilder.create()
        .code('(coin.details "alice")')
        .client(mockClient)
        .execute();

      expect(mockClient.execute).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });

    test('integrates with wallet', async () => {
      const mockWallet = {
        isConnected: () => true,
        sign: vi.fn().mockResolvedValue({
          hash: 'signed-hash',
          sig: 'signature',
          cmd: 'command'
        })
      };

      const builder = PactTransactionBuilder.create()
        .code('(coin.transfer "alice" "bob" 10.0)')
        .wallet(mockWallet as any)
        .client(mockClient);

      await builder.execute();

      expect(mockWallet.sign).toHaveBeenCalled();
      expect(mockClient.execute).toHaveBeenCalled();
    });

    test('validates required fields', async () => {
      const builder = PactTransactionBuilder.create();
      
      await expect(builder.build()).rejects.toThrow();
    });

    test('uses network config', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(coin.details "alice")')
        .networkConfig({
          apiUrl: 'https://api.testnet.chainweb.com',
          networkId: 'testnet04'
        });

      const tx = await builder.build();
      
      expect(builder['networkConfig']).toEqual({
        apiUrl: 'https://api.testnet.chainweb.com',
        networkId: 'testnet04'
      });
    });
  });

  describe('PactTransactionDispatcher', () => {
    let dispatcher: PactTransactionDispatcher;

    beforeEach(() => {
      dispatcher = new PactTransactionDispatcher({
        networkConfig: {
          apiUrl: 'http://localhost:8080',
          networkId: 'development'
        }
      });
    });

    test('submits transaction', async () => {
      const mockRequestKey = 'rk-123';
      mockClient.submit.mockResolvedValue({ requestKeys: [mockRequestKey] });

      const tx = await PactTransactionBuilder.create()
        .code('(coin.details "alice")')
        .build();

      const requestKey = await dispatcher.submit(tx);
      
      expect(requestKey).toBe(mockRequestKey);
    });

    test('polls single transaction', async () => {
      const mockResult = {
        'rk-123': {
          result: { status: 'success', data: { balance: 100 } }
        }
      };
      
      mockClient.pollOne.mockResolvedValue(mockResult);

      const result = await dispatcher.pollOne('rk-123');
      
      expect(result).toEqual(mockResult['rk-123']);
    });

    test('polls multiple transactions', async () => {
      const mockResults = {
        'rk-123': { result: { status: 'success' } },
        'rk-456': { result: { status: 'success' } }
      };
      
      mockClient.pollMany.mockResolvedValue(mockResults);

      const results = await dispatcher.pollMany(['rk-123', 'rk-456']);
      
      expect(results).toEqual(mockResults);
    });

    test('handles poll timeout', async () => {
      mockClient.pollOne.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {};
      });

      await expect(dispatcher.pollOne('rk-123', {
        timeout: 50,
        interval: 10
      })).rejects.toThrow('Polling timeout');
    });

    test('gets transaction status', async () => {
      const mockStatus = {
        'rk-123': { result: { status: 'pending' } }
      };
      
      mockClient.listen.mockResolvedValue(mockStatus);

      const status = await dispatcher.getStatus('rk-123');
      
      expect(status).toEqual(mockStatus['rk-123']);
    });
  });

  describe('Wallets', () => {
    describe('ToolboxWallet', () => {
      test('creates wallet with account info', () => {
        const wallet = new ToolboxWallet({
          account: 'sender00',
          keys: {
            public: 'public-key',
            secret: 'secret-key'
          }
        });

        expect(wallet.isInstalled()).toBe(true);
        expect(wallet.isConnected()).toBe(true);
      });

      test('returns accounts', async () => {
        const wallet = new ToolboxWallet({
          account: 'sender00',
          keys: {
            public: 'public-key',
            secret: 'secret-key'
          }
        });

        const accounts = await wallet.getAccounts();
        
        expect(accounts).toHaveLength(1);
        expect(accounts[0]).toEqual({
          account: 'sender00',
          publicKey: 'public-key',
          chains: expect.any(Array)
        });
      });

      test('signs transaction', async () => {
        const wallet = new ToolboxWallet({
          account: 'sender00',
          keys: {
            public: 'public-key',
            secret: 'secret-key'
          }
        });

        const tx = { cmd: JSON.stringify({ test: true }) };
        const signed = await wallet.sign(tx);
        
        expect(signed.sigs).toBeDefined();
        expect(signed.sigs).toHaveLength(1);
      });
    });

    describe('EckoWallet', () => {
      test('checks installation', () => {
        // Mock window.kadena
        global.window = { kadena: { isKadena: true } } as any;

        const wallet = new EckoWallet();
        expect(wallet.isInstalled()).toBe(true);
      });

      test('connects to wallet', async () => {
        const mockKadena = {
          isKadena: true,
          request: vi.fn().mockResolvedValue({ status: 'success' })
        };
        
        global.window = { kadena: mockKadena } as any;

        const wallet = new EckoWallet();
        await wallet.connect();
        
        expect(mockKadena.request).toHaveBeenCalledWith({
          method: 'kda_connect',
          networkId: expect.any(String)
        });
        expect(wallet.isConnected()).toBe(true);
      });

      test('gets accounts', async () => {
        const mockAccounts = [{
          account: 'k:alice',
          publicKey: 'alice-key',
          connectedSites: ['site1']
        }];

        const mockKadena = {
          isKadena: true,
          request: vi.fn()
            .mockResolvedValueOnce({ status: 'success' }) // connect
            .mockResolvedValueOnce({ accounts: mockAccounts }) // getAccounts
        };
        
        global.window = { kadena: mockKadena } as any;

        const wallet = new EckoWallet();
        await wallet.connect();
        const accounts = await wallet.getAccounts();
        
        expect(accounts).toEqual([{
          account: 'k:alice',
          publicKey: 'alice-key',
          chains: expect.any(Array)
        }]);
      });

      test('signs transaction', async () => {
        const mockSignedTx = {
          body: { cmd: 'signed-cmd', hash: 'tx-hash', sigs: [{}] }
        };

        const mockKadena = {
          isKadena: true,
          request: vi.fn()
            .mockResolvedValueOnce({ status: 'success' }) // connect
            .mockResolvedValueOnce(mockSignedTx) // sign
        };
        
        global.window = { kadena: mockKadena } as any;

        const wallet = new EckoWallet();
        await wallet.connect();
        
        const tx = { cmd: JSON.stringify({ test: true }) };
        const signed = await wallet.sign(tx);
        
        expect(signed).toEqual(mockSignedTx.body);
      });
    });
  });

  describe('Type Guards', () => {
    test('isTransactionSuccess identifies success', () => {
      const success = { status: 'success', data: {} };
      const failure = { status: 'failure', error: 'error' };
      
      expect(isTransactionSuccess(success)).toBe(true);
      expect(isTransactionSuccess(failure)).toBe(false);
    });

    test('isTransactionFailure identifies failure', () => {
      const success = { status: 'success', data: {} };
      const failure = { status: 'failure', error: 'error' };
      
      expect(isTransactionFailure(success)).toBe(false);
      expect(isTransactionFailure(failure)).toBe(true);
    });
  });

  describe('Coin Module Helpers', () => {
    beforeEach(() => {
      mockClient.execute.mockResolvedValue({
        status: 'success',
        data: { balance: 100.0 }
      });
    });

    test('gets account details', async () => {
      mockClient.execute.mockResolvedValue({
        status: 'success',
        data: {
          account: 'alice',
          balance: 100.0,
          guard: { keys: ['alice-key'], pred: 'keys-all' }
        }
      });

      const details = await coin.details('alice', { client: mockClient });
      
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('coin.details')
      );
      expect(details.account).toBe('alice');
      expect(details.balance).toBe(100.0);
    });

    test('transfers tokens', async () => {
      const mockWallet = {
        isConnected: () => true,
        sign: vi.fn().mockResolvedValue({ sigs: [{}] }),
        getAccounts: vi.fn().mockResolvedValue([{
          account: 'alice',
          publicKey: 'alice-key'
        }])
      };

      await coin.transfer({
        from: 'alice',
        to: 'bob',
        amount: 10.0,
        signer: mockWallet as any,
        client: mockClient
      });

      expect(mockClient.execute).toHaveBeenCalled();
      expect(mockWallet.sign).toHaveBeenCalled();
    });

    test('creates account', async () => {
      await coin.createAccount({
        account: 'charlie',
        guard: {
          keys: ['charlie-key'],
          pred: 'keys-all'
        },
        client: mockClient
      });

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('coin.create-account')
      );
    });

    test('gets balance', async () => {
      const balance = await coin.getBalance('alice', { client: mockClient });
      
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('coin.get-balance')
      );
      expect(balance).toBe(100.0);
    });
  });

  describe('Error Handling', () => {
    test('handles wallet not connected', async () => {
      const mockWallet = {
        isConnected: () => false,
        connect: vi.fn()
      };

      const builder = PactTransactionBuilder.create()
        .code('(coin.transfer "alice" "bob" 10.0)')
        .wallet(mockWallet as any);

      await expect(builder.execute()).rejects.toThrow('Wallet not connected');
    });

    test('handles transaction failure', async () => {
      mockClient.execute.mockResolvedValue({
        status: 'failure',
        error: { message: 'Insufficient funds' }
      });

      const result = await PactTransactionBuilder.create()
        .code('(coin.transfer "alice" "bob" 1000000.0)')
        .client(mockClient)
        .execute();

      expect(isTransactionFailure(result)).toBe(true);
      expect(result.error.message).toBe('Insufficient funds');
    });

    test('handles network errors', async () => {
      mockClient.execute.mockRejectedValue(new Error('Network error'));

      await expect(
        PactTransactionBuilder.create()
          .code('(coin.details "alice")')
          .client(mockClient)
          .execute()
      ).rejects.toThrow('Network error');
    });
  });

  describe('Complex Scenarios', () => {
    test('builds multi-signer transaction', async () => {
      const builder = PactTransactionBuilder.create()
        .code('(my-module.multi-sig-operation)')
        .addSigner({
          pubKey: 'alice-key',
          caps: [['my-module.OPERATE']]
        })
        .addSigner({
          pubKey: 'bob-key',
          caps: [['my-module.APPROVE']]
        })
        .addCapability('my-module.OPERATE')
        .addCapability('my-module.APPROVE');

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.signers).toHaveLength(2);
      expect(cmd.signers[0].pubKey).toBe('alice-key');
      expect(cmd.signers[1].pubKey).toBe('bob-key');
    });

    test('chains multiple operations', async () => {
      const builder = PactTransactionBuilder.create()
        .namespace('free')
        .code('(my-module.function)')
        .addCapability('my-module.CAP', 'arg1')
        .addKeyset('admin', { keys: ['admin-key'], pred: 'keys-all' })
        .addData({ config: { timeout: 30 } })
        .setMeta({
          chainId: '0',
          senderAccount: 'gas-payer',
          gasLimit: 10000,
          gasPrice: 0.00001,
          ttl: 600
        });

      const tx = await builder.build();
      const cmd = JSON.parse(tx.cmd);
      
      expect(cmd.payload.exec.code).toContain('namespace "free"');
      expect(cmd.payload.exec.data.admin).toBeDefined();
      expect(cmd.payload.exec.data.config).toBeDefined();
      expect(cmd.meta.gasLimit).toBe(10000);
    });
  });
});