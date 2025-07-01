import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZelcoreWalletProvider } from "../src/provider";
import { ZelcoreWallet } from "../src/wallet";

describe("ZelcoreWalletProvider", () => {
  let provider: ZelcoreWalletProvider;

  beforeEach(() => {
    provider = new ZelcoreWalletProvider();
  });

  it("should have correct metadata", () => {
    expect(provider.metadata).toMatchObject({
      id: "zelcore",
      name: "Zelcore",
      description: expect.stringContaining("Multi-asset"),
      type: "browser-extension",
    });
  });

  it("should detect when Zelcore is not available", async () => {
    // Mock fetch to simulate Zelcore not available
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection failed')));
    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(false);
  });

  it("should create a wallet instance", async () => {
    const wallet = await provider.createWallet();
    expect(wallet).toBeInstanceOf(ZelcoreWallet);
  });
});

describe("ZelcoreWallet", () => {
  let wallet: ZelcoreWallet;

  beforeEach(() => {
    wallet = new ZelcoreWallet();
    vi.clearAllMocks();
  });

  it("should be created", () => {
    expect(wallet).toBeInstanceOf(ZelcoreWallet);
    expect(wallet.id).toBe("zelcore");
  });

  it("should always be considered installed", () => {
    // Zelcore uses WalletConnect, so it's always "installed"
    expect(wallet.isInstalled()).toBe(true);
  });
});