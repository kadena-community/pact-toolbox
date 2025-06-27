import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DevNetworkConfig } from "@pact-toolbox/config";

// Mock first before imports
vi.mock("@pact-toolbox/docker");
vi.mock("node:fs/promises");
vi.mock("pathe");
vi.mock("@pact-toolbox/node-utils");
vi.mock("@pact-toolbox/utils");
vi.mock("../config/constants");
vi.mock("../config/fileTemplates");
vi.mock("../presets/minimal");
vi.mock("../utils");

import { DevNetNetwork } from "./devnet";
import * as docker from "@pact-toolbox/docker";
import * as fs from "node:fs/promises";
import * as pathe from "pathe";
import * as nodeUtils from "@pact-toolbox/node-utils";
import * as utils from "@pact-toolbox/utils";
import * as minimal from "../presets/minimal";
import * as networkUtils from "../utils";

describe("DevNetNetwork", () => {
  const mockNetworkConfig: DevNetworkConfig = {
    type: "chainweb-devnet",
    networkId: "test",
    name: "test-devnet",
    rpcUrl: "http://localhost:8080",
    containerConfig: {
      port: 8080,
      onDemandMining: true,
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

  const mockOrchestrator = {
    startServices: vi.fn(),
    stopAllServices: vi.fn(),
    streamAllLogs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(docker.ContainerOrchestrator).mockImplementation(() => mockOrchestrator as any);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(pathe.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(nodeUtils.ensureDir).mockResolvedValue(undefined);
    vi.mocked(nodeUtils.writeFile).mockResolvedValue(undefined);
    // Mock logger instead of assigning to non-existent property
    vi.mocked(nodeUtils.logger).info = mockLogger.info as any;
    vi.mocked(nodeUtils.logger).success = mockLogger.success as any;
    vi.mocked(nodeUtils.logger).debug = mockLogger.debug as any;
    vi.mocked(utils.getUuid).mockReturnValue("test-uuid");
    vi.mocked(utils.isChainWebAtHeight).mockResolvedValue(true);
    vi.mocked(utils.isChainWebNodeOk).mockResolvedValue(true);
    vi.mocked(utils.pollFn).mockImplementation(async (fn) => {
      const result = await fn();
      if (!result) throw new Error("Poll failed");
    });
    vi.mocked(minimal.createMinimalDevNet).mockReturnValue({
      networkName: "test-network",
      volumes: ["volume1"],
      services: {
        service1: { name: "service1" },
        service2: { name: "service2" },
      },
    } as any);
    vi.mocked(networkUtils.ensureCertificates).mockResolvedValue(undefined);
  });

  describe("constructor", () => {
    it("should create instance with valid config", () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      expect(network).toBeDefined();
      expect(network.id).toBe("test-uuid");
    });

    it("should throw error for invalid port", () => {
      const invalidConfig = {
        ...mockNetworkConfig,
        containerConfig: { port: 0 },
      };
      
      expect(() => new DevNetNetwork(invalidConfig, mockClient as any)).toThrow(
        "Invalid port: 0"
      );
    });

    it("should use custom logger", () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any, mockLogger as any);
      expect(network).toBeDefined();
    });
  });

  describe("start", () => {
    it("should start devnet successfully", async () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      await network.start();
      
      expect(nodeUtils.ensureDir).toHaveBeenCalled();
      expect(nodeUtils.writeFile).toHaveBeenCalledTimes(3); // common, logging, nginx
      expect(mockOrchestrator.startServices).toHaveBeenCalled();
    });

    it("should handle stateless mode", async () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      await network.start({ stateless: true });
      
      // Stateless mode should have been set up with persistDb: false
      expect(minimal.createMinimalDevNet).toHaveBeenCalledWith(
        expect.objectContaining({
          networkName: "devnet-test-uuid-network",
          persistDb: false,
        })
      );
    });

    it("should stream logs if not detached", async () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      await network.start({ detached: false });
      
      expect(mockOrchestrator.streamAllLogs).toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("should stop devnet and cleanup", async () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      await network.stop();
      
      expect(mockOrchestrator.stopAllServices).toHaveBeenCalled();
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining(".pact-toolbox/configs"), { recursive: true, force: true });
    });
  });

  describe("restart", () => {
    it("should stop and start devnet", async () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      const stopSpy = vi.spyOn(network, "stop");
      const startSpy = vi.spyOn(network, "start");
      
      await network.restart();
      
      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("isHealthy", () => {
    it("should return true for healthy network", async () => {
      vi.mocked(utils.isChainWebNodeOk).mockResolvedValue(true);
      
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      const healthy = await network.isHealthy();
      
      expect(healthy).toBe(true);
      expect(utils.isChainWebNodeOk).toHaveBeenCalledWith("http://localhost:8080");
    });

    it("should return false for unhealthy network", async () => {
      vi.mocked(utils.isChainWebNodeOk).mockRejectedValue(new Error("Network error"));
      
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      const healthy = await network.isHealthy();
      
      expect(healthy).toBe(false);
    });
  });

  describe("getters", () => {
    it("should return correct values with on-demand mining", () => {
      const network = new DevNetNetwork(mockNetworkConfig, mockClient as any);
      
      expect(network.getPort()).toBe(8080);
      expect(network.getRpcUrl()).toBe("http://localhost:8080");
      expect(network.hasOnDemandMining()).toBe(true);
      expect(network.getMiningUrl()).toBe("http://localhost:8080");
    });

    it("should return null mining URL without on-demand mining", () => {
      const configWithoutMining = {
        ...mockNetworkConfig,
        containerConfig: {
          port: 8080,
          onDemandMining: false,
        },
      };
      
      const network = new DevNetNetwork(configWithoutMining, mockClient as any);
      expect(network.hasOnDemandMining()).toBe(false);
      expect(network.getMiningUrl()).toBe(null);
    });

    it("should use default port if not specified", () => {
      const configWithoutPort = {
        ...mockNetworkConfig,
        containerConfig: {},
      };
      
      const network = new DevNetNetwork(configWithoutPort, mockClient as any);
      expect(network.getPort()).toBe(8080); // DEVNET_PUBLIC_PORT
    });
  });
});