import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PactToolboxClient,
  createMockClient,
  PactToolboxConfig,
  NetworkConfig
} from './index';
import { PactTransactionBuilder, PactTransactionDispatcher } from '@pact-toolbox/client';
import { generateKeyPairSigner } from '@pact-toolbox/signer';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('@pact-toolbox/client');
vi.mock('@pact-toolbox/signer');
vi.mock('fs/promises');

describe('@pact-toolbox/runtime', () => {
  let mockConfig: PactToolboxConfig;
  let mockDispatcher: any;
  let mockBuilder: any;

  beforeEach(() => {
    // Setup default config
    mockConfig = {
      contractsDir: './contracts',
      scriptsDir: './scripts',
      preludesDir: './preludes',
      network: {
        type: 'devnet',
        name: 'local-devnet',
        devnet: {
          url: 'http://localhost:8080',
          chainIds: ['0', '1', '2', '3']
        }
      }
    };

    // Setup mock dispatcher
    mockDispatcher = {
      submit: vi.fn().mockResolvedValue('request-key-123'),
      submitAndListen: vi.fn().mockResolvedValue({ 
        result: { status: 'success', data: {} } 
      }),
      local: vi.fn().mockResolvedValue({ 
        result: { status: 'success', data: {} } 
      }),
      dirtyRead: vi.fn().mockResolvedValue({ 
        result: { status: 'success', data: {} } 
      }),
      pollOne: vi.fn(),
      pollMany: vi.fn(),
      getStatus: vi.fn()
    };

    // Setup mock builder
    mockBuilder = {
      code: vi.fn().mockReturnThis(),
      setMeta: vi.fn().mockReturnThis(),
      addSigner: vi.fn().mockReturnThis(),
      addCapability: vi.fn().mockReturnThis(),
      addKeyset: vi.fn().mockReturnThis(),
      addData: vi.fn().mockReturnThis(),
      namespace: vi.fn().mockReturnThis(),
      continuation: vi.fn().mockReturnThis(),
      networkConfig: vi.fn().mockReturnThis(),
      client: vi.fn().mockReturnThis(),
      build: vi.fn().mockResolvedValue({ cmd: '{}', hash: 'hash', sigs: [] }),
      execute: vi.fn().mockResolvedValue({ status: 'success' })
    };

    vi.mocked(PactTransactionDispatcher).mockImplementation(() => mockDispatcher);
    vi.mocked(PactTransactionBuilder.create).mockReturnValue(mockBuilder);

    vi.clearAllMocks();
  });

  describe('PactToolboxClient Construction', () => {
    test('creates client with basic config', () => {
      const client = new PactToolboxClient(mockConfig);

      expect(client).toBeDefined();
      expect(client.config).toBe(mockConfig);
    });

    test('initializes dispatcher with network config', () => {
      const client = new PactToolboxClient(mockConfig);

      expect(PactTransactionDispatcher).toHaveBeenCalledWith({
        networkConfig: expect.objectContaining({
          apiUrl: 'http://localhost:8080',
          networkId: expect.any(String)
        })
      });
    });

    test('handles different network types', () => {
      // Pact Server
      const pactServerConfig: PactToolboxConfig = {
        network: {
          type: 'pact-server',
          name: 'local',
          pactServer: { url: 'http://localhost:9001' }
        }
      };
      
      new PactToolboxClient(pactServerConfig);
      expect(PactTransactionDispatcher).toHaveBeenCalledWith({
        networkConfig: expect.objectContaining({
          apiUrl: 'http://localhost:9001'
        })
      });

      // Chainweb
      const chainwebConfig: PactToolboxConfig = {
        network: {
          type: 'chainweb',
          name: 'testnet',
          chainweb: {
            networkId: 'testnet04',
            apiHost: 'https://api.testnet.chainweb.com',
            chainIds: ['0', '1']
          }
        }
      };

      new PactToolboxClient(chainwebConfig);
      expect(PactTransactionDispatcher).toHaveBeenCalledWith({
        networkConfig: expect.objectContaining({
          apiUrl: 'https://api.testnet.chainweb.com',
          networkId: 'testnet04'
        })
      });
    });

    test('loads signer from environment variables', () => {
      process.env.PACT_TOOLBOX_PUBLIC_KEY = 'public-key';
      process.env.PACT_TOOLBOX_SECRET_KEY = 'secret-key';

      const client = new PactToolboxClient(mockConfig);
      const signer = client.getSigner();

      expect(signer).toEqual({
        public: 'public-key',
        secret: 'secret-key'
      });

      delete process.env.PACT_TOOLBOX_PUBLIC_KEY;
      delete process.env.PACT_TOOLBOX_SECRET_KEY;
    });

    test('uses signers from config', () => {
      const configWithSigners: PactToolboxConfig = {
        ...mockConfig,
        signers: [{
          public: 'config-public',
          secret: 'config-secret'
        }]
      };

      const client = new PactToolboxClient(configWithSigners);
      const signer = client.getSigner();

      expect(signer).toEqual({
        public: 'config-public',
        secret: 'config-secret'
      });
    });
  });

  describe('Contract Deployment', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
      vi.mocked(fs.readFile).mockResolvedValue('(module test ...)');
      vi.mocked(fs.access).mockResolvedValue(undefined);
    });

    test('deployContract loads and deploys file', async () => {
      const result = await client.deployContract('token.pact');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('./contracts', 'token.pact'),
        'utf-8'
      );
      expect(mockBuilder.code).toHaveBeenCalledWith('(module test ...)');
      expect(mockDispatcher.submitAndListen).toHaveBeenCalled();
    });

    test('deployContract handles .pact extension', async () => {
      await client.deployContract('token');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('./contracts', 'token.pact'),
        'utf-8'
      );
    });

    test('deployContract with custom options', async () => {
      await client.deployContract('token.pact', {
        chainIds: ['0', '1'],
        preflight: false,
        signatureVerification: false,
        listen: false,
        meta: {
          gasLimit: 100000,
          gasPrice: 0.00001
        }
      });

      expect(mockBuilder.setMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          gasLimit: 100000,
          gasPrice: 0.00001
        })
      );
      expect(mockDispatcher.submit).toHaveBeenCalled();
      expect(mockDispatcher.submitAndListen).not.toHaveBeenCalled();
    });

    test('deployContracts deploys multiple files', async () => {
      const contracts = ['token.pact', 'exchange.pact', 'governance.pact'];
      
      await client.deployContracts(contracts);

      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(mockDispatcher.submitAndListen).toHaveBeenCalledTimes(3);
    });

    test('deployCode deploys raw code', async () => {
      const code = '(module direct-deploy ...)';
      
      await client.deployCode(code);

      expect(mockBuilder.code).toHaveBeenCalledWith(code);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    test('handles deployment errors', async () => {
      mockDispatcher.submitAndListen.mockRejectedValue(new Error('Network error'));

      await expect(client.deployContract('failing.pact'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Transaction Building', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('execution creates transaction builder', () => {
      const builder = client.execution('(coin.details "alice")');

      expect(PactTransactionBuilder.create).toHaveBeenCalled();
      expect(mockBuilder.code).toHaveBeenCalledWith('(coin.details "alice")');
      expect(builder).toBe(mockBuilder);
    });

    test('execution with data', () => {
      client.execution('(coin.transfer "alice" "bob" amount)')
        .addData({ amount: 10.0 });

      expect(mockBuilder.addData).toHaveBeenCalledWith({ amount: 10.0 });
    });

    test('chainable builder methods', () => {
      const result = client.execution('(my-module.function)')
        .setMeta({ chainId: '0' })
        .addSigner({ pubKey: 'key' })
        .addCapability('my-module.CAP')
        .addKeyset('ks', { keys: ['key'], pred: 'keys-all' })
        .addData({ value: 42 });

      expect(result).toBe(mockBuilder);
      expect(mockBuilder.setMeta).toHaveBeenCalled();
      expect(mockBuilder.addSigner).toHaveBeenCalled();
      expect(mockBuilder.addCapability).toHaveBeenCalled();
      expect(mockBuilder.addKeyset).toHaveBeenCalled();
      expect(mockBuilder.addData).toHaveBeenCalled();
    });
  });

  describe('Transaction Execution', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('submit sends transaction', async () => {
      const requestKey = await client.submit({ 
        cmd: '{}', 
        hash: 'hash', 
        sigs: [] 
      });

      expect(requestKey).toBe('request-key-123');
      expect(mockDispatcher.submit).toHaveBeenCalled();
    });

    test('submitAndListen waits for result', async () => {
      const result = await client.submitAndListen({ 
        cmd: '{}', 
        hash: 'hash', 
        sigs: [] 
      });

      expect(result).toEqual({ 
        result: { status: 'success', data: {} } 
      });
      expect(mockDispatcher.submitAndListen).toHaveBeenCalled();
    });

    test('local executes locally', async () => {
      const result = await client.local('(+ 1 1)');

      expect(result).toEqual({ 
        result: { status: 'success', data: {} } 
      });
      expect(mockDispatcher.local).toHaveBeenCalled();
    });

    test('dirtyRead performs fast read', async () => {
      mockDispatcher.dirtyRead.mockResolvedValue(42);
      
      const result = await client.dirtyRead('(coin.get-balance "alice")');

      expect(result).toBe(42);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });
  });

  describe('Module Management', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('listModules returns module list', async () => {
      mockDispatcher.dirtyRead.mockResolvedValue(['coin', 'my-module']);

      const modules = await client.listModules();

      expect(modules).toEqual(['coin', 'my-module']);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalledWith(
        '(list-modules)'
      );
    });

    test('describeModule returns module info', async () => {
      const moduleInfo = {
        name: 'coin',
        hash: 'module-hash',
        interfaces: ['fungible-v2']
      };
      mockDispatcher.dirtyRead.mockResolvedValue(moduleInfo);

      const result = await client.describeModule('coin');

      expect(result).toEqual(moduleInfo);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalledWith(
        '(describe-module "coin")'
      );
    });

    test('isContractDeployed checks deployment', async () => {
      mockDispatcher.local.mockResolvedValueOnce({
        result: { status: 'success', data: { module: 'my-module' } }
      });

      const deployed = await client.isContractDeployed('my-module');

      expect(deployed).toBe(true);
      expect(mockDispatcher.local).toHaveBeenCalledWith(
        '(describe-module "my-module")'
      );
    });

    test('isContractDeployed returns false on error', async () => {
      mockDispatcher.local.mockRejectedValue(new Error('Module not found'));

      const deployed = await client.isContractDeployed('missing-module');

      expect(deployed).toBe(false);
    });
  });

  describe('Namespace Management', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('describeNamespace returns namespace info', async () => {
      const nsInfo = {
        namespace: 'free',
        guard: { keys: ['admin-key'], pred: 'keys-all' }
      };
      mockDispatcher.dirtyRead.mockResolvedValue(nsInfo);

      const result = await client.describeNamespace('free');

      expect(result).toEqual(nsInfo);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalledWith(
        '(describe-namespace "free")'
      );
    });

    test('isNamespaceDefined checks namespace', async () => {
      mockDispatcher.local.mockResolvedValueOnce({
        result: { status: 'success' }
      });

      const defined = await client.isNamespaceDefined('my-namespace');

      expect(defined).toBe(true);
    });
  });

  describe('File Management', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('getContractCode loads from contracts dir', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('(module code ...)');

      const code = await client.getContractCode('token.pact');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('./contracts', 'token.pact'),
        'utf-8'
      );
      expect(code).toBe('(module code ...)');
    });

    test('getContractCode handles absolute paths', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('(module abs ...)');

      const code = await client.getContractCode('/absolute/path/token.pact');

      expect(fs.readFile).toHaveBeenCalledWith(
        '/absolute/path/token.pact',
        'utf-8'
      );
    });

    test('getContractCode auto-adds .pact extension', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('Not found'));
      vi.mocked(fs.readFile).mockResolvedValue('(module ext ...)');

      const code = await client.getContractCode('token');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('./contracts', 'token.pact'),
        'utf-8'
      );
    });
  });

  describe('Multi-Chain Operations', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('executes on specific chains', async () => {
      const chainIds = ['0', '1'];
      
      await client.deployContract('multi-chain.pact', { chainIds });

      // Verify meta was set for each chain
      const metaCalls = mockBuilder.setMeta.mock.calls;
      expect(metaCalls.some(call => call[0].chainId === '0')).toBe(true);
      expect(metaCalls.some(call => call[0].chainId === '1')).toBe(true);
    });

    test('executes on all chains', async () => {
      const allChainIds = ['0', '1', '2', '3'];
      
      await client.deployContract('all-chains.pact', { 
        chainIds: allChainIds 
      });

      expect(mockBuilder.setMeta).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Handling', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test('handles file not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await expect(client.deployContract('missing.pact'))
        .rejects.toThrow('ENOENT');
    });

    test('handles network errors', async () => {
      mockDispatcher.submitAndListen.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(client.execution('(test)').submitAndListen())
        .rejects.toThrow('Network timeout');
    });

    test('handles invalid code', async () => {
      mockDispatcher.local.mockResolvedValue({
        result: { 
          status: 'failure', 
          error: { 
            message: 'Syntax error',
            type: 'SyntaxError'
          }
        }
      });

      const result = await client.local('(invalid');
      
      expect(result.result.status).toBe('failure');
      expect(result.result.error.message).toBe('Syntax error');
    });
  });

  describe('Mock Client', () => {
    test('creates basic mock client', () => {
      const mockClient = createMockClient();

      expect(mockClient.execute).toBeDefined();
      expect(mockClient.deployContract).toBeDefined();
      expect(mockClient.isContractDeployed).toBeDefined();
      expect(mockClient.listModules).toBeDefined();
    });

    test('mock client with custom responses', () => {
      const mockClient = createMockClient({
        modules: ['coin', 'test-module'],
        responses: {
          '(coin.get-balance "alice")': 1000,
          '(test-module.get-value)': { value: 42 }
        }
      });

      expect(mockClient.modules).toEqual(['coin', 'test-module']);
      expect(mockClient.responses['(coin.get-balance "alice")']).toBe(1000);
    });

    test('mock client methods return expected values', async () => {
      const mockClient = createMockClient({
        modules: ['test'],
        responses: {
          '(test.function)': 'result'
        }
      });

      const modules = await mockClient.listModules();
      expect(modules).toEqual(['test']);

      const deployed = await mockClient.isContractDeployed('test');
      expect(deployed).toBe(true);

      const notDeployed = await mockClient.isContractDeployed('missing');
      expect(notDeployed).toBe(false);
    });
  });

  describe('Integration Patterns', () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
      vi.mocked(fs.readFile).mockResolvedValue('(module test ...)');
    });

    test('deploy and verify pattern', async () => {
      // Deploy
      await client.deployContract('my-module.pact');

      // Verify deployment
      mockDispatcher.local.mockResolvedValue({
        result: { status: 'success', data: { module: 'my-module' } }
      });
      
      const deployed = await client.isContractDeployed('my-module');
      expect(deployed).toBe(true);

      // Execute function
      const result = await client.execution('(my-module.init)')
        .submitAndListen();
      
      expect(result.result.status).toBe('success');
    });

    test('batch operations pattern', async () => {
      const operations = [
        '(coin.create-account "alice" (read-keyset "alice-ks"))',
        '(coin.create-account "bob" (read-keyset "bob-ks"))',
        '(coin.transfer "treasury" "alice" 1000.0)',
        '(coin.transfer "treasury" "bob" 1000.0)'
      ];

      const results = await Promise.all(
        operations.map(op => 
          client.execution(op)
            .addData({
              'alice-ks': { keys: ['alice-key'], pred: 'keys-all' },
              'bob-ks': { keys: ['bob-key'], pred: 'keys-all' }
            })
            .submitAndListen()
        )
      );

      expect(results).toHaveLength(4);
      expect(mockDispatcher.submitAndListen).toHaveBeenCalledTimes(4);
    });
  });
});