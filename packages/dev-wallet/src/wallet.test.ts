import { describe, it, expect, beforeEach, vi } from "vitest";
import { DevWallet } from "./wallet";

// Mock crypto module
vi.mock('@pact-toolbox/crypto', () => ({
  generateKeyPair: vi.fn().mockResolvedValue({
    publicKey: 'mock-public-key-test',
    secretKey: 'mock-secret-key-test',
  }),
  exportBase16Key: vi.fn().mockImplementation((key: any) => key),
  fromHex: vi.fn().mockReturnValue({
    publicKey: 'imported-public-key',
    secretKey: 'imported-secret-key',
  }),
  toHex: vi.fn().mockImplementation((key: any) => key),
  sign: vi.fn().mockResolvedValue({ sig: 'mock-signature' }),
  createKeyPairFromPrivateKeyBytes: vi.fn().mockReturnValue({
    publicKey: 'created-public-key',
    secretKey: 'created-secret-key',
  }),
}));

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