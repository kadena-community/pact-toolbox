import { describe, it, expect, beforeEach } from "vitest";
import {
  getSerializableMultiNetworkConfig,
  getDefaultNetworkConfig,
  type PactToolboxConfigObj,
  type DevNetworkConfig,
  type PactServerNetworkConfig,
  type ChainwebNetworkConfig,
} from "./utils";

describe("Multi-Network Configuration", () => {
  let testConfig: PactToolboxConfigObj;

  beforeEach(() => {
    testConfig = {
      defaultNetwork: "pactServer",
      networks: {
        pactServer: {
          type: "pact-server",
          networkId: "development",
          rpcUrl: "http://localhost:8080",
          senderAccount: "sender00",
          keyPairs: [
            {
              publicKey: "test-pub-key",
              secretKey: "test-secret-key",
              account: "sender00",
            },
          ],
          keysets: {},
          meta: { chainId: "0" },
          autoStart: true,
          serverConfig: { port: 8080 },
        } as PactServerNetworkConfig,
        devnet: {
          type: "chainweb-devnet",
          networkId: "development",
          rpcUrl: "http://localhost:8081",
          senderAccount: "sender00",
          keyPairs: [
            {
              publicKey: "devnet-pub-key",
              secretKey: "devnet-secret-key",
              account: "sender00",
            },
          ],
          keysets: {},
          meta: { chainId: "0" },
          autoStart: true,
          containerConfig: { port: 8081 },
        } as DevNetworkConfig,
        testnet: {
          type: "chainweb",
          networkId: "testnet04",
          rpcUrl: "https://api.testnet.chainweb.com",
          senderAccount: "test-account",
          keyPairs: [
            {
              publicKey: "testnet-pub-key",
              secretKey: "testnet-secret-key",
              account: "test-account",
            },
          ],
          keysets: {},
          meta: { chainId: "0" },
        } as ChainwebNetworkConfig,
        mainnet: {
          type: "chainweb",
          networkId: "mainnet01",
          rpcUrl: "https://api.chainweb.com",
          senderAccount: "main-account",
          keyPairs: [],
          keysets: {},
          meta: { chainId: "0" },
        } as ChainwebNetworkConfig,
      },
      contractsDir: "./pact",
      scriptsDir: "./scripts",
      pactVersion: "4.9",
      preludes: [],
      downloadPreludes: false,
      deployPreludes: false,
    };
  });

  describe("getSerializableMultiNetworkConfig", () => {
    it("should include all networks in development mode", () => {
      const result = getSerializableMultiNetworkConfig(testConfig, { isDev: true, isTest: false });

      expect(result.environment).toBe("development");
      expect(result.default).toBe("pactServer");
      expect(Object.keys(result.configs)).toEqual(["pactServer", "devnet", "testnet", "mainnet"]);

      // All networks should have their key pairs in dev mode
      expect(result.configs["pactServer"]!.keyPairs).toHaveLength(1);
      expect(result.configs["devnet"]!.keyPairs).toHaveLength(1);
      expect(result.configs["testnet"]!.keyPairs).toHaveLength(1);
      expect(result.configs["mainnet"]!.keyPairs).toHaveLength(0); // mainnet has no keys even in dev
    });

    it("should exclude local networks in production mode", () => {
      const result = getSerializableMultiNetworkConfig(testConfig, { isDev: false, isTest: false });

      expect(result.environment).toBe("production");
      expect(Object.keys(result.configs)).toEqual(["testnet", "mainnet"]);

      // No private keys in production
      expect(result.configs["testnet"]!.keyPairs).toHaveLength(0);
      expect(result.configs["mainnet"]!.keyPairs).toHaveLength(0);
    });

    it("should set environment to test when isTest is true", () => {
      const result = getSerializableMultiNetworkConfig(testConfig, { isDev: true, isTest: true });

      expect(result.environment).toBe("test");
      expect(Object.keys(result.configs)).toEqual(["pactServer", "devnet", "testnet", "mainnet"]);
    });

    it("should preserve network names and configurations", () => {
      const result = getSerializableMultiNetworkConfig(testConfig, { isDev: true, isTest: false });

      expect(result.configs["pactServer"]?.name).toBe("pactServer");
      expect(result.configs["pactServer"]?.type).toBe("pact-server");
      expect(result.configs["pactServer"]?.networkId).toBe("development");

      expect(result.configs["testnet"]?.name).toBe("testnet");
      expect(result.configs["testnet"]?.type).toBe("chainweb");
      expect(result.configs["testnet"]?.networkId).toBe("testnet04");
    });

    it("should properly transform RPC URLs", () => {
      const result = getSerializableMultiNetworkConfig(testConfig, { isDev: true, isTest: false });

      expect(result.configs["pactServer"]?.rpcUrl).toBe("http://localhost:8080");
      expect(result.configs["devnet"]?.rpcUrl).toBe("http://localhost:8081");
      expect(result.configs["testnet"]?.rpcUrl).toBe("https://api.testnet.chainweb.com");
    });
  });

  describe("getNetworkConfig", () => {
    it("should return default network when no network specified", () => {
      const result = getDefaultNetworkConfig(testConfig);

      expect(result.name).toBe("pactServer");
      expect(result.type).toBe("pact-server");
    });

    it("should return specified network", () => {
      const result = getDefaultNetworkConfig(testConfig, "testnet");

      expect(result.name).toBe("testnet");
      expect(result.type).toBe("chainweb");
      expect(result.networkId).toBe("testnet04");
    });

    it("should throw error for non-existent network", () => {
      expect(() => {
        getDefaultNetworkConfig(testConfig, "nonexistent");
      }).toThrow(/Network "nonexistent" not found in config/);
    });

    it("should use environment variable when available", () => {
      const originalEnv = process.env["PACT_TOOLBOX_NETWORK"];
      process.env["PACT_TOOLBOX_NETWORK"] = "testnet";

      try {
        const result = getDefaultNetworkConfig(testConfig);
        expect(result.name).toBe("testnet");
      } finally {
        process.env["PACT_TOOLBOX_NETWORK"] = originalEnv;
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty networks object", () => {
      const emptyConfig = { ...testConfig, networks: {} };

      expect(() => {
        getSerializableMultiNetworkConfig(emptyConfig, { isDev: true, isTest: false });
      }).not.toThrow();

      const result = getSerializableMultiNetworkConfig(emptyConfig, { isDev: true, isTest: false });
      expect(result.configs).toEqual({});
    });

    it("should handle network with missing autoStart", () => {
      const configWithoutAutoStart = {
        ...testConfig,
        networks: {
          testOnlyNetwork: {
            type: "pact-server" as const,
            networkId: "test",
            rpcUrl: "http://localhost:9999",
            senderAccount: "test",
            keyPairs: [],
            keysets: {},
            meta: { chainId: "0" as any },
            serverConfig: { port: 9999 },
            // no autoStart property
          },
        },
      };

      const devResult = getSerializableMultiNetworkConfig(configWithoutAutoStart, {
        isDev: true,
        isTest: false,
      });
      expect(Object.keys(devResult.configs)).toContain("testOnlyNetwork");

      const prodResult = getSerializableMultiNetworkConfig(configWithoutAutoStart, {
        isDev: false,
        isTest: false,
      });
      expect(Object.keys(prodResult.configs)).toContain("testOnlyNetwork");
    });
  });
});
