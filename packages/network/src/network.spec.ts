import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PactToolboxConfigObj } from "@pact-toolbox/config";

// Mock first before imports
vi.mock("@pact-toolbox/config");
vi.mock("@pact-toolbox/prelude");
vi.mock("@pact-toolbox/runtime");
vi.mock("@pact-toolbox/node-utils");
vi.mock("@pact-toolbox/utils");
vi.mock("./networks/pactServer");
vi.mock("./networks/devnet");

import { PactToolboxNetwork, createNetwork } from "./network";
import * as configModule from "@pact-toolbox/config";
import * as preludeModule from "@pact-toolbox/prelude";
import * as nodeUtilsModule from "@pact-toolbox/node-utils";
import * as utilsModule from "@pact-toolbox/utils";
import { PactServerNetwork } from "./networks/pactServer";
import { DevNetNetwork } from "./networks/devnet";

const mockPactServerInstance = {
  id: "pact-server-id",
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  isHealthy: vi.fn().mockResolvedValue(true),
  getPort: vi.fn().mockReturnValue(8080),
  getRpcUrl: vi.fn().mockReturnValue("http://localhost:8080"),
  hasOnDemandMining: vi.fn().mockReturnValue(false),
  getMiningUrl: vi.fn().mockReturnValue(null),
};

const mockDevNetInstance = {
  id: "devnet-id",
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  isHealthy: vi.fn().mockResolvedValue(true),
  getPort: vi.fn().mockReturnValue(8080),
  getRpcUrl: vi.fn().mockReturnValue("http://localhost:8080"),
  hasOnDemandMining: vi.fn().mockReturnValue(true),
  getMiningUrl: vi.fn().mockReturnValue("http://localhost:8080"),
};

describe("PactToolboxNetwork", () => {
  const mockConfig: PactToolboxConfigObj = {
    networks: {
      local: {
        name: "local",
        type: "pact-server",
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "test-account",
        keyPairs: [],
        keysets: {},
        meta: {},
      } as any,
    },
    defaultNetwork: "local",
  };

  const mockNetworkConfig: any = {
    name: "local",
    type: "pact-server" as const,
    networkId: "development",
    rpcUrl: "http://localhost:8080",
    senderAccount: "test-account",
    keyPairs: [],
    keysets: {},
    meta: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    vi.mocked(configModule.getDefaultNetworkConfig).mockReturnValue(mockNetworkConfig);
    vi.mocked(configModule.isLocalNetwork).mockReturnValue(true);
    vi.mocked(configModule.isPactServerNetworkConfig).mockReturnValue(true);
    vi.mocked(configModule.isDevNetworkConfig).mockReturnValue(false);

    vi.mocked(utilsModule.getUuid).mockReturnValue("test-uuid");

    vi.mocked(nodeUtilsModule.logger).info = vi.fn() as any;
    vi.mocked(nodeUtilsModule.logger).error = vi.fn() as any;
    vi.mocked(nodeUtilsModule.logger).success = vi.fn() as any;
    vi.mocked(nodeUtilsModule.logger).log = vi.fn() as any;

    vi.mocked(PactServerNetwork).mockImplementation(() => mockPactServerInstance as any);
    vi.mocked(DevNetNetwork).mockImplementation(() => mockDevNetInstance as any);
  });

  describe("constructor", () => {
    it("should create a network instance with valid config", () => {
      const network = new PactToolboxNetwork(mockConfig);
      expect(network).toBeDefined();
      expect(network.id).toBe("test-uuid");
    });

    it("should throw error if no networks defined", () => {
      expect(() => new PactToolboxNetwork({ networks: {}, defaultNetwork: "local" } as any)).toThrow(
        "No networks defined in configuration",
      );
    });

    it("should throw error if network not found", () => {
      vi.mocked(configModule.getDefaultNetworkConfig).mockReturnValue(null as any);

      expect(() => new PactToolboxNetwork(mockConfig, { network: "invalid" })).toThrow("Network not found");
    });

    it("should throw error if network is not local", () => {
      vi.mocked(configModule.isLocalNetwork).mockReturnValue(false);

      expect(() => new PactToolboxNetwork(mockConfig)).toThrow("is not a local network");
    });
  });

  describe("start", () => {
    it("should start the network successfully", async () => {
      const network = new PactToolboxNetwork(mockConfig);
      await network.start();

      expect(network.getRpcUrl()).toBe("http://localhost:8080");
      expect(network.getPort()).toBe(8080);
    });

    it("should handle preludes if configured", async () => {
      const configWithPreludes = {
        ...mockConfig,
        downloadPreludes: true,
        deployPreludes: true,
        preludes: ["kadena/coin" as any],
      };

      const network = new PactToolboxNetwork(configWithPreludes);
      await network.start();

      expect(preludeModule.downloadAllPreludes).toHaveBeenCalled();
      expect(preludeModule.deployPreludes).toHaveBeenCalled();
    });

    it("should log accounts if requested", async () => {
      const configWithAccounts = {
        ...mockConfig,
        networks: {
          local: {
            ...mockNetworkConfig,
            keyPairs: [
              {
                account: "test-account",
                publicKey: "public-key",
                secretKey: "secret-key",
              },
            ],
          },
        },
      };

      // Make sure getDefaultNetworkConfig returns the config with keyPairs
      vi.mocked(configModule.getDefaultNetworkConfig).mockReturnValue({
        ...mockNetworkConfig,
        keyPairs: [
          {
            account: "test-account",
            publicKey: "public-key",
            secretKey: "secret-key",
          },
        ],
      } as any);

      const network = new PactToolboxNetwork(configWithAccounts);
      await network.start({ logAccounts: true } as any);

      expect(nodeUtilsModule.logger.log).toHaveBeenCalledWith(expect.stringContaining("Network Accounts:"));
    });
  });

  describe("network operations", () => {
    it("should stop the network", async () => {
      const network = new PactToolboxNetwork(mockConfig);
      await network.stop();
      expect(mockPactServerInstance.stop).toHaveBeenCalled();
    });

    it("should restart the network", async () => {
      const network = new PactToolboxNetwork(mockConfig);
      await network.restart();
      expect(mockPactServerInstance.stop).toHaveBeenCalled();
      expect(mockPactServerInstance.start).toHaveBeenCalled();
    });

    it("should check network health", async () => {
      const network = new PactToolboxNetwork(mockConfig);
      const healthy = await network.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe("getters", () => {
    it("should return network information", () => {
      const network = new PactToolboxNetwork(mockConfig);

      expect(network.getPort()).toBe(8080);
      expect(network.getRpcUrl()).toBe("http://localhost:8080");
      expect(network.hasOnDemandMining()).toBe(false);
      expect(network.getMiningUrl()).toBe(null);
      expect(network.getNetworkName()).toBe("local");
      expect(network.getNetworkConfig()).toEqual(mockNetworkConfig);
    });
  });

  describe("DevNet network", () => {
    beforeEach(() => {
      vi.mocked(configModule.isPactServerNetworkConfig).mockReturnValue(false);
      vi.mocked(configModule.isDevNetworkConfig).mockReturnValue(true);
    });

    it("should create DevNet network", () => {
      const network = new PactToolboxNetwork(mockConfig);
      expect(network.hasOnDemandMining()).toBe(true);
      expect(network.getMiningUrl()).toBe("http://localhost:8080");
    });
  });
});

describe("createNetwork", () => {
  const mockConfig: PactToolboxConfigObj = {
    networks: {
      local: {
        name: "local",
        type: "pact-server",
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "test-account",
        keyPairs: [],
        keysets: {},
        meta: {},
      } as any,
    },
    defaultNetwork: "local",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(configModule.getDefaultNetworkConfig).mockReturnValue({
      name: "local",
      type: "pact-server",
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      senderAccount: "test-account",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    } as any);
    vi.mocked(configModule.isLocalNetwork).mockReturnValue(true);
    vi.mocked(configModule.isPactServerNetworkConfig).mockReturnValue(true);
    vi.mocked(utilsModule.getUuid).mockReturnValue("test-uuid");
    vi.mocked(PactServerNetwork).mockImplementation(() => mockPactServerInstance as any);
  });

  it("should create and auto-start network by default", async () => {
    const network = await createNetwork(mockConfig);
    expect(network).toBeDefined();
    expect(network.getRpcUrl()).toBe("http://localhost:8080");
  });

  it("should not auto-start if autoStart is false", async () => {
    const network = await createNetwork(mockConfig, { autoStart: false });
    expect(network).toBeDefined();
    expect(mockPactServerInstance.start).not.toHaveBeenCalled();
  });
});
