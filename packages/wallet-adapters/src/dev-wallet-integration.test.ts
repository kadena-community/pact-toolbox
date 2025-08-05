import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWalletSystem } from "./wallet-system";
import { KeypairWalletProvider } from "./providers/keypair";

describe("DevWallet Integration", () => {
  beforeEach(() => {
    // Mock browser environment
    global.window = {} as any;
    global.document = {} as any;
    
    // Reset modules to ensure clean imports
    vi.resetModules();
  });

  it("should use DevWallet in browser environment with local network", async () => {
    const provider = new KeypairWalletProvider({
      networkId: "development",
      rpcUrl: "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
    });

    // Mock the DevWallet import
    vi.doMock("@pact-toolbox/dev-wallet", () => ({
      DevWallet: class MockDevWallet {
        static async fromPrivateKey(privateKey: string, config: any) {
          return new MockDevWallet(config);
        }
        
        constructor(public config: any) {}
        
        id = "keypair";
        
        async connect() {
          return {
            address: "test-address",
            publicKey: "test-public-key",
          };
        }
        
        async isConnected() {
          return true;
        }
        
        async getAccount() {
          return {
            address: "test-address",
            publicKey: "test-public-key",
          };
        }
      }
    }));

    const wallet = await provider.createWallet();
    
    // Should have created a DevWallet (mocked)
    expect(wallet).toBeDefined();
    expect(wallet.id).toBe("keypair");
  });

  it("should configure DevWallet with showUI based on network type", async () => {
    let capturedConfig: any;
    
    // Mock DevWallet to capture config
    vi.doMock("@pact-toolbox/dev-wallet", () => ({
      DevWallet: class MockDevWallet {
        constructor(config: any) {
          capturedConfig = config;
        }
        
        id = "keypair";
        
        async connect() {
          return { address: "test", publicKey: "test" };
        }
      }
    }));

    const provider = new KeypairWalletProvider({
      networkId: "development",
      rpcUrl: "http://localhost:8080",
    });

    await provider.createWallet();
    
    // Currently showUI is always true
    expect(capturedConfig?.showUI).toBe(true);
    
    // TODO: This should be conditional based on network detection
    // For local networks (localhost, devnet), showUI should be true
    // For mainnet/testnet, showUI should be false or configurable
  });

  it("should work with wallet system in browser with local network", async () => {
    const system = await createWalletSystem({
      wallets: {
        keypair: {
          networkId: "development",
          rpcUrl: "http://localhost:8080",
        }
      }
    });

    // In browser environment, should be able to use keypair
    const available = await system.getAvailable();
    expect(available.some(w => w.id === "keypair")).toBe(true);
  });
});