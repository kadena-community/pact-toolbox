import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MultiNetworkConfig, Transaction, ChainId } from "@pact-toolbox/types";
import { execution } from "./builder";
import { createToolboxNetworkContext } from "./network";

// Mock the chainweb-client functions
vi.mock("@pact-toolbox/chainweb-client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  return {
    ...actual,
    dirtyReadOrFail: vi.fn(),
    localOrFail: vi.fn(),
    submit: vi.fn(),
    submitAndListen: vi.fn(),
  };
});

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
  },
  environment: "development",
};

describe("PactTransactionDispatcher", () => {
  beforeEach(() => {
    // Mock the global networks configuration
    (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = mockMultiNetworkConfig;
    // Clear any existing global context
    (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = null;
    (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__ = null;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup global state
    delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
    delete (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
    delete (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__;
  });

  describe("dirtyRead", () => {
    it("should call dirtyReadOrFail for single chain", async () => {
      const { dirtyReadOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { balance: "100.0" };
      vi.mocked(dirtyReadOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.dirtyRead("1");

      expect(dirtyReadOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call dirtyReadOrFail for multiple chains", async () => {
      const { dirtyReadOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = [{ balance: "100.0" }, { balance: "200.0" }];
      vi.mocked(dirtyReadOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.dirtyRead(["1", "2"]);

      expect(dirtyReadOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call dirtyReadAll for all chains", async () => {
      const { dirtyReadOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = Array(20).fill({ balance: "100.0" });
      vi.mocked(dirtyReadOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.dirtyReadAll();

      expect(dirtyReadOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("local", () => {
    it("should call localOrFail for single chain", async () => {
      const { localOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { balance: "100.0" };
      vi.mocked(localOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.local("1");

      expect(localOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call localOrFail for multiple chains", async () => {
      const { localOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = [{ balance: "100.0" }, { balance: "200.0" }];
      vi.mocked(localOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.local(["1", "2"]);

      expect(localOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call localAll for all chains", async () => {
      const { localOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = Array(20).fill({ balance: "100.0" });
      vi.mocked(localOrFail).mockResolvedValue(mockResult);

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      const result = await dispatcher.localAll();

      expect(localOrFail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("submit", () => {
    it("should call submit for single chain", async () => {
      const { submit } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { requestKey: "test-key", chainId: "1" as ChainId, networkId: "development" };
      vi.mocked(submit).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submit("1");

      expect(submit).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call submit for multiple chains", async () => {
      const { submit } = await import("@pact-toolbox/chainweb-client");
      const mockResult = [
        { requestKey: "test-key-1", chainId: "1" as ChainId, networkId: "development" },
        { requestKey: "test-key-2", chainId: "2" as ChainId, networkId: "development" },
      ];
      vi.mocked(submit).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submit(["1", "2"]);

      expect(submit).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call submit with preflight", async () => {
      const { submit } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { requestKey: "test-key", chainId: "1" as ChainId, networkId: "development" };
      vi.mocked(submit).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submit("1", true);

      expect(submit).toHaveBeenCalledWith(
        expect.any(Object), // client
        expect.any(Object), // transaction
        true, // preflight
      );
      expect(result).toEqual(mockResult);
    });

    it("should call submitAll for all chains", async () => {
      const { submit } = await import("@pact-toolbox/chainweb-client");
      const mockResult = Array(20)
        .fill(null)
        .map((_, i) => ({
          requestKey: `test-key-${i}`,
          chainId: i.toString() as ChainId,
          networkId: "development",
        }));
      vi.mocked(submit).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submitAll();

      expect(submit).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("submitAndListen", () => {
    it("should call submitAndListen for single chain", async () => {
      const { submitAndListen } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { status: "success", data: "Transfer completed" };
      vi.mocked(submitAndListen).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submitAndListen("1");

      expect(submitAndListen).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call submitAndListen for multiple chains", async () => {
      const { submitAndListen } = await import("@pact-toolbox/chainweb-client");
      const mockResult = [
        { status: "success", data: "Transfer completed" },
        { status: "success", data: "Transfer completed" },
      ];
      vi.mocked(submitAndListen).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submitAndListen(["1", "2"]);

      expect(submitAndListen).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it("should call submitAndListen with preflight", async () => {
      const { submitAndListen } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { status: "success", data: "Transfer completed" };
      vi.mocked(submitAndListen).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submitAndListen("1", true);

      expect(submitAndListen).toHaveBeenCalledWith(
        expect.any(Object), // client
        expect.any(Object), // transaction
        true, // preflight
      );
      expect(result).toEqual(mockResult);
    });

    it("should call submitAndListenAll for all chains", async () => {
      const { submitAndListen } = await import("@pact-toolbox/chainweb-client");
      const mockResult = Array(20).fill({ status: "success", data: "Transfer completed" });
      vi.mocked(submitAndListen).mockResolvedValue(mockResult);

      const builder = execution('(coin.transfer "alice" "bob" 10.0)');
      const dispatcher = builder.build();

      const result = await dispatcher.submitAndListenAll();

      expect(submitAndListen).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("getSignedTransaction", () => {
    it("should return signed transaction", async () => {
      const mockTransaction: Transaction = {
        cmd: "test-cmd",
        hash: "test-hash",
        sigs: [{ sig: "test-sig" }],
      };

      const builder = execution('(coin.get-balance "alice")');
      // Mock the internal builder method
      vi.spyOn(builder, "getPartialTransaction").mockResolvedValue(mockTransaction);

      const dispatcher = builder.build();
      const result = await dispatcher.getSignedTransaction();

      expect(result).toEqual(mockTransaction);
    });
  });

  describe("error handling", () => {
    it("should throw error when no network config is found", () => {
      // Test context creation failure with invalid configuration
      expect(() => {
        createToolboxNetworkContext({
          default: "invalid",
          environment: "development",
          configs: {},
        });
      }).toThrow("No network config found");
    });
  });

  describe("custom client", () => {
    it("should use provided client instead of context client", async () => {
      const { dirtyReadOrFail } = await import("@pact-toolbox/chainweb-client");
      const mockResult = { balance: "100.0" };
      vi.mocked(dirtyReadOrFail).mockResolvedValue(mockResult);

      const customClient = {
        local: vi.fn(),
        send: vi.fn(),
        listen: vi.fn(),
      } as any;

      const builder = execution('(coin.get-balance "alice")');
      const dispatcher = builder.build();

      await dispatcher.dirtyRead("1", customClient);

      expect(dirtyReadOrFail).toHaveBeenCalledWith(customClient, expect.any(Object));
    });
  });
});
