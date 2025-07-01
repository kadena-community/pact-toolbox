import { describe, it, expect, beforeEach } from "vitest";
import { MagicWalletProvider } from "../src/provider";

describe("MagicWalletProvider", () => {
  let provider: MagicWalletProvider;

  beforeEach(() => {
    provider = new MagicWalletProvider({
      apiKey: "test-api-key",
    });
  });

  it("should have correct metadata", () => {
    expect(provider.metadata).toMatchObject({
      id: "magic",
      name: "Magic / SpireKey",
      description: expect.stringContaining("Magic Link"),
      type: "browser-extension",
    });
  });

  it("should check availability based on dependencies", async () => {
    // Mock the import to simulate Magic SDK available
    vi.mock('magic-sdk', () => ({ Magic: {} }));
    vi.mock('@magic-ext/kadena', () => ({ KadenaExtension: {} }));

    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(true);
  });
});