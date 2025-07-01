import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { MagicWallet } from "./wallet";
import type { MagicOptions } from "./types";

/**
 * Provider for Magic wallet (including SpireKey)
 */
export class MagicWalletProvider implements WalletProvider {
  private options: MagicOptions;

  constructor(options: MagicOptions) {
    this.options = options;
  }

  readonly metadata: WalletMetadata = {
    id: "magic",
    name: "Magic / SpireKey",
    description: "Magic Link authentication with SpireKey WebAuthn support",
    type: "browser-extension", // Web-based service
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiM2ODUxRkYiLz4KPHBhdGggZD0iTTEwIDEwTDIyIDIyTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg==",
    features: ["sign", "quick-sign", "batch-sign", "email-login", "webauthn"],
  };

  /**
   * Check if Magic is available
   */
  async isAvailable(): Promise<boolean> {
    // Magic is available if we can load the dependencies
    try {
      await import("magic-sdk");
      await import("@magic-ext/kadena");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create Magic wallet instance
   */
  async createWallet(): Promise<Wallet> {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error("Magic SDK dependencies not available");
    }

    return new MagicWallet(this.options);
  }

  /**
   * Create a Magic provider with specific options
   */
  static withOptions(options: MagicOptions): MagicWalletProvider {
    return new MagicWalletProvider(options);
  }

  /**
   * Create a Magic provider for SpireKey
   */
  static forSpireKey(options: Omit<MagicOptions, "createAccountsOnChain">): MagicWalletProvider {
    return new MagicWalletProvider({
      ...options,
      createAccountsOnChain: true, // SpireKey typically creates accounts
    });
  }

  /**
   * Create a Magic provider for testnet
   */
  static forTestnet(magicApiKey: string): MagicWalletProvider {
    return new MagicWalletProvider({
      magicApiKey,
      chainwebApiUrl: "https://api.testnet.chainweb.com",
      chainId: "0",
      networkId: "testnet04",
      createAccountsOnChain: true,
    });
  }

  /**
   * Create a Magic provider for mainnet
   */
  static forMainnet(magicApiKey: string): MagicWalletProvider {
    return new MagicWalletProvider({
      magicApiKey,
      chainwebApiUrl: "https://api.chainweb.com",
      chainId: "0",
      networkId: "mainnet01",
      createAccountsOnChain: true,
    });
  }
}
