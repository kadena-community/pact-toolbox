import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChainwebClient } from "./client";
import { ChainwebClientError } from "./types";
import type { NetworkConfig, SignedTransaction } from "./types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock signed transaction for testing
const mockSignedTransaction: SignedTransaction = {
  hash: "test-hash-123",
  sigs: [{ sig: "test-signature" }],
  cmd: "test-command",
};

describe("ChainwebClient", () => {
  let client: ChainwebClient;
  const config: NetworkConfig = {
    networkId: "testnet04",
    chainId: "0",
    rpcUrl: (networkId, chainId) =>
      `https://api.testnet.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    timeout: 1000,
  };

  beforeEach(() => {
    client = new ChainwebClient(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with default values", () => {
      const minimalConfig = {
        networkId: "development",
        chainId: "0",
        rpcUrl: (networkId: string, chainId: string) =>
          `http://localhost:8080/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
      };

      const testClient = new ChainwebClient(minimalConfig);
      expect(testClient).toBeDefined();
    });

    it("should merge provided config with defaults", () => {
      const customConfig = {
        networkId: "mainnet01",
        chainId: "1",
        rpcUrl: (networkId: string, chainId: string) =>
          `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
        timeout: 60000,
        headers: { "X-Custom": "test" },
      };

      const testClient = new ChainwebClient(customConfig);
      expect(testClient).toBeDefined();
    });
  });

  describe("send", () => {
    it("should send transactions successfully", async () => {
      const mockResponse = {
        requestKeys: ["req-key-1", "req-key-2"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.send([mockSignedTransaction, mockSignedTransaction]);

      expect(result).toEqual({
        requestKeys: ["req-key-1", "req-key-2"],
        response: mockResponse,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/send"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining('"cmds"'),
        }),
      );
    });

    it("should throw error for invalid response", async () => {
      const mockResponse = { invalid: "response" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      await expect(client.send([mockSignedTransaction])).rejects.toThrow(ChainwebClientError);
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      try {
        await client.send([mockSignedTransaction]);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ChainwebClientError);
        expect((error as ChainwebClientError).code).toBe("HTTP_ERROR");
        expect((error as ChainwebClientError).status).toBe(500);
      }
    });
  });

  describe("poll", () => {
    it("should poll for transaction results", async () => {
      const mockResponse = {
        "req-key-1": {
          reqKey: "req-key-1",
          result: { status: "success", data: "test-result" },
          gas: 1000,
          logs: "test-logs",
          events: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.poll(["req-key-1"]);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/poll"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ requestKeys: ["req-key-1"] }),
        }),
      );
    });

    it("should throw error for empty request keys", async () => {
      await expect(client.poll([])).rejects.toThrow(ChainwebClientError);
    });
  });

  describe("listen", () => {
    it("should listen for single transaction result", async () => {
      const mockResponse = {
        reqKey: "req-key-1",
        result: { status: "success", data: "test-result" },
        gas: 1000,
        logs: "test-logs",
        events: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listen("req-key-1");

      expect(result).toEqual({
        requestKey: "req-key-1",
        result: mockResponse,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/listen"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ listen: "req-key-1" }),
        }),
      );
    });

    it("should throw error for empty request key", async () => {
      await expect(client.listen("")).rejects.toThrow(ChainwebClientError);
    });
  });

  describe("local", () => {
    it("should execute local queries", async () => {
      const mockResponse = {
        result: { status: "success", data: "local-result" },
        gas: 500,
        logs: "local-logs",
        events: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      const command = { cmd: "test-command" };
      const result = await client.local(command);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/local"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(command),
        }),
      );
    });

    it("should use custom rpcUrl function", async () => {
      const clientWithCustomUrl = new ChainwebClient({
        ...config,
        rpcUrl: (networkId, chainId) =>
          `https://custom.example.com/chainweb/0.0/${networkId}/chain/${chainId}/pact`,
      });

      const mockResponse = {
        result: { status: "success", data: "local-result" },
        gas: 500,
        logs: "local-logs",
        events: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([["content-type", "application/json"]]),
      });

      await clientWithCustomUrl.local({ cmd: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.example.com/chainweb/0.0/testnet04/chain/0/pact/api/v1/local", 
        expect.any(Object)
      );
    });
  });

  describe("submitAndWait", () => {
    it("should submit transaction and wait for result", async () => {
      // Mock send response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requestKeys: ["req-key-1"] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      // Mock poll response
      const mockResult = {
        reqKey: "req-key-1",
        result: { status: "success", data: "test-result" },
        gas: 1000,
        logs: "test-logs",
        events: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ "req-key-1": mockResult }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.submitAndWait(mockSignedTransaction, 100);

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("submitBatch", () => {
    it("should process empty transaction array", async () => {
      const result = await client.submitBatch([]);
      
      expect(result).toEqual({
        successes: [],
        failures: [],
        total: 0,
        successCount: 0,
        failureCount: 0,
      });
    });

    it("should handle batch processing errors gracefully", async () => {
      const transactions = [mockSignedTransaction, mockSignedTransaction];

      // Mock failed request
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.submitBatch(transactions, { batchSize: 2 });

      expect(result.total).toBe(2);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
      expect(result.failures).toHaveLength(2);
    });
  });

  describe("healthCheck", () => {
    it("should return healthy status for successful requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeTypeOf("number");
    });

    it("should return unhealthy status for failed requests", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details?.['error']).toBe("Network error");
    });
  });

  describe("utility methods", () => {
    it("should create client for different chain", () => {
      const newClient = client.forChain("5");
      expect(newClient).not.toBe(client);
    });

    it("should create client for different network", () => {
      const newClient = client.forNetwork("mainnet01");
      expect(newClient).not.toBe(client);
    });

    it("should create client with custom config", () => {
      const newClient = client.withConfig({ timeout: 60000 });
      expect(newClient).not.toBe(client);
    });
  });

  describe("error handling", () => {
    it("should handle timeout errors", async () => {
      // Mock AbortError
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      try {
        await client.send([mockSignedTransaction]);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ChainwebClientError);
        expect((error as ChainwebClientError).code).toBe("TIMEOUT");
      }
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failed"));

      try {
        await client.send([mockSignedTransaction]);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ChainwebClientError);
        expect((error as ChainwebClientError).code).toBe("NETWORK_ERROR");
      }
    });
  });
});

describe("ChainwebClientError", () => {
  it("should create network error", () => {
    const error = ChainwebClientError.network("Network failed");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Network failed");
  });

  it("should create timeout error", () => {
    const error = ChainwebClientError.timeout(5000);
    expect(error.code).toBe("TIMEOUT");
    expect(error.message).toContain("5000ms");
  });

  it("should create HTTP error", () => {
    const error = ChainwebClientError.http(404, "Not Found", "response");
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.status).toBe(404);
    expect(error.response).toBe("response");
  });

  it("should create parse error", () => {
    const error = ChainwebClientError.parse("Invalid JSON");
    expect(error.code).toBe("PARSE_ERROR");
    expect(error.message).toBe("Invalid JSON");
  });

  it("should create validation error", () => {
    const error = ChainwebClientError.validation("Invalid input");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid input");
  });

  it("should create transaction error", () => {
    const error = ChainwebClientError.transaction("Transaction failed", "req-key-1");
    expect(error.code).toBe("TRANSACTION_ERROR");
    expect(error.response?.requestKey).toBe("req-key-1");
  });

  it("should create error from unknown error", () => {
    const error = ChainwebClientError.from(new Error("Test error"), "Context");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Context: Test error");
  });

  it("should handle ChainwebClientError instances", () => {
    const originalError = ChainwebClientError.validation("Original error");
    const error = ChainwebClientError.from(originalError);
    expect(error).toBe(originalError);
  });
});