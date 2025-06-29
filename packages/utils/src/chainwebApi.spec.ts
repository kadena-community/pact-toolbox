import { describe, it, expect, beforeEach, vi } from "vitest";

import type { MakeBlocksParams } from "./chainwebApi";
import { didMakeBlocks, isChainWebAtHeight, isChainWebNodeOk, makeBlocks } from "./chainwebApi";

describe("chainwebApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isChainWebNodeOk", () => {
    it("returns true when health check passes", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("Health check OK.", { status: 200, statusText: "OK" }));

      const result = await isChainWebNodeOk("http://example.com");

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("http://example.com/health-check", expect.any(Object));
    });

    it("returns false when health check response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Service unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      );

      const result = await isChainWebNodeOk("http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when health check response does not contain expected message", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("Some other message", { status: 200, statusText: "OK" }));

      const result = await isChainWebNodeOk("http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when fetch throws an error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await isChainWebNodeOk("http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("respects timeout parameter", async () => {
      const abortSpy = vi.fn();
      global.AbortController = vi.fn().mockImplementation(() => ({
        abort: abortSpy,
        signal: {},
      }));

      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      // Start the request but don't await it yet
      isChainWebNodeOk("http://example.com", 100);

      // Wait a bit to let the timeout trigger
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe("isChainWebAtHeight", () => {
    it("returns true when height is greater than or equal to targetHeight", async () => {
      const mockResponse = { height: 100 };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200, statusText: "OK" }));

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("http://example.com/chainweb/0.0/development/cut", expect.any(Object));
    });

    it("returns false when height is less than targetHeight", async () => {
      const mockResponse = { height: 40 };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200, statusText: "OK" }));

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Service unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      );

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when response has invalid height data", async () => {
      const mockResponse = { notHeight: "invalid" };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200, statusText: "OK" }));

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when response is not valid JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response("Invalid JSON", { status: 200, statusText: "OK" }));

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when fetch throws an error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await isChainWebAtHeight(50, "http://example.com");

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("makeBlocks", () => {
    it("successfully makes blocks with default parameters", async () => {
      const mockResponseData = { success: true };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponseData), { status: 200, statusText: "OK" }));

      const params: MakeBlocksParams = {
        onDemandUrl: "http://example.com",
      };

      const result = await makeBlocks(params);

      expect(result).toEqual(mockResponseData);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "http://example.com/make-blocks",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "0": 1 }),
        }),
      );
    });

    it("successfully makes blocks with custom parameters", async () => {
      const mockResponseData = { success: true };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponseData), { status: 200, statusText: "OK" }));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await makeBlocks(params);

      expect(result).toEqual(mockResponseData);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "http://example.com/make-blocks",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "0": 2, "1": 2 }),
        }),
      );
    });

    it("throws an error when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Service unavailable", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      await expect(makeBlocks(params)).rejects.toThrow("Failed to make blocks 500 Internal Server Error");

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("throws an error when fetch throws an error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      await expect(makeBlocks(params)).rejects.toThrow("Network error");

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("didMakeBlocks", () => {
    it("returns true when makeBlocks succeeds", async () => {
      const mockResponseData = { success: true };

      global.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponseData), { status: 200, statusText: "OK" }));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await didMakeBlocks(params);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns false when makeBlocks throws an error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await didMakeBlocks(params);

      expect(result).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
