import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  resolveConfig,
  defineConfig,
  getDefaultNetworkConfig,
  isLocalNetwork,
  isDevNetworkConfig,
  isPactServerNetworkConfig,
  isChainwebNetworkConfig,
  createPactServerNetworkConfig,
  createDevNetNetworkConfig,
  createChainwebNetworkConfig,
  getSerializableNetworkConfig,
  defaultKeysets,
  defaultKeyPairsObject,
  defaultMeta,
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE,
  DEFAULT_TTL,
  clearConfigCache,
} from "./index";

describe("@pact-toolbox/config", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env["PACT_TOOLBOX_NETWORK"];
    delete process.env["PACT_TOOLBOX_CONTRACTS_DIR"];
    vi.clearAllMocks();
  });

  describe("defineConfig", () => {
    test("should return the same config object", () => {
      const config = {
        defaultNetwork: "devnet" as const,
        networks: {
          devnet: createDevNetNetworkConfig({
            containerConfig: {
              port: 8080,
            },
          }),
        },
        contractsDir: "./contracts",
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
    });
  });

  describe("Network Configuration Factories", () => {
    test("createPactServerNetworkConfig creates valid config", () => {
      const config = createPactServerNetworkConfig({
        serverConfig: {
          port: 8081,
        },
        meta: {
          gasLimit: 50000,
          gasPrice: 0.000001,
          ttl: 300,
          chainId: "0",
        },
        senderAccount: "test-sender",
      });

      expect(config.type).toBe("pact-server");
      expect(config.serverConfig?.port).toBe(8081);
      expect(config.meta?.gasLimit).toBe(50000);
      expect(config.meta?.gasPrice).toBe(0.000001);
      expect(config.meta?.ttl).toBe(300);
      expect(config.senderAccount).toBe("test-sender");
    });

    test("createDevNetNetworkConfig creates valid config", () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          port: 8082,
          onDemandMining: true,
          persistDb: false,
        },
        miningConfig: {
          transactionBatchPeriod: 0.1,
          confirmationCount: 10,
          idlePeriod: 60,
        },
      });

      expect(config.type).toBe("chainweb-devnet");
      expect(config.containerConfig?.port).toBe(8082);
      expect(config.containerConfig?.onDemandMining).toBe(true);
      expect(config.containerConfig?.persistDb).toBe(false);
      expect(config.miningConfig?.transactionBatchPeriod).toBe(0.1);
      expect(config.miningConfig?.confirmationCount).toBe(10);
      expect(config.miningConfig?.idlePeriod).toBe(60);
    });

    test("createChainwebNetworkConfig creates valid config", () => {
      const config = createChainwebNetworkConfig({
        rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
        networkId: "testnet04",
        meta: {
          chainId: "1",
          gasLimit: 100000,
          gasPrice: 0.00001,
          ttl: 900,
        },
      });

      expect(config.type).toBe("chainweb");
      expect(config.rpcUrl).toContain("api.testnet.chainweb.com");
      expect(config.networkId).toBe("testnet04");
      expect(config.meta?.chainId).toBe("1");
    });
  });

  describe("Network Type Guards", () => {
    const pactServerConfig = createPactServerNetworkConfig({});
    const devnetConfig = createDevNetNetworkConfig({});
    const chainwebConfig = createChainwebNetworkConfig({
      rpcUrl: "https://api.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
      networkId: "mainnet01",
    });

    test("isLocalNetwork correctly identifies local networks", () => {
      expect(isLocalNetwork(pactServerConfig)).toBe(true);
      expect(isLocalNetwork(devnetConfig)).toBe(true);
      expect(isLocalNetwork(chainwebConfig)).toBe(false);
    });

    test("isDevNetworkConfig correctly identifies devnet", () => {
      expect(isDevNetworkConfig(pactServerConfig)).toBe(false);
      expect(isDevNetworkConfig(devnetConfig)).toBe(true);
      expect(isDevNetworkConfig(chainwebConfig)).toBe(false);
    });

    test("isPactServerNetworkConfig correctly identifies pact server", () => {
      expect(isPactServerNetworkConfig(pactServerConfig)).toBe(true);
      expect(isPactServerNetworkConfig(devnetConfig)).toBe(false);
      expect(isPactServerNetworkConfig(chainwebConfig)).toBe(false);
    });

    test("isChainwebNetworkConfig correctly identifies chainweb", () => {
      expect(isChainwebNetworkConfig(pactServerConfig)).toBe(false);
      expect(isChainwebNetworkConfig(devnetConfig)).toBe(false);
      expect(isChainwebNetworkConfig(chainwebConfig)).toBe(true);
    });
  });

  describe("getDefaultNetworkConfig", () => {
    test("returns network from defaultNetwork", () => {
      const devNetwork = createDevNetNetworkConfig({});
      const pactNetwork = createPactServerNetworkConfig({});
      const config = {
        defaultNetwork: "dev",
        networks: {
          dev: devNetwork,
          pact: pactNetwork,
        },
      };

      const result = getDefaultNetworkConfig(config);
      expect(result.type).toBe(devNetwork.type);
      expect(result.networkId).toBe(devNetwork.networkId);
      expect(result.name).toBe("dev");
    });

    test("returns network from networks based on PACT_TOOLBOX_NETWORK env", () => {
      process.env["PACT_TOOLBOX_NETWORK"] = "testnet";
      const testnetConfig = createChainwebNetworkConfig({
        rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
        networkId: "testnet04",
      });

      const config = {
        defaultNetwork: "local",
        networks: {
          local: createDevNetNetworkConfig({}),
          testnet: testnetConfig,
        },
      };

      const result = getDefaultNetworkConfig(config, "testnet");
      expect(result.type).toBe(testnetConfig.type);
      expect(result.networkId).toBe(testnetConfig.networkId);
      expect(result.name).toBe("testnet");
    });

    test("returns first network if no active network specified", () => {
      const firstNetwork = createPactServerNetworkConfig({});
      const config = {
        defaultNetwork: "first",
        networks: {
          first: firstNetwork,
          second: createDevNetNetworkConfig({}),
        },
      };

      const result = getDefaultNetworkConfig(config);
      expect(result.type).toBe(firstNetwork.type);
      expect(result.networkId).toBe(firstNetwork.networkId);
      expect(result.name).toBe("first");
    });

    test("throws error if network not found", () => {
      const config = {
        defaultNetwork: "notfound",
        networks: {},
      };

      expect(() => getDefaultNetworkConfig(config)).toThrow(/Network "notfound" not found in config/);
    });
  });

  describe("getSerializableNetworkConfig", () => {
    test("returns serializable network config", () => {
      const config = {
        defaultNetwork: "devnet",
        networks: {
          devnet: createDevNetNetworkConfig({}),
        },
        contractsDir: "./contracts",
      };

      const result = getSerializableNetworkConfig(config);

      expect(result.type).toBe("chainweb-devnet");
      expect(result.networkId).toBe("development");
      expect(result.rpcUrl).toBeDefined();
      expect(result.keyPairs).toBeDefined();
      expect(result.keyPairs.length).toBeGreaterThan(0);
    });
  });

  describe("Default Values", () => {
    test("defaultKeyPairs contains expected accounts", () => {
      expect(defaultKeyPairsObject).toHaveProperty("sender00");
      expect(defaultKeyPairsObject).toHaveProperty("sender01");
      expect(defaultKeyPairsObject["sender00"]).toHaveProperty("publicKey");
      expect(defaultKeyPairsObject["sender00"]).toHaveProperty("secretKey");
      expect(defaultKeyPairsObject["sender00"]!.publicKey).toMatch(/^[a-f0-9]{64}$/);
    });

    test("defaultKeysets contains expected keysets", () => {
      expect(defaultKeysets).toHaveProperty("sender00");
      expect(defaultKeysets).toHaveProperty("sender01");
      expect(defaultKeysets["sender00"]).toEqual({
        keys: [defaultKeyPairsObject["sender00"]!.publicKey],
        pred: "keys-all",
      });
    });

    test("defaultMeta contains expected values", () => {
      expect(defaultMeta).toEqual({
        chainId: "0",
        gasLimit: DEFAULT_GAS_LIMIT,
        gasPrice: DEFAULT_GAS_PRICE,
        ttl: DEFAULT_TTL,
      });
    });

    test("default constants have correct values", () => {
      expect(DEFAULT_GAS_LIMIT).toBe(150000);
      expect(DEFAULT_GAS_PRICE).toBe(0.00000001);
      expect(DEFAULT_TTL).toBe(900);
    });
  });

  describe("resolveConfig", () => {
    test("resolves configuration with defaults", async () => {
      const config = await resolveConfig();

      expect(config).toHaveProperty("contractsDir");
      expect(config).toHaveProperty("networks");
      expect(config).toHaveProperty("preludes");
      expect(config.defaultNetwork).toBeDefined();
    });

    test("applies overrides", async () => {
      // Clear the config cache before this test
      clearConfigCache();

      const overrides = {
        contractsDir: "./custom-contracts",
        defaultNetwork: "custom",
        networks: {
          custom: createPactServerNetworkConfig({ serverConfig: { port: 9999 } }),
        },
      };

      const config = await resolveConfig(overrides);

      expect(config.contractsDir).toBe("./custom-contracts");
      expect(config.defaultNetwork).toBe("custom");
      const network = getDefaultNetworkConfig(config);
      expect(network.name).toBe("custom");
    });
  });

  describe("Configuration Validation", () => {
    test("network configs have required properties", () => {
      const pactServer = createPactServerNetworkConfig({});
      expect(pactServer.type).toBe("pact-server");
      expect(pactServer.serverConfig).toBeDefined();
      expect(pactServer.autoStart).toBe(true);

      const devnet = createDevNetNetworkConfig({});
      expect(devnet.type).toBe("chainweb-devnet");
      expect(devnet.containerConfig).toBeDefined();
      expect(devnet.autoStart).toBe(true);

      const chainweb = createChainwebNetworkConfig({
        rpcUrl: "https://api.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
        networkId: "mainnet01",
      });
      expect(chainweb.type).toBe("chainweb");
      expect(chainweb.rpcUrl).toBeDefined();
      expect(chainweb.networkId).toBe("mainnet01");
    });
  });

  describe("Port Configuration", () => {
    test("devnet config uses custom ports", () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          port: 9090,
        },
      });

      expect(config.containerConfig?.port).toBe(9090);
    });

    test("pact server config uses custom port", () => {
      const config = createPactServerNetworkConfig({
        serverConfig: {
          port: 7777,
        },
      });

      expect(config.serverConfig?.port).toBe(7777);
    });
  });

  describe("Mining Configuration", () => {
    test("devnet mining config sets correct values", () => {
      const config = createDevNetNetworkConfig({
        miningConfig: {
          transactionBatchPeriod: 0.1,
          confirmationCount: 10,
          idlePeriod: 120,
        },
      });

      expect(config.miningConfig?.transactionBatchPeriod).toBe(0.1);
      expect(config.miningConfig?.confirmationCount).toBe(10);
      expect(config.miningConfig?.idlePeriod).toBe(120);
    });

    test("on-demand mining can be enabled via container config", () => {
      const config = createDevNetNetworkConfig({
        containerConfig: {
          onDemandMining: true,
        },
      });

      expect(config.containerConfig?.onDemandMining).toBe(true);
    });
  });
});
