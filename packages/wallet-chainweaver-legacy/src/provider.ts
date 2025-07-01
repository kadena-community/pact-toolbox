import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { ChainweaverLegacyWallet } from "./wallet";

/**
 * Chainweaver Legacy (desktop) wallet provider
 */
export class ChainweaverLegacyProvider implements WalletProvider {
  static id = "chainweaver-legacy";
  static autoRegister = false; // Don't auto-register, needs desktop app
  static priority = 30;

  readonly metadata: WalletMetadata = {
    id: "chainweaver-legacy",
    name: "Chainweaver Desktop",
    description: "Connect to Chainweaver desktop application",
    type: "desktop",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJDOC4yNjgwMSAyIDIgOC4yNjgwMSAyIDE2QzIgMjMuNzMyIDguMjY4MDEgMzAgMTYgMzBDMjMuNzMyIDMwIDMwIDIzLuczMiAzMCAxNkMzMCA4LjI2ODAxIDIzLjczMiAyIDE2IDJaIiBmaWxsPSIjRkY1MjVFIi8+Cjwvc3ZnPg==",
    features: ["sign", "batch-sign"],
  };

  /**
   * Check if Chainweaver desktop is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch("http://127.0.0.1:9467/v1/status", {
        method: "GET",
        mode: "no-cors", // Use no-cors to avoid CORS issues with desktop app
      });
      return true; // If we reach here, the desktop app is running
    } catch {
      return false;
    }
  }

  /**
   * Create Chainweaver Legacy wallet instance
   */
  async createWallet(): Promise<Wallet> {
    return new ChainweaverLegacyWallet();
  }
}