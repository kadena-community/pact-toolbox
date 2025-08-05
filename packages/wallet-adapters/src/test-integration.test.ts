import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WalletSystem, createWalletSystem, getWalletSystem } from "./wallet-system";
import { isTestEnvironment } from "./environment";
// import type { Wallet } from "@pact-toolbox/wallet-core";

describe("Test Environment Integration", () => {
  beforeEach(() => {
    // Ensure we're detected as test environment
    process.env.VITEST = "true";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should detect test environment", () => {
    expect(isTestEnvironment()).toBe(true);
  });

  it("should automatically use keypair wallet in test environment", async () => {
    const system = await createWalletSystem({
      wallets: {
        ecko: true,
        chainweaver: true,
        // Not specifying keypair, should be forced in test env
      },
    });

    // Get available wallets - should only have keypair
    const available = await system.getAvailable();
    expect(available).toHaveLength(1);
    expect(available[0]!.id).toBe("keypair");
  });

  it("should connect to keypair wallet without UI in test environment", async () => {
    const system = await createWalletSystem();

    // Connect without specifying wallet ID
    const wallet = await system.connect();
    
    expect(wallet).toBeDefined();
    expect(wallet.id).toBe("keypair");
    
    // Verify it's connected
    const connected = await wallet.isConnected();
    expect(connected).toBe(true);
  });

  it("should auto-connect to keypair in test environment", async () => {
    const system = await createWalletSystem({
      preferences: {
        autoConnect: true,
      },
    });

    const wallet = await system.autoConnect();
    
    expect(wallet).toBeDefined();
    expect(wallet.id).toBe("keypair");
  });

  it("should use fixed test keys in test environment", async () => {
    const system = await createWalletSystem();
    const wallet = await system.connect("keypair");
    
    const account = await wallet.getAccount();
    expect(account).toBeDefined();
    expect(account.publicKey).toBeDefined();
    
    // Create another system and connect
    const system2 = await createWalletSystem();
    const wallet2 = await system2.connect("keypair");
    const account2 = await wallet2.getAccount();
    
    // Should have same public key due to fixed private key in test env
    expect(account2.publicKey).toBe(account.publicKey);
  });

  // Transaction package integration test moved to transaction package itself

  it("should not show UI components in test environment", async () => {
    const system = new WalletSystem({
      ui: {
        showOnConnect: true, // Should be ignored in test env
      },
    });

    await system.initialize();

    // modalManager should not be initialized
    expect((system as any).modalManager).toBeUndefined();
  });

  it("should share wallet system singleton in test environment", async () => {
    const system1 = await getWalletSystem();
    const system2 = await getWalletSystem();
    
    expect(system1).toBe(system2);
    
    // Connect with first instance
    const wallet1 = await system1.connect();
    
    // Should get same wallet from second instance
    const wallet2 = system2.getPrimary();
    expect(wallet2).toBe(wallet1);
  });

  it("should support custom keypair configuration in tests", async () => {
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
    
    const system = await createWalletSystem({
      wallets: {
        keypair: {
          privateKey,
          accountName: "custom-test-account",
        },
      },
    });

    const wallet = await system.connect("keypair");
    const account = await wallet.getAccount();
    
    expect(account).toBeDefined();
    // The public key should be deterministic based on the private key
    expect(account.publicKey).toBeDefined();
  });
});