import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { Mock } from "node:test";

import type { MakeBlocksParams } from "./chainwebApi";
import { didMakeBlocks, isChainWebAtHeight, isChainWebNodeOk, makeBlocks } from "./chainwebApi";
import { logger } from "./logger";

// Mock the logger to prevent actual logging during tests
logger.mockTypes(() => mock.fn());

describe("chainwebApi", () => {
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    fetchMock = mock.fn();
    // Use mock.method to mock global.fetch with proper typing
    mock.method(globalThis as any, "fetch", fetchMock);
  });

  afterEach(() => {
    // Restore the original fetch function
    fetchMock.mock.restore();
  });

  describe("isChainWebNodeOk", () => {
    it("returns true when health check passes", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response("Health check OK.", { status: 200, statusText: "OK" })),
      );

      const result = await isChainWebNodeOk("http://example.com");

      assert.strictEqual(result, true);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(fetchMock.mock.calls[0]?.arguments[0], "http://example.com/health-check");
    });

    it("returns false when health check response is not ok", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(
          new Response("Service unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          }),
        ),
      );

      const result = await isChainWebNodeOk("http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when health check response does not contain expected message", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response("Some other message", { status: 200, statusText: "OK" })),
      );

      const result = await isChainWebNodeOk("http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when fetch throws an error", async () => {
      fetchMock.mock.mockImplementation(() => Promise.reject(new Error("Network error")));

      const result = await isChainWebNodeOk("http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });
  });

  describe("isChainWebAtHeight", () => {
    it("returns true when height is greater than or equal to targetHeight", async () => {
      const mockResponse = { height: 100 };

      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200, statusText: "OK" })),
      );

      const result = await isChainWebAtHeight(50, "http://example.com");

      assert.strictEqual(result, true);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(fetchMock.mock.calls[0]?.arguments[0], "http://example.com/chainweb/0.0/development/cut");
    });

    it("returns false when height is less than targetHeight", async () => {
      const mockResponse = { height: 40 };

      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200, statusText: "OK" })),
      );

      const result = await isChainWebAtHeight(50, "http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when response is not ok", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(
          new Response("Service unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          }),
        ),
      );

      const result = await isChainWebAtHeight(50, "http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when response is not valid JSON", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response("Invalid JSON", { status: 200, statusText: "OK" })),
      );

      const result = await isChainWebAtHeight(50, "http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when fetch throws an error", async () => {
      fetchMock.mock.mockImplementation(() => Promise.reject(new Error("Network error")));

      const result = await isChainWebAtHeight(50, "http://example.com");

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });
  });

  describe("makeBlocks", () => {
    it("successfully makes blocks", async () => {
      const mockResponseData = { success: true };

      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponseData), { status: 200, statusText: "OK" })),
      );

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await makeBlocks(params);

      assert.deepEqual(result, mockResponseData);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
      assert.strictEqual(fetchMock.mock.calls[0]?.arguments[0], "http://example.com/make-blocks");
    });

    it("throws an error when response is not ok", async () => {
      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(
          new Response("Service unavailable", {
            status: 500,
            statusText: "Internal Server Error",
          }),
        ),
      );

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      await assert.rejects(async () => {
        await makeBlocks(params);
      }, /Failed to make blocks 500 Internal Server Error/);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("throws an error when fetch throws an error", async () => {
      fetchMock.mock.mockImplementation(() => Promise.reject(new Error("Network error")));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      await assert.rejects(async () => {
        await makeBlocks(params);
      }, /Network error/);

      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });
  });

  describe("didMakeBlocks", () => {
    it("returns true when makeBlocks succeeds", async () => {
      const mockResponseData = { success: true };

      fetchMock.mock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponseData), { status: 200, statusText: "OK" })),
      );

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await didMakeBlocks(params);

      assert.strictEqual(result, true);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns false when makeBlocks throws an error", async () => {
      fetchMock.mock.mockImplementation(() => Promise.reject(new Error("Network error")));

      const params: MakeBlocksParams = {
        count: 2,
        chainIds: ["0", "1"],
        onDemandUrl: "http://example.com",
      };

      const result = await didMakeBlocks(params);

      assert.strictEqual(result, false);
      assert.strictEqual(fetchMock.mock.calls.length, 1);
    });
  });
});
