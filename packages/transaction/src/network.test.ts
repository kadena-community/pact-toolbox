import type { MultiNetworkConfig } from "@pact-toolbox/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolboxNetworkContext, createToolboxNetworkContext, getGlobalNetworkContext } from "./network";

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
    mainnet: {
      type: "chainweb",
      networkId: "mainnet01",
      rpcUrl: "https://api.chainweb.com",
      senderAccount: "main-account",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
      name: "mainnet",
    },
  },
  environment: "development",
};

describe("ToolboxNetworkContext", () => {
  beforeEach(() => {
    // Mock the global networks configuration
    (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = mockMultiNetworkConfig;

    // Clear any existing global context
    (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__ = null;
  });

  afterEach(() => {
    // Cleanup global state
    delete (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
    delete (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__;
  });

  describe("Context Creation", () => {
    it("should create context with default network", () => {
      const context = createToolboxNetworkContext();

      expect(context.getCurrentNetworkConfig().name).toBe("pactServer");
      expect(context.getNetworkId()).toBe("development");
      expect(context.getNetworkType()).toBe("pact-server");
    });

    it("should create context with specific network configs", () => {
      const context = createToolboxNetworkContext(mockMultiNetworkConfig);

      expect(context.getCurrentNetworkConfig().name).toBe("pactServer");
      expect(context.getNetworkId()).toBe("development");
      expect(context.getNetworkType()).toBe("pact-server");
    });

    it("should set global context when requested", () => {
      const context = createToolboxNetworkContext(undefined, true);
      const globalContext = getGlobalNetworkContext();

      expect(context).toBe(globalContext);
      expect((globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__).toBe(context);
    });
  });

  describe("Network Information", () => {
    let context: ToolboxNetworkContext;

    beforeEach(() => {
      context = createToolboxNetworkContext();
    });

    it("should return available networks", () => {
      const networks = context.getAvailableNetworks();
      expect(networks).toEqual(["pactServer", "testnet", "mainnet"]);
    });

    it("should identify local networks correctly", () => {
      expect(context.isLocalNetwork()).toBe(true);

      const testnetContext = createToolboxNetworkContext({
        ...mockMultiNetworkConfig,
        default: "testnet",
      });
      expect(testnetContext.isLocalNetwork()).toBe(false);
    });

    it("should identify production networks correctly", () => {
      expect(context.isProductionNetwork()).toBe(false);

      const mainnetContext = createToolboxNetworkContext({
        ...mockMultiNetworkConfig,
        default: "mainnet",
      });
      expect(mainnetContext.isProductionNetwork()).toBe(true);
    });

    it("should check network availability", () => {
      expect(context.isNetworkAvailable("testnet")).toBe(true);
      expect(context.isNetworkAvailable("nonexistent")).toBe(false);
    });
  });

  describe("Network Switching", () => {
    let context: ToolboxNetworkContext;
    let networkChangeListener: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      context = createToolboxNetworkContext();
      networkChangeListener = vi.fn();
    });

    it("should switch to available network", async () => {
      await context.switchNetwork("testnet");

      expect(context.getCurrentNetworkConfig().name).toBe("testnet");
      expect(context.getNetworkId()).toBe("testnet04");
      expect(context.getNetworkType()).toBe("chainweb");
    });

    it("should throw error when switching to unavailable network", async () => {
      await expect(context.switchNetwork("nonexistent")).rejects.toThrow(
        'Network "nonexistent" is not available or not allowed in current environment',
      );
    });

    it("should notify listeners on network switch", async () => {
      const unsubscribe = context.subscribe(networkChangeListener);

      await context.switchNetwork("testnet");

      expect(networkChangeListener).toHaveBeenCalledWith("testnet", mockMultiNetworkConfig.configs["testnet"]!);

      unsubscribe();
    });

    it("should emit DOM event on network switch", async () => {
      // Mock window and addEventListener
      const mockWindow = {
        dispatchEvent: vi.fn(),
        CustomEvent: vi.fn().mockImplementation((type, init) => ({ type, detail: init.detail })),
      };

      vi.stubGlobal("window", mockWindow);
      vi.stubGlobal("CustomEvent", mockWindow.CustomEvent);

      await context.switchNetwork("mainnet");

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith({
        type: "pact-toolbox-network-changed",
        detail: {
          networkName: "mainnet",
          config: mockMultiNetworkConfig.configs["mainnet"]!,
        },
      });

      vi.unstubAllGlobals();
    });
  });

  describe("Global Context Management", () => {
    it("should return same instance for global context", () => {
      const context1 = getGlobalNetworkContext();
      const context2 = getGlobalNetworkContext();

      expect(context1).toBe(context2);
    });

    it("should create global context if none exists", () => {
      // For this test, we need to create it explicitly to verify it was set
      const context = createToolboxNetworkContext(undefined, true);

      expect(context).toBeInstanceOf(ToolboxNetworkContext);
      expect((globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__).toBe(context);
    });
  });

  describe("Network Change Subscription", () => {
    let context: ToolboxNetworkContext;

    beforeEach(() => {
      context = createToolboxNetworkContext();
    });

    it("should allow subscribing to network changes", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = context.subscribe(listener1);
      const unsubscribe2 = context.subscribe(listener2);

      context.switchNetwork("testnet");

      expect(listener1).toHaveBeenCalledWith("testnet", mockMultiNetworkConfig.configs["testnet"]!);
      expect(listener2).toHaveBeenCalledWith("testnet", mockMultiNetworkConfig.configs["testnet"]);

      unsubscribe1();
      unsubscribe2();
    });

    it("should allow unsubscribing from network changes", () => {
      const listener = vi.fn();

      const unsubscribe = context.subscribe(listener);
      unsubscribe();

      context.switchNetwork("mainnet");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle errors in listeners gracefully", () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const goodListener = vi.fn();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      context.subscribe(badListener);
      context.subscribe(goodListener);

      context.switchNetwork("testnet");

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("Error in network change listener:", expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe("Production Environment", () => {
    beforeEach(() => {
      // Mock production environment
      (globalThis as any).__PACT_TOOLBOX_NETWORKS__ = {
        ...mockMultiNetworkConfig,
        environment: "production",
        configs: {
          testnet: mockMultiNetworkConfig.configs["testnet"],
          mainnet: mockMultiNetworkConfig.configs["mainnet"],
        },
      };
    });

    it("should not allow switching to local networks in production", async () => {
      const context = createToolboxNetworkContext();

      await expect(context.switchNetwork("pactServer")).rejects.toThrow(
        'Network "pactServer" is not available or not allowed in current environment',
      );
    });

    it("should only show available networks in production", () => {
      const context = createToolboxNetworkContext();
      const networks = context.getAvailableNetworks();

      expect(networks).toEqual(["testnet", "mainnet"]);
      expect(networks).not.toContain("pactServer");
    });
  });
});
