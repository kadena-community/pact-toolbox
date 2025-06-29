import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PactServerNetworkConfig } from "@pact-toolbox/config";

// Mock first before imports
vi.mock("node:fs/promises");
vi.mock("pathe");
vi.mock("@pact-toolbox/config");
vi.mock("@pact-toolbox/node-utils");
vi.mock("@pact-toolbox/utils");

import { PactServerNetwork } from "./pactServer";
import * as fs from "node:fs/promises";
import * as pathe from "pathe";
import * as configModule from "@pact-toolbox/config";
import * as nodeUtils from "@pact-toolbox/node-utils";
import * as utils from "@pact-toolbox/utils";

// Mock fetch
(globalThis as any).fetch = vi.fn();

describe("PactServerNetwork", () => {
  const mockNetworkConfig: PactServerNetworkConfig = {
    type: "pact-server",
    networkId: "test",
    name: "test-server",
    rpcUrl: "http://localhost:8080",
    serverConfig: {
      port: 8080,
    },
    senderAccount: "test-account",
    keyPairs: [],
    keysets: {},
    meta: {
      chainId: "0",
    },
  };

  const mockClient = {};
  const mockLogger = {
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ((globalThis as any).fetch as any).mockResolvedValue({ ok: true });

    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(pathe.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(configModule.createPactServerConfig).mockReturnValue({
      port: 8080,
      logDir: "logs",
      persistDir: "db",
    } as any);
    vi.mocked(nodeUtils.getCurrentPactVersion).mockResolvedValue("1.0.0");
    vi.mocked(nodeUtils.isAnyPactInstalled).mockResolvedValue(true);
    vi.mocked(nodeUtils.runBin).mockResolvedValue({ kill: vi.fn() } as any);
    vi.mocked(nodeUtils.writeFile).mockResolvedValue(undefined);
    vi.mocked(utils.getUuid).mockReturnValue("test-uuid");
    vi.mocked(utils.pollFn).mockResolvedValue(undefined);
    Object.assign(nodeUtils.logger, mockLogger);
  });

  describe("constructor", () => {
    it("should create instance with valid config", () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      expect(network).toBeDefined();
      expect(network.id).toBe("test-uuid");
    });

    it("should throw error for invalid port", () => {
      vi.mocked(configModule.createPactServerConfig).mockReturnValue({
        port: 70000, // Above valid range
        logDir: "logs",
        persistDir: "db",
      } as any);

      expect(() => new PactServerNetwork(mockNetworkConfig, mockClient as any)).toThrow("Invalid port: 70000");
    });

    it("should use custom logger", () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any, mockLogger as any);
      expect(network).toBeDefined();
    });
  });

  describe("start", () => {
    it("should start pact server successfully", async () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      // Mock isHealthy to return false so start logic proceeds
      vi.spyOn(network, "isHealthy").mockResolvedValue(false);

      await network.start();

      expect(nodeUtils.writeFile).toHaveBeenCalled();
      expect(nodeUtils.runBin).toHaveBeenCalledWith("pact", ["-s", expect.any(String)], {
        silent: true,
      });
    });

    it("should skip if already running", async () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      vi.spyOn(network, "isHealthy").mockResolvedValue(true);

      await network.start();

      expect(nodeUtils.runBin).not.toHaveBeenCalled();
    });

    it("should throw error if pact not installed", async () => {
      vi.mocked(nodeUtils.isAnyPactInstalled).mockResolvedValue(false);

      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      // Mock isHealthy to return false so start logic proceeds
      vi.spyOn(network, "isHealthy").mockResolvedValue(false);

      await expect(network.start()).rejects.toThrow("Pact is not installed");
    });

    it("should handle stateless mode", async () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      // Mock isHealthy to return false so start logic proceeds
      vi.spyOn(network, "isHealthy").mockResolvedValue(false);

      await network.start({ stateless: true });

      const writeCall = vi.mocked(nodeUtils.writeFile).mock.calls[0];
      expect(writeCall?.[0]).toContain("pact-config-test-uuid.yaml");
    });
  });

  describe("stop", () => {
    it("should stop the server and cleanup", async () => {
      const mockProcess = { kill: vi.fn() };
      vi.mocked(nodeUtils.runBin).mockResolvedValue(mockProcess as any);

      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      // Mock isHealthy to return false so start logic proceeds
      vi.spyOn(network, "isHealthy").mockResolvedValue(false);

      await network.start();
      await network.stop();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(fs.rm).toHaveBeenCalled();
    });
  });

  describe("restart", () => {
    it("should stop and start the server", async () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      const stopSpy = vi.spyOn(network, "stop");
      const startSpy = vi.spyOn(network, "start");

      await network.restart();

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("isHealthy", () => {
    it("should return true for healthy server", async () => {
      ((globalThis as any).fetch as any).mockResolvedValue({ ok: true });

      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      const healthy = await network.isHealthy();

      expect(healthy).toBe(true);
      expect((globalThis as any).fetch).toHaveBeenCalledWith("http://localhost:8080/version");
    });

    it("should return false for unhealthy server", async () => {
      ((globalThis as any).fetch as any).mockResolvedValue({ ok: false });

      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      const healthy = await network.isHealthy();

      expect(healthy).toBe(false);
    });

    it("should return false on error", async () => {
      ((globalThis as any).fetch as any).mockRejectedValue(new Error("Network error"));

      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);
      const healthy = await network.isHealthy();

      expect(healthy).toBe(false);
    });
  });

  describe("getters", () => {
    it("should return correct values", () => {
      const network = new PactServerNetwork(mockNetworkConfig, mockClient as any);

      expect(network.getPort()).toBe(8080);
      expect(network.getRpcUrl()).toBe("http://localhost:8080");
      expect(network.hasOnDemandMining()).toBe(false);
      expect(network.getMiningUrl()).toBe(null);
    });
  });
});
