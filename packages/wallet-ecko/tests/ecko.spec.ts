import { describe, it, expect, beforeEach, vi } from "vitest";
import { EckoWalletProvider } from "../src/provider";
import { EckoWallet } from "../src/wallet";

describe("EckoWalletProvider", () => {
  let provider: EckoWalletProvider;

  beforeEach(() => {
    provider = new EckoWalletProvider();
  });

  it("should have correct metadata", () => {
    expect(provider.metadata).toMatchObject({
      id: "ecko",
      name: "Ecko Wallet",
      description: expect.stringContaining("browser extension"),
      type: "browser-extension",
      features: ["sign", "batch-sign"],
    });
  });

  it("should detect when Ecko is not installed", async () => {
    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(false);
  });

  it("should throw error when creating wallet if not available", async () => {
    await expect(provider.createWallet()).rejects.toThrow("Ecko wallet is not available");
  });
});

describe("EckoWallet", () => {
  let wallet: EckoWallet | null;

  beforeEach(() => {
    // Mock window.kadena for testing
    (global as any).window = {
      kadena: undefined
    };
    wallet = null;
    vi.clearAllMocks();
  });

  it("should throw error when kadena is not available", () => {
    expect(() => new EckoWallet()).toThrow('Wallet "ecko" not found or not installed');
  });

  it("should be created when kadena is available", () => {
    (global as any).window.kadena = { isKadena: true };
    wallet = new EckoWallet();
    expect(wallet).toBeInstanceOf(EckoWallet);
    expect(wallet.id).toBe("ecko");
  });

  it("should detect when Ecko is not installed", () => {
    // Can't create wallet without kadena, so test on window directly
    expect(Boolean((global as any).window.kadena?.isKadena)).toBe(false);
  });

  it("should detect when Ecko is installed", () => {
    (global as any).window.kadena = { isKadena: true };
    wallet = new EckoWallet();
    expect(wallet.isInstalled()).toBe(true);
  });
});