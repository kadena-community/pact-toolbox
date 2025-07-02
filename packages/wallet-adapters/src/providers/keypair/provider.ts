import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import { BaseWalletProvider } from "@pact-toolbox/wallet-core";
import { KeypairWallet, type KeypairWalletConfig } from "./wallet";

/**
 * Configuration for KeypairWallet provider
 */
export interface KeypairProviderConfig extends Partial<KeypairWalletConfig> {
  /** Whether to use deterministic keys */
  deterministic?: boolean;
  /** Seed for deterministic key generation */
  seed?: string;
  /** Whether to show DevWallet UI (defaults to auto-detect based on network) */
  showUI?: boolean;
  /** Force DevWallet usage even in non-browser environments */
  forceDevWallet?: boolean;
}

/**
 * Provider for the built-in KeypairWallet
 */
export class KeypairWalletProvider extends BaseWalletProvider {
  static id = "keypair";
  static autoRegister = true;
  static priority = 10; // Lower priority than browser extensions

  readonly metadata: WalletMetadata;
  private config: KeypairProviderConfig;

  constructor(config: KeypairProviderConfig = {}) {
    super();
    this.config = config;

    // Adjust metadata based on environment and configuration
    const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
    const hasUI = isBrowser && (this.config.showUI !== false);
    
    this.metadata = {
      id: "keypair",
      name: hasUI ? "Development Wallet" : "Keypair Wallet",
      description: hasUI
        ? "Development wallet with key management UI for local networks"
        : "Built-in keypair-based wallet for development and testing",
      type: "built-in",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJDMiAxNy41MjMgNi40NzcgMjIgMTIgMjJDMTcuNTIzIDIyIDIyIDE3LjUyzIBNkMyMiA2LjQ3NyAxNy41MjMgMiAxMiAyWiIgZmlsbD0iIzAwNjdEQiIvPgo8cGF0aCBkPSJNMTIgNkw5IDlIMTBWMTJIOVYxNEgxMFYxN0g5TDEyIDIwTDE1IDE3SDE0VjE0SDE1VjEySDE0VjlIMTVMMTIgNloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==",
      features: hasUI
        ? ["sign", "batch-sign", "key-management", "ui-approval", "deterministic-keys", "export-keys"]
        : ["sign", "batch-sign", "deterministic-keys", "export-keys"],
    };
  }

  configure(config: KeypairProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * KeypairWallet is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Check if configured for local network
   */
  private isLocalNetwork(): boolean {
    const networkId = this.config.networkId || "development";
    const rpcUrl = this.config.rpcUrl || "";
    
    // Check if it's a local network based on networkId or rpcUrl
    return (
      networkId === "development" ||
      networkId === "fast-development" ||
      rpcUrl.includes("localhost") ||
      rpcUrl.includes("127.0.0.1") ||
      rpcUrl.includes("0.0.0.0")
    );
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

        // Determine if we should show UI
        const showUI = this.config.showUI !== undefined 
          ? this.config.showUI 
          : this.isLocalNetwork();

        const devWalletConfig = {
          networkId: this.config.networkId || "development",
          networkName: this.config.networkName,
          rpcUrl: this.config.rpcUrl || "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
          showUI,
          storagePrefix: "pact-toolbox-wallet",
          accountName: this.config.accountName,
        };

        // If private key is provided, use the static factory method
        if (this.config.privateKey) {
          return await DevWallet.fromPrivateKey(this.config.privateKey, devWalletConfig);
        }

        return new DevWallet(devWalletConfig);
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
