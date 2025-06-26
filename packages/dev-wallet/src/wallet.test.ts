import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevWallet } from "./wallet";
import { DevWalletStorage } from "./storage";

// Mock browser environment for storage tests
Object.defineProperty(globalThis, 'window', {
  value: undefined,
  writable: true
});

describe("DevWallet", () => {
  let wallet: DevWallet;

  beforeEach(() => {
    wallet = new DevWallet({
      networkId: "test",
      networkName: "Test Network",
      rpcUrl: "http://localhost:8080",
      showUI: false,
    });
  });

  it("should be installed", () => {
    expect(wallet.isInstalled()).toBe(true);
  });

  it("should connect and create default key in Node environment", async () => {
    const account = await wallet.connect();
    
    expect(account).toBeDefined();
    expect(account.address).toMatch(/^k:/);
    expect(account.publicKey).toBeDefined();
    expect(await wallet.getAccount()).toEqual(account);
    expect(await wallet.isConnected()).toBe(true);
  });

  it("should disconnect properly", async () => {
    await wallet.connect();
    expect(await wallet.isConnected()).toBe(true);
    
    await wallet.disconnect();
    expect(await wallet.isConnected()).toBe(false);
    // After disconnect, getAccount should try to reconnect, so we check connection state instead
    expect(await wallet.isConnected()).toBe(false);
  });

  it("should create wallet from private key", async () => {
    const privateKey = "e5b47b39a1c99f86bb331f77a3b9b6e1e2e3f4c5d8a9c7b5f3e1d9a7c5b3a1f9";
    const wallet = await DevWallet.fromPrivateKey(privateKey);
    
    await wallet.connect();
    expect(await wallet.isConnected()).toBe(true);
  });
});