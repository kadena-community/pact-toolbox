import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MultiNetworkConfig, PactCommand, PactExecPayload } from "@pact-toolbox/types";
import {
  generateKAccount,
  generateKAccounts,
  getKAccountKey,
  pactDecimal,
  createPactCommandWithDefaults,
  createTransaction,
  updatePactCommandSigners,
  signPactCommandWithWallet,
  isPactExecPayload,
  isPactContPayload,
  getToolboxGlobalMultiNetworkConfig,
  validateNetworkForEnvironment,
  createChainwebClient,
  CLOCK_SKEW_OFFSET_SECONDS,
} from "./utils";

// Mock crypto functions at the module level
vi.mock("@pact-toolbox/crypto", () => ({
  genKeyPair: vi.fn().mockImplementation(async () => ({
    publicKey: "mock-public-key-" + Math.random().toString(36).substr(2, 9),
    privateKey: "mock-private-key-" + Math.random().toString(36).substr(2, 9),
  })),
  blake2bBase64Url: vi.fn().mockReturnValue("mock-hash"),
  fastStableStringify: vi.fn().mockImplementation((obj) => JSON.stringify(obj)),
}));

const mockMultiNetworkConfig: MultiNetworkConfig = {
  default: "pactServer",
  configs: {
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
      name: "pactServer",
    },
    testnet: {
      type: "chainweb",
      networkId: "testnet04",
      rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/testnet04/chain/{chainId}/pact",
      senderAccount: "test-account",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
      name: "testnet",
    },
  },
  environment: "development",
};

describe("Utils", () => {
  beforeEach(() => {
    // Clean up global state
    delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
    delete (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
  });

  describe("getKAccountKey", () => {
    it("should remove k: prefix from account", () => {
      expect(getKAccountKey("k:publicKey123")).toBe("publicKey123");
    });

    it("should return account as-is if no k: prefix", () => {
      expect(getKAccountKey("publicKey123")).toBe("publicKey123");
    });
  });

  describe("generateKAccount", () => {
    it("should generate a valid K-account", async () => {
      const account = await generateKAccount();

      expect(account.publicKey).toBeDefined();
      expect(account.secretKey).toBeDefined();
      expect(account.account).toBe(`k:${account.publicKey}`);
      expect(typeof account.publicKey).toBe("string");
      expect(typeof account.secretKey).toBe("string");
      expect(account.publicKey).toMatch(/^mock-public-key-/);
      expect(account.secretKey).toMatch(/^mock-private-key-/);
    });
  });

  describe("generateKAccounts", () => {
    it("should generate specified number of K-accounts", async () => {
      const count = 5;
      const accounts = await generateKAccounts(count);

      expect(accounts).toHaveLength(count);
      accounts.forEach((account) => {
        expect(account.publicKey).toBeDefined();
        expect(account.secretKey).toBeDefined();
        expect(account.account).toBe(`k:${account.publicKey}`);
        expect(account.publicKey).toMatch(/^mock-public-key-/);
        expect(account.secretKey).toMatch(/^mock-private-key-/);
      });
    });

    it("should default to 10 accounts if no count provided", async () => {
      const accounts = await generateKAccounts();
      expect(accounts).toHaveLength(10);
      accounts.forEach((account) => {
        expect(account.publicKey).toMatch(/^mock-public-key-/);
        expect(account.secretKey).toMatch(/^mock-private-key-/);
      });
    });
  });

  describe("pactDecimal", () => {
    it("should format number to 12 decimal places", () => {
      const result = pactDecimal(123.456);
      expect(result).toEqual({ decimal: "123.456000000000" });
    });

    it("should accept string and return as-is", () => {
      const result = pactDecimal("789.012345678901");
      expect(result).toEqual({ decimal: "789.012345678901" });
    });
  });

  describe("isPactExecPayload", () => {
    it("should return true for exec payload", () => {
      const payload = { exec: { code: "test", data: {} } };
      expect(isPactExecPayload(payload)).toBe(true);
    });

    it("should return false for cont payload", () => {
      const payload = { cont: { pactId: "test", step: 0, rollback: false, data: {} } };
      expect(isPactExecPayload(payload)).toBe(false);
    });
  });

  describe("isPactContPayload", () => {
    it("should return true for cont payload", () => {
      const payload = { cont: { pactId: "test", step: 0, rollback: false, data: {} } };
      expect(isPactContPayload(payload)).toBe(true);
    });

    it("should return false for exec payload", () => {
      const payload = { exec: { code: "test", data: {} } };
      expect(isPactContPayload(payload)).toBe(false);
    });
  });

  describe("createPactCommandWithDefaults", () => {
    it("should create command with network defaults", () => {
      const payload: PactExecPayload = { exec: { code: "test", data: {} } };
      const networkConfig = mockMultiNetworkConfig.configs["pactServer"]!;

      const command = createPactCommandWithDefaults(payload, networkConfig);

      expect(command.payload).toEqual(payload);
      expect(command.meta).toEqual(networkConfig.meta);
      expect(command.signers).toEqual([]);
      expect(command.networkId).toBe(networkConfig.networkId);
      expect(command.nonce).toBe("");
    });
  });

  describe("createTransaction", () => {
    it("should create transaction with proper defaults", () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const tx = createTransaction(command);

      expect(tx.cmd).toBeDefined();
      expect(tx.hash).toBeDefined();
      expect(tx.sigs).toBeDefined();
      expect(Array.isArray(tx.sigs)).toBe(true);

      // Parse the command to check defaults
      const parsedCmd = JSON.parse(tx.cmd);
      expect(parsedCmd.meta.gasLimit).toBe(150000);
      expect(parsedCmd.meta.gasPrice).toBe(1e-8);
      expect(parsedCmd.meta.ttl).toBe(15 * 60);
      expect(parsedCmd.meta.creationTime).toBeDefined();
      expect(parsedCmd.nonce).toMatch(/^pact-toolbox:nonce:/);
    });

    it("should set creation time with clock skew offset", () => {
      const beforeTime = Math.floor(Date.now() / 1000) - CLOCK_SKEW_OFFSET_SECONDS;

      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const tx = createTransaction(command);
      const parsedCmd = JSON.parse(tx.cmd);

      expect(parsedCmd.meta.creationTime).toBeGreaterThanOrEqual(beforeTime - 1);
      expect(parsedCmd.meta.creationTime).toBeLessThanOrEqual(beforeTime + 1);
    });
  });

  describe("updatePactCommandSigners", () => {
    it("should add single signer", () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const updated = updatePactCommandSigners(command, "alice-key");

      expect(updated.signers).toHaveLength(1);
      expect(updated.signers[0]).toEqual({
        pubKey: "alice-key",
        scheme: "ED25519",
        clist: undefined,
      });
    });

    it("should add multiple signers", () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const updated = updatePactCommandSigners(command, ["alice-key", "bob-key"]);

      expect(updated.signers).toHaveLength(2);
      expect(updated.signers[0]?.pubKey).toBe("alice-key");
      expect(updated.signers[1]?.pubKey).toBe("bob-key");
    });

    it("should add signer with capabilities", () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const updated = updatePactCommandSigners(command, "alice-key", (signFor) => [
        signFor("coin.TRANSFER", "alice", "bob", 10.0),
      ]);

      expect(updated.signers).toHaveLength(1);
      expect(updated.signers[0]?.clist).toEqual([{ name: "coin.TRANSFER", args: ["alice", "bob", 10.0] }]);
    });

    it("should update existing signer capabilities", () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [{ pubKey: "alice-key", scheme: "ED25519" }],
        networkId: "development",
        nonce: "",
      };

      const updated = updatePactCommandSigners(command, "alice-key", (signFor) => [signFor("coin.GAS")]);

      expect(updated.signers).toHaveLength(1);
      expect(updated.signers[0]?.clist).toEqual([{ name: "coin.GAS", args: [] }]);
    });
  });

  describe("signPactCommandWithWallet", () => {
    it("should sign command with wallet", async () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [{ pubKey: "alice-key", scheme: "ED25519" }],
        networkId: "development",
        nonce: "",
      };

      const mockWallet = {
        getAccount: vi.fn().mockResolvedValue({
          address: "alice",
          publicKey: "alice-key",
        }),
        sign: vi.fn().mockResolvedValue({
          cmd: "signed-cmd",
          hash: "signed-hash",
          sigs: [{ sig: "signature" }],
        }),
      };

      const result = await signPactCommandWithWallet(command, mockWallet as any);

      expect(mockWallet.sign).toHaveBeenCalled();
      expect(result).toEqual({
        cmd: "signed-cmd",
        hash: "signed-hash",
        sigs: [{ sig: "signature" }],
      });
    });

    it("should add default signer when none provided", async () => {
      const command: PactCommand<PactExecPayload> = {
        payload: { exec: { code: "test", data: {} } },
        meta: { chainId: "0" },
        signers: [],
        networkId: "development",
        nonce: "",
      };

      const mockWallet = {
        getAccount: vi.fn().mockResolvedValue({
          address: "alice",
          publicKey: "alice-key",
        }),
        sign: vi.fn().mockResolvedValue({
          cmd: "signed-cmd",
          hash: "signed-hash",
          sigs: [{ sig: "signature" }],
        }),
      };

      await signPactCommandWithWallet(command, mockWallet as any);

      expect(command.signers).toHaveLength(1);
      expect(command.signers[0]?.pubKey).toBe("alice-key");
      expect(command.meta.sender).toBe("alice");
    });
  });

  describe("getToolboxGlobalMultiNetworkConfig", () => {
    beforeEach(() => {
      delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
      delete (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
    });

    it("should return config from __PACT_TOOLBOX_NETWORKS__", () => {
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = mockMultiNetworkConfig;

      const config = getToolboxGlobalMultiNetworkConfig();
      expect(config).toEqual(mockMultiNetworkConfig);
    });

    it("should parse string config", () => {
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = JSON.stringify(mockMultiNetworkConfig);

      const config = getToolboxGlobalMultiNetworkConfig();
      expect(config).toEqual(mockMultiNetworkConfig);
    });

    it("should build config from context", () => {
      const mockContext = {
        getNetworkConfig: () => mockMultiNetworkConfig.configs["pactServer"],
      };
      (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = mockContext;

      const config = getToolboxGlobalMultiNetworkConfig();
      expect(config.configs["development"]).toEqual(mockMultiNetworkConfig.configs["pactServer"]);
    });

    it("should return fallback config when nothing found", () => {
      const config = getToolboxGlobalMultiNetworkConfig();
      expect(config).toEqual({
        default: "development",
        environment: "development",
        configs: {},
      });
    });

    it("should throw error in strict mode when not installed", () => {
      expect(() => getToolboxGlobalMultiNetworkConfig(true)).toThrow(
        "Make sure you are using the pact-toolbox bundler plugin",
      );
    });
  });

  describe("validateNetworkForEnvironment", () => {
    beforeEach(() => {
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = mockMultiNetworkConfig;
    });

    it("should allow any network in development", () => {
      expect(validateNetworkForEnvironment("pactServer")).toBe(true);
      expect(validateNetworkForEnvironment("testnet")).toBe(true);
    });

    it("should reject local networks in production", () => {
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = {
        ...mockMultiNetworkConfig,
        environment: "production",
      };

      expect(validateNetworkForEnvironment("pactServer")).toBe(false);
    });

    it("should reject networks with keypairs in production", () => {
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = {
        ...mockMultiNetworkConfig,
        environment: "production",
        configs: {
          testnet: {
            ...mockMultiNetworkConfig.configs["testnet"]!,
            keyPairs: [{ publicKey: "key", secretKey: "secret", account: "account" }],
          },
        },
      };

      expect(validateNetworkForEnvironment("testnet")).toBe(false);
    });

    it("should return false for non-existent networks", () => {
      expect(validateNetworkForEnvironment("nonexistent")).toBe(false);
    });

    it("should return false on errors", () => {
      delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
      expect(validateNetworkForEnvironment("testnet")).toBe(false);
    });
  });

  describe("createChainwebClient", () => {
    it("should create client with correct configuration", () => {
      const networkConfig = mockMultiNetworkConfig.configs["testnet"]!;
      const client = createChainwebClient(networkConfig);

      expect(client).toBeDefined();
      // We can't easily test the internal configuration without exposing it
      // But we can verify the client is created without errors
    });

    it("should handle URL templates", () => {
      const networkConfig = {
        ...mockMultiNetworkConfig.configs["testnet"]!,
        rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
      };

      const client = createChainwebClient(networkConfig);
      expect(client).toBeDefined();
    });
  });
});
