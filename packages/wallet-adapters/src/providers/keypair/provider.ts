import type { Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/wallet-core";
import { KeypairWallet, type KeypairWalletConfig } from "./wallet";

/**
 * Configuration for KeypairWallet provider
 */
export interface KeypairProviderConfig extends Partial<KeypairWalletConfig> {
  /** Whether to use deterministic keys */
  deterministic?: boolean;
  /** Seed for deterministic key generation */
  seed?: string;
}

/**
 * Provider for the built-in KeypairWallet
 */
export class KeypairWalletProvider implements WalletProvider {
  readonly metadata: WalletMetadata;
  private config: KeypairProviderConfig;

  constructor(config: KeypairProviderConfig = {}) {
    this.config = config;

    // Adjust metadata based on environment
    const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
    this.metadata = {
      id: "keypair",
      name: isBrowser ? "Development Wallet" : "Keypair Wallet",
      description: isBrowser
        ? "Development wallet with key management UI"
        : "Built-in keypair-based wallet for development and testing",
      type: "built-in",
      features: isBrowser
        ? ["sign", "batch-sign", "key-management", "ui-approval", "deterministic-keys", "export-keys"]
        : ["sign", "batch-sign", "deterministic-keys", "export-keys"],
    };
  }

  /**
   * KeypairWallet is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Create a new KeypairWallet instance
   */
  async createWallet(): Promise<Wallet> {
    console.log("createWallet", this.config);

    // Check if we're in a browser environment and should use DevWallet
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        // Try to use DevWallet for better browser experience
        const { DevWallet } = await import("@pact-toolbox/dev-wallet");

        // If private key is provided, use the static factory method
        if (this.config.privateKey) {
          return await DevWallet.fromPrivateKey(this.config.privateKey, {
            networkId: this.config.networkId || "development",
            networkName: this.config.networkName,
            rpcUrl: this.config.rpcUrl || "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
            showUI: true, // Enable UI in browser
            storagePrefix: "pact-toolbox-wallet",
            accountName: this.config.accountName,
          });
        }

        return new DevWallet({
          networkId: this.config.networkId || "development",
          networkName: this.config.networkName,
          rpcUrl: this.config.rpcUrl || "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
          showUI: true, // Enable UI in browser
          storagePrefix: "pact-toolbox-wallet",
          accountName: this.config.accountName,
        });
      } catch {
        console.debug("DevWallet not available, falling back to basic KeypairWallet");
      }
    }

    // Fallback to regular KeypairWallet (for Node.js or if DevWallet fails)
    const walletConfig: KeypairWalletConfig = {
      networkId: this.config.networkId || "development",
      networkName: this.config.networkName,
      rpcUrl: this.config.rpcUrl || "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
      privateKey: this.config.privateKey,
      accountName: this.config.accountName,
      chainId: this.config.chainId || "0",
    };

    return new KeypairWallet(walletConfig);
  }
}
