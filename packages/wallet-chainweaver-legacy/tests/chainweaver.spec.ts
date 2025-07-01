import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChainweaverWalletProvider } from "../src/provider";
import { ChainweaverWallet } from "../src/wallet";

describe("ChainweaverWalletProvider", () => {
  let provider: ChainweaverWalletProvider;

  beforeEach(() => {
    provider = new ChainweaverWalletProvider();
  });

  it("should have correct metadata", () => {
    expect(provider.metadata).toMatchObject({
      id: "chainweaver",
      name: "Chainweaver",
      description: expect.stringContaining("desktop wallet"),
      type: "desktop",
    });
  });

  it("should detect when Chainweaver is not available", async () => {
    // Mock fetch to simulate Chainweaver not running
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection failed')));
    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(false);
  });

  it("should create a wallet instance", async () => {
    const wallet = await provider.createWallet();
    expect(wallet).toBeInstanceOf(ChainweaverWallet);
  });
});

describe("ChainweaverWallet", () => {
  let wallet: ChainweaverWallet;

  beforeEach(() => {
    wallet = new ChainweaverWallet();
    vi.clearAllMocks();
  });

  it("should be created", () => {
    expect(wallet).toBeInstanceOf(ChainweaverWallet);
    expect(wallet.id).toBe("chainweaver");
  });

  it("should always be considered installed", () => {
    // Chainweaver is a desktop app that communicates via localhost
    expect(wallet.isInstalled()).toBe(true);
  });
});