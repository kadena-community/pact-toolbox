import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MultiNetworkConfig } from "@pact-toolbox/types";
import { PactTransactionBuilder, execution, continuation } from "./builder";
import { createToolboxNetworkContext } from "./network";

// Mock the global networks configuration
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
      rpcUrl: "https://api.testnet.chainweb.com",
      senderAccount: "test-account",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
      name: "testnet",
    },
  },
  environment: "development",
};

describe("PactTransactionBuilder", () => {
  beforeEach(() => {
    // Mock the global networks configuration
    (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = mockMultiNetworkConfig;
    // Clear any existing global context
    (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = null;
    (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__ = null;
  });

  afterEach(() => {
    // Cleanup global state
    delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
    delete (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
    delete (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__;
  });

  describe("execution", () => {
    it("should create an execution transaction builder", () => {
      const builder = execution('(coin.get-balance "alice")');
      const command = builder.getCommand();

      expect(command.payload).toEqual({
        exec: {
          code: '(coin.get-balance "alice")',
          data: {},
        },
      });
      expect(command.networkId).toBe("development");
      expect(command.meta.chainId).toBe("0");
    });

    it("should create with custom context", () => {
      const context = createToolboxNetworkContext({
        ...mockMultiNetworkConfig,
        default: "testnet",
      });

      const builder = execution('(coin.get-balance "alice")', context);
      const command = builder.getCommand();

      expect(command.networkId).toBe("testnet04");
    });
  });

  describe("continuation", () => {
    it("should create a continuation transaction builder", () => {
      const builder = continuation({
        pactId: "test-pact-id",
        step: 1,
        rollback: false,
      });
      const command = builder.getCommand();

      expect(command.payload).toEqual({
        cont: {
          pactId: "test-pact-id",
          step: 1,
          rollback: false,
          data: {},
        },
      });
    });

    it("should create with default values", () => {
      const builder = continuation();
      const command = builder.getCommand();

      expect(command.payload).toEqual({
        cont: {
          pactId: "",
          step: 0,
          rollback: false,
          data: {},
        },
      });
    });
  });

  describe("PactTransactionBuilder methods", () => {
    let builder: PactTransactionBuilder<any>;

    beforeEach(() => {
      builder = execution('(coin.get-balance "alice")');
    });

    it("should add data with withData", () => {
      builder.withData("user", "alice").withData("amount", 100);
      const command = builder.getCommand();

      expect(command.payload.exec.data).toEqual({
        user: "alice",
        amount: 100,
      });
    });

    it("should add multiple data with withDataMap", () => {
      builder.withDataMap({
        user: "alice",
        amount: 100,
        verified: true,
      });
      const command = builder.getCommand();

      expect(command.payload.exec.data).toEqual({
        user: "alice",
        amount: 100,
        verified: true,
      });
    });

    it("should add keyset with withKeyset", () => {
      const keyset = {
        keys: ["alice-key"],
        pred: "keys-all" as const,
      };

      builder.withKeyset("alice-keyset", keyset);
      const command = builder.getCommand();

      expect(command.payload.exec.data["alice-keyset"]).toEqual(keyset);
    });

    it("should add multiple keysets with withKeysetMap", () => {
      const keysets = {
        "alice-keyset": { keys: ["alice-key"], pred: "keys-all" as const },
        "bob-keyset": { keys: ["bob-key"], pred: "keys-all" as const },
      };

      builder.withKeysetMap(keysets);
      const command = builder.getCommand();

      expect(command.payload.exec.data["alice-keyset"]).toEqual(keysets["alice-keyset"]);
      expect(command.payload.exec.data["bob-keyset"]).toEqual(keysets["bob-keyset"]);
    });

    it("should set chain ID with withChainId", () => {
      builder.withChainId("5");
      const command = builder.getCommand();

      expect(command.meta.chainId).toBe("5");
    });

    it("should update meta with withMeta", () => {
      builder.withMeta({
        gasLimit: 200000,
        gasPrice: 1e-7,
        sender: "alice",
        ttl: 3600,
      });
      const command = builder.getCommand();

      expect(command.meta.gasLimit).toBe(200000);
      expect(command.meta.gasPrice).toBe(1e-7);
      expect(command.meta.sender).toBe("alice");
      expect(command.meta.ttl).toBe(3600);
    });

    it("should add signer with withSigner", () => {
      builder.withSigner("alice-key");
      const command = builder.getCommand();

      expect(command.signers).toHaveLength(1);
      expect(command.signers[0]).toEqual({
        pubKey: "alice-key",
        scheme: "ED25519",
        clist: undefined,
      });
    });

    it("should add signer with capabilities", () => {
      builder.withSigner("alice-key", (signFor) => [
        signFor("coin.TRANSFER", "alice", "bob", 10.0),
        signFor("coin.GAS"),
      ]);
      const command = builder.getCommand();

      expect(command.signers).toHaveLength(1);
      expect(command.signers[0]?.clist).toEqual([
        { name: "coin.TRANSFER", args: ["alice", "bob", 10.0] },
        { name: "coin.GAS", args: [] },
      ]);
    });

    it("should add multiple signers", () => {
      builder.withSigner(["alice-key", "bob-key"]);
      const command = builder.getCommand();

      expect(command.signers).toHaveLength(2);
      expect(command.signers[0]?.pubKey).toBe("alice-key");
      expect(command.signers[1]?.pubKey).toBe("bob-key");
    });

    it("should add verifier with withVerifier", () => {
      const verifier = {
        name: "HYPERLANE_V3_MESSAGE",
        proof: "test-proof",
        clist: [],
      };

      builder.withVerifier(verifier);
      const command = builder.getCommand();

      expect(command.verifiers).toHaveLength(1);
      expect(command.verifiers?.[0]).toEqual(verifier);
    });

    it("should set network ID with withNetworkId", () => {
      builder.withNetworkId("mainnet01");
      const command = builder.getCommand();

      expect(command.networkId).toBe("mainnet01");
    });

    it("should set nonce with withNonce", () => {
      builder.withNonce("custom-nonce-123");
      const command = builder.getCommand();

      expect(command.nonce).toBe("custom-nonce-123");
    });

    it("should set context with withContext", () => {
      const newContext = createToolboxNetworkContext({
        ...mockMultiNetworkConfig,
        default: "testnet",
      });

      builder.withContext(newContext);
      // Context change should affect future builds
      const _dispatcher = builder.build();

      // We can't easily test the internal context, but we can verify the method returns this
      expect(builder.withContext(newContext)).toBe(builder);
    });

    it("should support method chaining", () => {
      const result = builder
        .withData("user", "alice")
        .withChainId("1")
        .withMeta({ gasLimit: 150000 })
        .withSigner("alice-key");

      expect(result).toBe(builder);

      const command = builder.getCommand();
      expect(command.payload.exec.data.user).toBe("alice");
      expect(command.meta.chainId).toBe("1");
      expect(command.meta.gasLimit).toBe(150000);
      expect(command.signers).toHaveLength(1);
    });

    it("should convert to string with toString", () => {
      const _dispatcher = builder.build();
      const str = builder.toString();

      expect(str).toBeDefined();
      expect(typeof str).toBe("string");
      expect(() => JSON.parse(str)).not.toThrow();
    });
  });

  describe("Transaction Signing", () => {
    let builder: PactTransactionBuilder<any>;

    beforeEach(() => {
      builder = execution('(coin.get-balance "alice")');
    });

    it("should create signing dispatcher with sign method", () => {
      const mockWallet = {
        isInstalled: vi.fn().mockReturnValue(true),
        connect: vi.fn().mockResolvedValue(undefined),
        getNetwork: vi.fn().mockResolvedValue("testnet04"),
        isConnected: vi.fn().mockReturnValue(true),
        disconnect: vi.fn().mockResolvedValue(undefined),
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

      const dispatcher = builder.sign(mockWallet);

      expect(dispatcher).toBeDefined();
      // We can't easily test the signing without actually calling a dispatcher method
      // But we can verify the method returns a dispatcher
      expect(typeof dispatcher.submitAndListen).toBe("function");
    });

    it("should create signing dispatcher with wallet ID", () => {
      const dispatcher = builder.sign("test-wallet-id", { showUI: false });

      expect(dispatcher).toBeDefined();
      expect(typeof dispatcher.submitAndListen).toBe("function");
    });

    it("should create signing dispatcher for wallet selector", () => {
      const dispatcher = builder.sign();

      expect(dispatcher).toBeDefined();
      expect(typeof dispatcher.submitAndListen).toBe("function");
    });
  });

  describe("Transaction Building", () => {
    let builder: PactTransactionBuilder<any>;

    beforeEach(() => {
      builder = execution('(coin.get-balance "alice")');
    });

    it("should build unsigned transaction", () => {
      const dispatcher = builder.build();

      expect(dispatcher).toBeDefined();
      expect(typeof dispatcher.dirtyRead).toBe("function");
      expect(typeof dispatcher.local).toBe("function");
      expect(typeof dispatcher.submit).toBe("function");
      expect(typeof dispatcher.submitAndListen).toBe("function");
    });

    it("should build with custom context", () => {
      const context = createToolboxNetworkContext({
        ...mockMultiNetworkConfig,
        default: "testnet",
      });

      const dispatcher = builder.build(context);

      expect(dispatcher).toBeDefined();
    });

    it("should return partial transaction", async () => {
      const tx = await builder.getPartialTransaction();

      expect(tx).toBeDefined();
      expect(tx.cmd).toBeDefined();
      expect(tx.hash).toBeDefined();
      expect(tx.sigs).toBeDefined();
      expect(Array.isArray(tx.sigs)).toBe(true);
    });
  });
});
