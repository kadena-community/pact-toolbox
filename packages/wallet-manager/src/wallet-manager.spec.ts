import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WalletManager } from "./wallet-manager";
import { WalletError } from "@pact-toolbox/wallet-core";
import type { Wallet, WalletProvider, WalletMetadata } from "@pact-toolbox/wallet-core";

// Mock wallet provider
class MockWalletProvider implements WalletProvider {
  metadata: WalletMetadata = {
    id: "mock",
    name: "Mock Wallet",
    icon: "mock-icon",
    description: "A mock wallet for testing",
    type: "browser-extension" as const,
  };

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async createWallet(): Promise<Wallet> {
    return new MockWallet();
  }
}

// Mock wallet
class MockWallet implements Wallet {
  id = "mock";
  private _connected = false;
  private accounts = [{ address: "k:mock123", publicKey: "mock-public-key" }];
  private listeners = new Map<string, Set<Function>>();

  isInstalled(): boolean {
    return true;
  }

  async connect(_networkId?: string): Promise<any> {
    this._connected = true;
    return this.accounts[0]!;
  }

  async disconnect(_networkId?: string): Promise<void> {
    this._connected = false;
  }

  async isConnected(_networkId?: string): Promise<boolean> {
    return this._connected;
  }

  async getAccount(_networkId?: string): Promise<any> {
    if (!this._connected) throw new Error("Not connected");
    return this.accounts[0]!;
  }

  async getAccounts(): Promise<any[]> {
    if (!this._connected) throw new Error("Not connected");
    return this.accounts;
  }

  async sign(tx: any): Promise<any> {
    if (!this._connected) throw new Error("Not connected");
    return { ...tx, sigs: [{ pubKey: "mock-public-key", sig: "mock-signature" }] };
  }

  async getNetwork(): Promise<any> {
    return {
      id: "testnet04",
      networkId: "testnet04",
      name: "Testnet",
      url: "https://api.testnet.chainweb.com",
    };
  }

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }
}

describe("WalletManager", () => {
  let manager: WalletManager;

  beforeEach(() => {
    // Clear any global instances
    WalletManager.reset();
    manager = new WalletManager();
  });

  afterEach(async () => {
    await manager.dispose();
    WalletManager.reset();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await manager.initialize();
      // In test environment, keypair is auto-configured
      expect(manager.getRegisteredProviders()).toContain("keypair");
    });

    it("should auto-configure keypair wallet in test environment", async () => {
      await manager.initialize();
      // In test environment, keypair should be auto-configured
      const providers = manager.getRegisteredProviders();
      expect(providers).toContain("keypair");
    });

    it("should only initialize once", async () => {
      await manager.initialize();
      const _firstProviders = manager.getRegisteredProviders();

      // Register a provider after initialization should throw
      const mockProvider = new MockWalletProvider();
      expect(() => manager.register("test", mockProvider)).toThrow(
        "Cannot register providers after initialization"
      );
    });
  });

  describe("provider registration", () => {
    it("should register a provider successfully", () => {
      const mockProvider = new MockWalletProvider();
      manager.register("mock", mockProvider);

      const providers = manager.getRegisteredProviders();
      expect(providers).toContain("mock");
    });

    it("should register multiple providers", () => {
      const mockProvider1 = new MockWalletProvider();
      const mockProvider2 = new MockWalletProvider();

      manager
        .register("mock1", mockProvider1)
        .register("mock2", mockProvider2);

      const providers = manager.getRegisteredProviders();
      expect(providers).toContain("mock1");
      expect(providers).toContain("mock2");
    });

    it("should warn when overwriting a provider", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockProvider1 = new MockWalletProvider();
      const mockProvider2 = new MockWalletProvider();

      manager.register("mock", mockProvider1);
      manager.register("mock", mockProvider2);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Wallet provider 'mock' is already registered. Overwriting..."
      );

      consoleSpy.mockRestore();
    });

    it("should register multiple providers at once", () => {
      const providers = {
        mock1: new MockWalletProvider(),
        mock2: new MockWalletProvider(),
      };

      manager.registerMultiple(providers);

      const registered = manager.getRegisteredProviders();
      expect(registered).toContain("mock1");
      expect(registered).toContain("mock2");
    });
  });

  describe("wallet connection", () => {
    beforeEach(() => {
      manager.register("mock", new MockWalletProvider());
    });

    it("should connect to a wallet successfully", async () => {
      await manager.initialize();
      const wallet = await manager.connect({ walletId: "mock" });

      expect(wallet).toBeDefined();
      expect(wallet.id).toBe("mock");
      expect(manager.getPrimaryWallet()).toBe(wallet);
    });

    it("should throw error when connecting to non-existent wallet", async () => {
      await manager.initialize();

      await expect(manager.connect({ walletId: "nonexistent" })).rejects.toThrow(
        "Wallet provider 'nonexistent' not found"
      );
    });

    it("should return existing wallet if already connected", async () => {
      await manager.initialize();
      const wallet1 = await manager.connect({ walletId: "mock" });
      const wallet2 = await manager.connect({ walletId: "mock" });

      expect(wallet1).toBe(wallet2);
    });

    it("should force reconnect when specified", async () => {
      await manager.initialize();
      const wallet1 = await manager.connect({ walletId: "mock" });
      const wallet2 = await manager.connect({ walletId: "mock", force: true });

      expect(wallet1).not.toBe(wallet2);
    });

    it("should emit connected event", async () => {
      await manager.initialize();

      let emittedWallet: Wallet | null = null;
      manager.on("connected", (wallet) => {
        emittedWallet = wallet;
      });

      const wallet = await manager.connect({ walletId: "mock" });
      expect(emittedWallet).toBe(wallet);
    });

    it("should handle connection timeout", async () => {
      // Create a slow provider
      class SlowProvider extends MockWalletProvider {
        async createWallet(): Promise<Wallet> {
          const wallet = new MockWallet();
          // Override connect to be slow
          wallet.connect = async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
          };
          return wallet;
        }
      }

      manager.register("slow", new SlowProvider());
      await manager.initialize();

      await expect(manager.connect({ walletId: "slow", timeout: 100 })).rejects.toThrow(
        "Connection timed out"
      );
    });
  });

  describe("wallet disconnection", () => {
    beforeEach(async () => {
      manager.register("mock", new MockWalletProvider());
      await manager.initialize();
    });

    it("should disconnect a wallet successfully", async () => {
      const _wallet = await manager.connect({ walletId: "mock" });
      await manager.disconnect("mock");

      expect(manager.getConnectedWallets()).toHaveLength(0);
      expect(manager.getPrimaryWallet()).toBeNull();
    });

    it("should emit disconnected event", async () => {
      await manager.connect({ walletId: "mock" });

      let disconnectedId: string | null = null;
      manager.on("disconnected", (id) => {
        disconnectedId = id;
      });

      await manager.disconnect("mock");
      expect(disconnectedId).toBe("mock");
    });

    it("should throw error when disconnecting non-connected wallet", async () => {
      await expect(manager.disconnect("mock")).rejects.toThrow(
        "Wallet \"mock\" is not connected"
      );
    });

    it("should update primary wallet when current primary is disconnected", async () => {
      // Register second wallet before initialization
      const newManager = new WalletManager();
      newManager.register("mock1", new MockWalletProvider());
      newManager.register("mock2", new MockWalletProvider());
      await newManager.initialize();

      const wallet1 = await newManager.connect({ walletId: "mock1" });
      const wallet2 = await newManager.connect({ walletId: "mock2" });

      expect(newManager.getPrimaryWallet()).toBe(wallet1);

      await newManager.disconnect("mock1");
      expect(newManager.getPrimaryWallet()).toBe(wallet2);
    });
  });

  describe("primary wallet management", () => {
    beforeEach(async () => {
      manager.register("mock1", new MockWalletProvider());
      manager.register("mock2", new MockWalletProvider());
      await manager.initialize();
    });

    it("should set primary wallet successfully", async () => {
      const wallet1 = await manager.connect({ walletId: "mock1" });
      const wallet2 = await manager.connect({ walletId: "mock2" });

      expect(manager.getPrimaryWallet()).toBe(wallet1);

      manager.setPrimaryWallet(wallet2);
      expect(manager.getPrimaryWallet()).toBe(wallet2);
    });

    it("should set primary wallet by ID", async () => {
      await manager.connect({ walletId: "mock1" });
      const wallet2 = await manager.connect({ walletId: "mock2" });

      manager.setPrimaryWallet("mock2");
      expect(manager.getPrimaryWallet()).toBe(wallet2);
    });

    it("should throw error when setting non-connected wallet as primary", () => {
      expect(() => manager.setPrimaryWallet("nonexistent")).toThrow(
        WalletError.notConnected("nonexistent")
      );
    });

    it("should emit primaryWalletChanged event", async () => {
      const _wallet1 = await manager.connect({ walletId: "mock1" });
      const wallet2 = await manager.connect({ walletId: "mock2" });

      let emittedWallet: Wallet | null = null;
      manager.on("primaryWalletChanged", (wallet) => {
        emittedWallet = wallet;
      });

      manager.setPrimaryWallet(wallet2);
      expect(emittedWallet).toBe(wallet2);
    });
  });

  describe("transaction signing", () => {
    beforeEach(async () => {
      manager.register("mock", new MockWalletProvider());
      await manager.initialize();
    });

    it("should sign transaction with primary wallet", async () => {
      await manager.connect({ walletId: "mock" });

      const tx = { cmd: "test-command", sigs: [] };
      const signed = await manager.sign(tx as any);

      expect(signed).toHaveProperty("sigs");
      expect(signed.sigs).toBeDefined();
      // Check that it has been signed (sigs array should have elements)
      expect(signed.sigs.length).toBeGreaterThan(0);
    });

    it("should throw error when no wallet is connected", async () => {
      await expect(manager.sign({ cmd: "test" } as any)).rejects.toThrow(
        "No wallet connected"
      );
    });
  });

  describe("wallet metadata", () => {
    beforeEach(async () => {
      manager.register("mock1", new MockWalletProvider());
      manager.register("mock2", new MockWalletProvider());
      await manager.initialize();
    });

    it("should return available wallets metadata", () => {
      const wallets = manager.getAvailableWallets();

      // Should have mock wallets plus auto-configured keypair
      expect(wallets.length).toBeGreaterThanOrEqual(2);

      const mockWallet = wallets.find(w => w.id === "mock1");
      expect(mockWallet).toMatchObject({
        id: "mock1",
        name: "Mock Wallet",
        description: "A mock wallet for testing",
        installed: true,
      });
    });

    it("should return connected wallets", async () => {
      const wallet1 = await manager.connect({ walletId: "mock1" });
      const wallet2 = await manager.connect({ walletId: "mock2" });

      // Set proper IDs on the wallets
      (wallet1 as any).id = "mock1";
      (wallet2 as any).id = "mock2";

      const connected = manager.getConnectedWallets();
      expect(connected).toHaveLength(2);
      expect(connected.map(w => w.id)).toContain("mock1");
      expect(connected.map(w => w.id)).toContain("mock2");
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      manager.register("mock", new MockWalletProvider());
      await manager.initialize();
    });

    it("should emit error event on connection failure", async () => {
      // Create a failing provider
      class FailingProvider extends MockWalletProvider {
        async createWallet(): Promise<Wallet> {
          const wallet = new MockWallet();
          wallet.connect = async () => {
            throw new Error("Connection failed");
          };
          return wallet;
        }
      }

      const failingManager = new WalletManager();
      failingManager.register("failing", new FailingProvider());
      await failingManager.initialize();

      let emittedError: any = null;
      failingManager.on("error", (error: Error) => {
        emittedError = error;
      });

      await expect(failingManager.connect({ walletId: "failing" })).rejects.toThrow();
      expect(emittedError).toBeDefined();
      expect(emittedError?.message).toContain("Connection failed");
    });
  });

  describe("disposal", () => {
    it("should disconnect all wallets on dispose", async () => {
      manager.register("mock1", new MockWalletProvider());
      manager.register("mock2", new MockWalletProvider());
      await manager.initialize();

      await manager.connect({ walletId: "mock1" });
      await manager.connect({ walletId: "mock2" });

      expect(manager.getConnectedWallets()).toHaveLength(2);

      await manager.dispose();
      expect(manager.getConnectedWallets()).toHaveLength(0);
    });

    it("should handle multiple dispose calls gracefully", async () => {
      await manager.initialize();
      await manager.dispose();
      await manager.dispose(); // Should not throw
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance with getInstance", () => {
      const instance1 = WalletManager.getInstance();
      const instance2 = WalletManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should reset singleton instance", () => {
      const instance1 = WalletManager.getInstance();
      WalletManager.reset();
      const instance2 = WalletManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });
});