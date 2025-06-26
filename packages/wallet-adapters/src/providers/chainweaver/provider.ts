import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { ChainweaverWallet } from "./wallet";
import type { ChainweaverConnectionOptions } from "./types";

/**
 * Provider for Chainweaver wallet
 */
export class ChainweaverWalletProvider implements WalletProvider {
  private connectionOptions: ChainweaverConnectionOptions | undefined = undefined;

  constructor(options?: { connectionOptions?: ChainweaverConnectionOptions }) {
    if (options?.connectionOptions) {
      this.connectionOptions = options.connectionOptions;
    }
  }

  readonly metadata: WalletMetadata = {
    id: "chainweaver",
    name: "Chainweaver",
    description: "Official Kadena desktop wallet",
    type: "desktop",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJDOC4yNjgwMSAyIDIgOC4yNjgwMSAyIDE2QzIgMjMuNzMyIDguMjY4MDEgMzAgMTYgMzBDMjMuNzMyIDMwIDMwIDIzLjczMiAzMCAxNkMzMCA4LjI2ODAxIDIzLjczMiAyIDE2IDJaIiBmaWxsPSIjRkY0NDk0Ii8+CjxwYXRoIGQ9Ik0yMC41IDExLjVIMTEuNVYyMC41SDIwLjVWMTEuNVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNiA4TDggMTZMMTYgMjRMMjQgMTZMMTYgOFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOCIvPgo8L3N2Zz4K",
    features: ["sign", "quick-sign", "batch-sign"],
  };

  /**
   * Check if Chainweaver wallet is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to reach Chainweaver's status endpoint
      const response = await fetch("http://127.0.0.1:9467/v1/status", {
        method: "GET",
        mode: "cors",
      }).catch(() => null);

      return response?.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Create Chainweaver wallet instance
   */
  async createWallet(): Promise<Wallet> {
    const adapter = new ChainweaverWallet();

    // Set connection options if provided
    if (this.connectionOptions) {
      adapter.setConnectionOptions(this.connectionOptions);
    }

    return adapter;
  }

  /**
   * Create a Chainweaver provider with connection options
   */
  static withOptions(options: ChainweaverConnectionOptions): ChainweaverWalletProvider {
    return new ChainweaverWalletProvider({ connectionOptions: options });
  }
}
