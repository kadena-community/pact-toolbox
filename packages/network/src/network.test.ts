import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createPactToolboxNetwork,
  PactServerNetwork,
  LocalDevNetNetwork,
  ToolboxNetworkApi
} from './index';
import { 
  createPactServerNetworkConfig,
  createDevNetNetworkConfig,
  createChainwebNetworkConfig,
  PactToolboxConfig
} from '@pact-toolbox/config';
import { PactToolboxClient } from '@pact-toolbox/runtime';

// Mock dependencies
vi.mock('@pact-toolbox/runtime');
vi.mock('@pact-toolbox/process-manager');
vi.mock('@pact-toolbox/utils');

describe('@pact-toolbox/network', () => {
  let mockClient: PactToolboxClient;
  let mockLogger: any;
  let mockSpinner: any;

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      execute: vi.fn(),
      deployContract: vi.fn(),
      local: vi.fn()
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockSpinner = {
      start: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      stop: vi.fn()
    };

    vi.clearAllMocks();
  });

  describe('createPactToolboxNetwork', () => {
    test('creates PactServerNetwork for pact-server config', async () => {
      const config: PactToolboxConfig = {
        network: createPactServerNetworkConfig({ port: 8080 })
      };

      const { network, client } = await createPactToolboxNetwork(config);
      
      expect(network).toBeInstanceOf(PactServerNetwork);
      expect(client).toBeDefined();
    });

    test('creates LocalDevNetNetwork for devnet config', async () => {
      const config: PactToolboxConfig = {
        network: createDevNetNetworkConfig({
          containerConfig: { port: 8080 }
        })
      };

      const { network, client } = await createPactToolboxNetwork(config);
      
      expect(network).toBeInstanceOf(LocalDevNetNetwork);
      expect(client).toBeDefined();
    });

    test('throws error for chainweb network', async () => {
      const config: PactToolboxConfig = {
        network: createChainwebNetworkConfig({
          apiUrl: 'https://api.chainweb.com',
          networkId: 'mainnet01'
        })
      };

      await expect(createPactToolboxNetwork(config)).rejects.toThrow(
        'Network creation not available for chainweb networks'
      );
    });

    test('uses custom client if provided', async () => {
      const customClient = new PactToolboxClient({} as any);
      const config: PactToolboxConfig = {
        network: createPactServerNetworkConfig({})
      };

      const { client } = await createPactToolboxNetwork(config, {
        client: customClient
      });
      
      expect(client).toBe(customClient);
    });

    test('auto-starts network if configured', async () => {
      const config: PactToolboxConfig = {
        network: createPactServerNetworkConfig({})
      };

      const { network } = await createPactToolboxNetwork(config, {
        autoStart: true
      });

      expect(network.start).toHaveBeenCalled();
    });
  });

  describe('PactServerNetwork', () => {
    let network: PactServerNetwork;
    let networkConfig: any;

    beforeEach(() => {
      networkConfig = createPactServerNetworkConfig({
        port: 8080,
        logLevel: 'info'
      });

      network = new PactServerNetwork(networkConfig, {
        client: mockClient,
        logger: mockLogger,
        spinner: mockSpinner
      });
    });

    test('starts pact server process', async () => {
      const mockProcess = {
        on: vi.fn(),
        kill: vi.fn()
      };

      vi.mocked(network['processManager'].start).mockResolvedValue(mockProcess);

      await network.start();

      expect(network['processManager'].start).toHaveBeenCalledWith(
        'pact-server',
        expect.objectContaining({
          port: 8080,
          logLevel: 'info'
        })
      );
      expect(network['isRunning']).toBe(true);
    });

    test('stops pact server process', async () => {
      await network.start();
      await network.stop();

      expect(network['processManager'].stop).toHaveBeenCalledWith('pact-server');
      expect(network['isRunning']).toBe(false);
    });

    test('restarts network', async () => {
      await network.start();
      await network.restart();

      expect(network['processManager'].stop).toHaveBeenCalled();
      expect(network['processManager'].start).toHaveBeenCalledTimes(2);
    });

    test('checks health status', async () => {
      // Not running
      expect(await network.isOk()).toBe(false);

      // Start network
      await network.start();
      
      // Mock health check
      mockClient.local.mockResolvedValue({ result: { status: 'success' } });
      
      expect(await network.isOk()).toBe(true);
    });

    test('returns correct service URLs', () => {
      expect(network.getServicePort()).toBe(8080);
      expect(network.getNodeServiceUrl()).toBe('http://localhost:8080');
      expect(network.getMiningClientUrl()).toBe('http://localhost:8080');
    });

    test('handles start options', async () => {
      await network.start({
        isDetached: true,
        conflictStrategy: 'replace'
      });

      expect(network['processManager'].start).toHaveBeenCalledWith(
        'pact-server',
        expect.objectContaining({
          detached: true,
          conflictStrategy: 'replace'
        })
      );
    });

    test('deploys preludes if configured', async () => {
      const configWithPreludes = {
        ...networkConfig,
        preludes: ['kadena/chainweb']
      };

      network = new PactServerNetwork(configWithPreludes, {
        client: mockClient,
        logger: mockLogger,
        spinner: mockSpinner
      });

      // Mock deployPreludes
      const deployPreludesMock = vi.fn();
      vi.mock('@pact-toolbox/prelude', () => ({
        deployPreludes: deployPreludesMock
      }));

      await network.start();

      expect(deployPreludesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preludes: ['kadena/chainweb'],
          client: mockClient
        })
      );
    });
  });

  describe('LocalDevNetNetwork', () => {
    let network: LocalDevNetNetwork;
    let networkConfig: any;

    beforeEach(() => {
      networkConfig = createDevNetNetworkConfig({
        containerConfig: {
          port: 8080,
          onDemandMining: true
        }
      });

      network = new LocalDevNetNetwork(networkConfig, {
        client: mockClient,
        logger: mockLogger,
        spinner: mockSpinner,
        activeProfiles: ['mining']
      });
    });

    test('starts devnet container', async () => {
      const mockContainer = {
        id: 'container-123',
        remove: vi.fn()
      };

      vi.mocked(network['dockerManager'].createContainer).mockResolvedValue(mockContainer);
      vi.mocked(network['dockerManager'].startContainer).mockResolvedValue(undefined);

      await network.start();

      expect(network['dockerManager'].createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining('devnet'),
          image: expect.any(String),
          ports: expect.any(Object)
        })
      );
      expect(network['isRunning']).toBe(true);
    });

    test('stops devnet container', async () => {
      await network.start();
      await network.stop();

      expect(network['dockerManager'].stopContainer).toHaveBeenCalled();
      expect(network['isRunning']).toBe(false);
    });

    test('handles on-demand mining', () => {
      expect(network.hasOnDemandMining()).toBe(true);
    });

    test('returns correct mining URL', () => {
      expect(network.getMiningClientUrl()).toBe('http://localhost:8081');
    });

    test('handles stateless mode', async () => {
      await network.start({ isStateless: true });

      expect(network['dockerManager'].createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          volumes: [] // No volume mounts in stateless mode
        })
      );
    });

    test('handles cleanup option', async () => {
      await network.start();
      await network.stop({ cleanup: true });

      expect(network['dockerManager'].removeContainer).toHaveBeenCalled();
    });

    test('waits for network readiness', async () => {
      let healthCheckCount = 0;
      mockClient.local.mockImplementation(async () => {
        healthCheckCount++;
        if (healthCheckCount < 3) {
          throw new Error('Not ready');
        }
        return { result: { status: 'success' } };
      });

      await network.start();

      expect(mockClient.local).toHaveBeenCalledTimes(3);
      expect(network['isRunning']).toBe(true);
    });
  });

  describe('Network Interface Compliance', () => {
    test('all implementations satisfy ToolboxNetworkApi', () => {
      const pactServer = new PactServerNetwork(
        createPactServerNetworkConfig({}),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      const devnet = new LocalDevNetNetwork(
        createDevNetNetworkConfig({}),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      // Test interface methods exist
      const networks: ToolboxNetworkApi[] = [pactServer, devnet];

      networks.forEach(network => {
        expect(network.id).toBeDefined();
        expect(network.start).toBeInstanceOf(Function);
        expect(network.stop).toBeInstanceOf(Function);
        expect(network.restart).toBeInstanceOf(Function);
        expect(network.isOk).toBeInstanceOf(Function);
        expect(network.getServicePort).toBeInstanceOf(Function);
        expect(network.getNodeServiceUrl).toBeInstanceOf(Function);
        expect(network.getMiningClientUrl).toBeInstanceOf(Function);
        expect(network.hasOnDemandMining).toBeInstanceOf(Function);
      });
    });
  });

  describe('Port Management', () => {
    test('uses random port when port is 0', async () => {
      const config: PactToolboxConfig = {
        network: createPactServerNetworkConfig({ port: 0 })
      };

      const { network } = await createPactToolboxNetwork(config);
      const port = network.getServicePort();

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });

    test('handles port conflicts', async () => {
      const network = new PactServerNetwork(
        createPactServerNetworkConfig({ port: 8080 }),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      // Mock port conflict
      vi.mocked(network['processManager'].start)
        .mockRejectedValueOnce(new Error('EADDRINUSE'))
        .mockResolvedValueOnce({} as any);

      await network.start({ conflictStrategy: 'replace' });

      expect(network['processManager'].killProcessOnPort).toHaveBeenCalledWith(8080);
      expect(network['processManager'].start).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('handles network start failures gracefully', async () => {
      const network = new PactServerNetwork(
        createPactServerNetworkConfig({}),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      vi.mocked(network['processManager'].start).mockRejectedValue(
        new Error('Failed to start')
      );

      await expect(network.start()).rejects.toThrow('Failed to start');
      expect(network['isRunning']).toBe(false);
      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    test('handles health check timeouts', async () => {
      const network = new LocalDevNetNetwork(
        createDevNetNetworkConfig({}),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      // Mock health check always failing
      mockClient.local.mockRejectedValue(new Error('Connection refused'));

      await expect(network.start()).rejects.toThrow('Network failed to become healthy');
    });
  });

  describe('Logging', () => {
    test('logs account information when requested', async () => {
      const network = new PactServerNetwork(
        createPactServerNetworkConfig({}),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      await network.start({ logAccounts: true });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Default Accounts')
      );
    });

    test('respects log level configuration', async () => {
      const network = new PactServerNetwork(
        createPactServerNetworkConfig({ logLevel: 'debug' }),
        { client: mockClient, logger: mockLogger, spinner: mockSpinner }
      );

      await network.start();

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});