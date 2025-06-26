import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { ZelcoreWallet } from "./wallet";
import type { ZelcoreConnectionOptions } from "./types";

/**
 * Provider for Zelcore wallet
 */
export class ZelcoreWalletProvider implements WalletProvider {
  private connectionOptions: ZelcoreConnectionOptions | undefined = undefined;

  constructor(options?: { connectionOptions?: ZelcoreConnectionOptions }) {
    if (options?.connectionOptions) {
      this.connectionOptions = options.connectionOptions;
    }
  }

  readonly metadata: WalletMetadata = {
    id: "zelcore",
    name: "Zelcore",
    description: "Multi-asset wallet with Kadena support",
    type: "browser-extension", // Actually desktop, but using browser-extension for compatibility
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiMxMDgxRTgiLz4KPHBhdGggZD0iTTIzLjUgMTBIMTJMMTkuNSAyMkg4LjUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=",
    features: ["sign", "multi-account"],
  };

  /**
   * Check if Zelcore wallet is available
   * Note: We can't reliably detect if Zelcore is running,
   * so we always return true and handle connection errors later
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to fetch from Zelcore's port
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch("http://127.0.0.1:9467/v1/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ asset: "kadena" }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      return response !== null && response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create Zelcore wallet instance
   */
  async createWallet(): Promise<Wallet> {
    const adapter = new ZelcoreWallet();

    // Set connection options if provided
    if (this.connectionOptions) {
      adapter.setConnectionOptions(this.connectionOptions);
    }

    return adapter;
  }

  /**
   * Create a Zelcore provider with connection options
   */
  static withOptions(options: ZelcoreConnectionOptions): ZelcoreWalletProvider {
    return new ZelcoreWalletProvider({ connectionOptions: options });
  }
}
