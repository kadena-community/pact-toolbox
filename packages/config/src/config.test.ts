import { describe, test, expect, beforeEach, vi } from 'vitest';
import { 
  resolveConfig, 
  defineConfig, 
  getNetworkConfig,
  isLocalNetwork,
  isDevNetwork,
  isPactServerNetwork,
  isChainwebNetwork,
  createPactServerNetworkConfig,
  createDevNetNetworkConfig,
  createChainwebNetworkConfig,
  getSerializableNetworkConfig,
  defaultKeyPairs,
  defaultKeysets,
  defaultMeta,
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE,
  DEFAULT_TTL
} from './index';

describe('@pact-toolbox/config', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.PACT_NETWORK;
    delete process.env.PACT_CONTRACTS_DIR;
    vi.clearAllMocks();
  });

  describe('defineConfig', () => {
    test('should return the same config object', () => {
      const config = {
        contractsDir: './contracts',
        network: {
          type: 'devnet' as const,
          name: 'test-devnet',
          devnet: {
            containerConfig: {
              port: 8080
            }
          }
        }
      };
      
      const result = defineConfig(config);
      expect(result).toBe(config);
    });
  });

  describe('Network Configuration Factories', () => {
    test('createPactServerNetworkConfig creates valid config', () => {
      const config = createPactServerNetworkConfig({
        port: 8081,
        execConfig: {
          gasLimit: 50000,
          gasPrice: 0.000001,
          ttl: 300,
          senderAccount: 'test-sender'
        }
      });

      expect(config).toEqual({
        type: 'pact-server',
        name: 'pact-server',
        pactServer: expect.objectContaining({
          port: 8081,
          execConfig: expect.objectContaining({
            gasLimit: 50000,
            gasPrice: 0.000001,
            ttl: 300,
            senderAccount: 'test-sender'
          })
        })
      });
    });

    test('createDevNetNetworkConfig creates valid config', () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          port: 8082,
          onDemandMining: true,
          persistDb: false
        },
        miningConfig: {
          onDemandMining: true,
          interval: 60,
          batchSize: 5
        }
      });

      expect(config).toEqual({
        type: 'devnet',
        name: 'devnet',
        devnet: expect.objectContaining({
          containerConfig: expect.objectContaining({
            port: 8082,
            onDemandMining: true,
            persistDb: false
          }),
          miningConfig: expect.objectContaining({
            onDemandMining: true,
            interval: 60,
            batchSize: 5
          })
        })
      });
    });

    test('createChainwebNetworkConfig creates valid config', () => {
      const config = createChainwebNetworkConfig({
        apiUrl: 'https://api.testnet.chainweb.com',
        networkId: 'testnet04',
        chainIds: ['0', '1', '2']
      });

      expect(config).toEqual({
        type: 'chainweb',
        name: 'chainweb',
        chainweb: {
          apiUrl: 'https://api.testnet.chainweb.com',
          networkId: 'testnet04',
          chainIds: ['0', '1', '2']
        }
      });
    });
  });

  describe('Network Type Guards', () => {
    const pactServerConfig = createPactServerNetworkConfig({});
    const devnetConfig = createDevNetNetworkConfig({});
    const chainwebConfig = createChainwebNetworkConfig({
      apiUrl: 'https://api.chainweb.com',
      networkId: 'mainnet01'
    });

    test('isLocalNetwork correctly identifies local networks', () => {
      expect(isLocalNetwork(pactServerConfig)).toBe(true);
      expect(isLocalNetwork(devnetConfig)).toBe(true);
      expect(isLocalNetwork(chainwebConfig)).toBe(false);
    });

    test('isDevNetwork correctly identifies devnet', () => {
      expect(isDevNetwork(pactServerConfig)).toBe(false);
      expect(isDevNetwork(devnetConfig)).toBe(true);
      expect(isDevNetwork(chainwebConfig)).toBe(false);
    });

    test('isPactServerNetwork correctly identifies pact server', () => {
      expect(isPactServerNetwork(pactServerConfig)).toBe(true);
      expect(isPactServerNetwork(devnetConfig)).toBe(false);
      expect(isPactServerNetwork(chainwebConfig)).toBe(false);
    });

    test('isChainwebNetwork correctly identifies chainweb', () => {
      expect(isChainwebNetwork(pactServerConfig)).toBe(false);
      expect(isChainwebNetwork(devnetConfig)).toBe(false);
      expect(isChainwebNetwork(chainwebConfig)).toBe(true);
    });
  });

  describe('getNetworkConfig', () => {
    test('returns active network from network property', () => {
      const network = createDevNetNetworkConfig({});
      const config = {
        network,
        networks: {
          other: createPactServerNetworkConfig({})
        }
      };

      const result = getNetworkConfig(config);
      expect(result).toBe(network);
    });

    test('returns network from networks based on PACT_NETWORK env', () => {
      process.env.PACT_NETWORK = 'testnet';
      const testnetConfig = createChainwebNetworkConfig({
        apiUrl: 'https://api.testnet.chainweb.com',
        networkId: 'testnet04'
      });
      
      const config = {
        networks: {
          local: createDevNetNetworkConfig({}),
          testnet: testnetConfig
        }
      };

      const result = getNetworkConfig(config);
      expect(result).toBe(testnetConfig);
    });

    test('returns first network if no active network specified', () => {
      const firstNetwork = createPactServerNetworkConfig({});
      const config = {
        networks: {
          first: firstNetwork,
          second: createDevNetNetworkConfig({})
        }
      };

      const result = getNetworkConfig(config);
      expect(result).toBe(firstNetwork);
    });

    test('returns default devnet if no networks configured', () => {
      const config = {};
      const result = getNetworkConfig(config);
      
      expect(result.type).toBe('devnet');
      expect(result.name).toBe('devnet');
    });
  });

  describe('getSerializableNetworkConfig', () => {
    test('removes non-serializable properties', () => {
      const config = {
        contractsDir: './contracts',
        network: createDevNetNetworkConfig({}),
        // Add some functions that should be removed
        customFunction: () => {},
        nested: {
          anotherFunction: () => {}
        }
      };

      const result = getSerializableNetworkConfig(config);
      
      expect(result.contractsDir).toBe('./contracts');
      expect(result.network).toBeDefined();
      expect(result.customFunction).toBeUndefined();
      expect(result.nested).toBeUndefined();
    });
  });

  describe('Default Values', () => {
    test('defaultKeyPairs contains expected accounts', () => {
      expect(defaultKeyPairs).toHaveProperty('sender00');
      expect(defaultKeyPairs).toHaveProperty('sender01');
      expect(defaultKeyPairs.sender00).toHaveProperty('public');
      expect(defaultKeyPairs.sender00).toHaveProperty('secret');
      expect(defaultKeyPairs.sender00.public).toMatch(/^[a-f0-9]{64}$/);
    });

    test('defaultKeysets contains expected keysets', () => {
      expect(defaultKeysets).toHaveProperty('adminKeyset');
      expect(defaultKeysets).toHaveProperty('ns-admin-keyset');
      expect(defaultKeysets.adminKeyset).toEqual({
        keys: [defaultKeyPairs.sender00.public],
        pred: 'keys-all'
      });
    });

    test('defaultMeta contains expected values', () => {
      expect(defaultMeta).toEqual({
        chainId: '0',
        gasLimit: DEFAULT_GAS_LIMIT,
        gasPrice: DEFAULT_GAS_PRICE,
        ttl: DEFAULT_TTL
      });
    });

    test('default constants have correct values', () => {
      expect(DEFAULT_GAS_LIMIT).toBe(100000);
      expect(DEFAULT_GAS_PRICE).toBe(0.00001);
      expect(DEFAULT_TTL).toBe(3600);
    });
  });

  describe('resolveConfig', () => {
    test('resolves configuration with defaults', async () => {
      // Mock the c12 loadConfig to return empty config
      vi.mock('c12', () => ({
        loadConfig: vi.fn().mockResolvedValue({ config: {} })
      }));

      const config = await resolveConfig();
      
      expect(config).toHaveProperty('contractsDir');
      expect(config).toHaveProperty('networks');
      expect(config).toHaveProperty('preludes');
    });

    test('merges environment variables', async () => {
      process.env.PACT_CONTRACTS_DIR = './custom-contracts';
      process.env.PACT_NETWORK = 'custom-network';

      vi.mock('c12', () => ({
        loadConfig: vi.fn().mockResolvedValue({ 
          config: {
            networks: {
              'custom-network': createPactServerNetworkConfig({ port: 9999 })
            }
          }
        })
      }));

      const config = await resolveConfig();
      
      expect(config.contractsDir).toBe('./custom-contracts');
      const network = getNetworkConfig(config);
      expect(network.name).toBe('pact-server');
    });
  });

  describe('Configuration Validation', () => {
    test('network configs have required properties', () => {
      const pactServer = createPactServerNetworkConfig({});
      expect(pactServer.type).toBe('pact-server');
      expect(pactServer.name).toBeDefined();
      expect(pactServer.pactServer).toBeDefined();

      const devnet = createDevNetNetworkConfig({});
      expect(devnet.type).toBe('devnet');
      expect(devnet.name).toBeDefined();
      expect(devnet.devnet).toBeDefined();

      const chainweb = createChainwebNetworkConfig({
        apiUrl: 'https://api.chainweb.com',
        networkId: 'mainnet01'
      });
      expect(chainweb.type).toBe('chainweb');
      expect(chainweb.name).toBeDefined();
      expect(chainweb.chainweb).toBeDefined();
      expect(chainweb.chainweb.apiUrl).toBeDefined();
      expect(chainweb.chainweb.networkId).toBeDefined();
    });
  });

  describe('Port Configuration', () => {
    test('devnet config uses custom ports', () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          port: 9090,
          servicePorts: {
            stratum: 2000,
            servicePort: 2001,
            p2pPort: 2002
          }
        }
      });

      expect(config.devnet.containerConfig.port).toBe(9090);
      expect(config.devnet.containerConfig.servicePorts?.stratum).toBe(2000);
      expect(config.devnet.containerConfig.servicePorts?.servicePort).toBe(2001);
      expect(config.devnet.containerConfig.servicePorts?.p2pPort).toBe(2002);
    });

    test('pact server config uses custom port', () => {
      const config = createPactServerNetworkConfig({
        port: 7777
      });

      expect(config.pactServer.port).toBe(7777);
    });
  });

  describe('Mining Configuration', () => {
    test('devnet mining config sets correct values', () => {
      const config = createDevNetNetworkConfig({
        miningConfig: {
          onDemandMining: false,
          interval: 120,
          batchSize: 10
        }
      });

      expect(config.devnet.miningConfig?.onDemandMining).toBe(false);
      expect(config.devnet.miningConfig?.interval).toBe(120);
      expect(config.devnet.miningConfig?.batchSize).toBe(10);
    });

    test('on-demand mining can be enabled via container config', () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          onDemandMining: true
        }
      });

      expect(config.devnet.containerConfig.onDemandMining).toBe(true);
    });
  });
});