import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import { BaseWalletProvider, detectBrowserExtension } from "@pact-toolbox/wallet-core";
import { EckoWallet } from "./wallet";

/**
 * Simplified provider for Ecko wallet
 */
export class EckoWalletProvider extends BaseWalletProvider {
  static id = "ecko";
  static autoRegister = true;
  static priority = 20;

  readonly metadata: WalletMetadata = {
    id: "ecko",
    name: "Ecko Wallet",
    description: "Kadena browser extension wallet",
    type: "browser-extension",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJDOC4yNjgwMSAyIDIgOC4yNjgwMSAyIDE2QzIgMjMuNzMyIDguMjY4MDEgMzAgMTYgMzBDMjMuNzMyIDMwIDMwIDIzLjczMiAzMCAxNkMzMCA4LjI2ODAxIDIzLjczMiAyIDE2IDJaIiBmaWxsPSIjMUQxRDFCIi8+CjxwYXRoIGQ9Ik0xNiA0QzkuMzcyNTggNCAxNCAxMC4zNzI2IDE0IDE2QzQgMjIuNjI3NCA5LjM3MjU4IDI4IDE2IDI4QzIyLjYyNzQgMjggMjggMjIuNjI3NCAyOCAxNkMyOCAxMC4zNzI2IDIyLjYyNzQgNCAxNiA0WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTE2IDdDMTEuMDI5NCA3IDcgMTEuMDI5NCA3IDE2QzcgMjAuOTcwNiAxMS4wMjk0IDI1IDE2IDI1QzIwLjk3MDYgMjUgMjUgMjAuOTcwNiAyNSAxNkMyNSAxMS4wMjk0IDIwLjk3MDYgNyAxNiA3WiIgZmlsbD0iIzFEMUQxQiIvPgo8L3N2Zz4K",
    features: ["sign", "batch-sign"],
  };

  /**
   * Check if Ecko wallet is available
   */
  async isAvailable(): Promise<boolean> {
    return this.safeIsAvailable(async () => {
      if (typeof window === "undefined") {
        return false;
      }

      const extensionDetected = await detectBrowserExtension("kadena", 3000);
      return extensionDetected && Boolean((window as any).kadena?.isKadena);
    });
  }

  /**
   * Create Ecko wallet instance
   */
  async createWallet(): Promise<Wallet> {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      throw new Error("Ecko wallet is not available");
    }

    return new EckoWallet();
  }
}
