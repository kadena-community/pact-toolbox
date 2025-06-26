import type { WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { DevWallet } from "./wallet";
import type { DevWalletConfig } from "./types";

/**
 * Provider for the Development wallet
 */
export class DevWalletProvider implements WalletProvider {
  readonly metadata: WalletMetadata = {
    id: "keypair",
    name: "Development Wallet",
    description: typeof window === "undefined" 
      ? "Development wallet for Node.js environments" 
      : "Development wallet with key management UI",
    type: "built-in",
    features: ["sign", "batch-sign", "key-management"],
  };

  private config?: Partial<DevWalletConfig>;

  constructor(config?: Partial<DevWalletConfig>) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async createWallet(): Promise<DevWallet> {
    const defaultConfig: DevWalletConfig = {
      networkId: "development",
      networkName: "Development",
      rpcUrl: "http://localhost:8080",
      showUI: typeof window !== "undefined", // Enable UI in browser by default
      ...this.config,
    };

    return new DevWallet(defaultConfig);
  }
}