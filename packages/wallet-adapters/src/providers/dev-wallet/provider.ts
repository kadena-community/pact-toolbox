import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import { BaseWalletProvider } from "@pact-toolbox/wallet-core";

/**
 * Configuration for DevWallet provider
 */
export interface DevWalletProviderConfig {
  /** Network ID to use */
  networkId?: string;
  /** Network name */
  networkName?: string;
  /** RPC URL for the network */
  rpcUrl?: string;
  /** Whether to show DevWallet UI */
  showUI?: boolean;
  /** Storage prefix for persisted keys */
  storagePrefix?: string;
  /** Account name */
  accountName?: string;
  /** Private key (optional) */
  privateKey?: string;
  /** Chain ID */
  chainId?: string;
}

/**
 * Provider for the full-featured DevWallet with UI
 */
export class DevWalletProvider extends BaseWalletProvider {
  static id = "dev-wallet";
  static autoRegister = true;
  static priority = 5; // Higher priority than keypair wallet

  readonly metadata: WalletMetadata;
  private config: DevWalletProviderConfig;

  constructor(config: DevWalletProviderConfig = {}) {
    super();
    this.config = config;

    this.metadata = {
      id: "dev-wallet",
      name: "Development Wallet",
      description: "Full-featured development wallet with key management UI for local networks",
      type: "built-in",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJDMiAxNy41MjMgNi40NzcgMjIgMTIgMjJDMTcuNTIzIDIyIDIyIDE3LjUyMyAyMiAxMkMyMiA2LjQ3NyAxNy41MjMgMiAxMiAyWiIgZmlsbD0iIzAwNjdEQiIvPgo8cGF0aCBkPSJNMTIgNkw5IDlIMTBWMTJIOVYxNEgxMFYxN0g5TDEyIDIwTDE1IDE3SDE0VjE0SDE1VjEySDE0VjlIMTVMMTIgNloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==",
      features: [
        "sign",
        "batch-sign", 
        "key-management",
        "ui-approval",
        "deterministic-keys",
        "export-keys",
        "persistence",
        "transaction-history"
      ],
    };
  }

  configure(config: DevWalletProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * DevWallet is only available in browser environments
   */
  async isAvailable(): Promise<boolean> {
    // Only available in browser environments
    return typeof window !== "undefined" && typeof document !== "undefined";
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
   * Create a new DevWallet instance
   */
  async createWallet(): Promise<Wallet> {
    try {
      // Dynamic import to avoid bundling in non-browser environments
      const { DevWallet } = await import("@pact-toolbox/dev-wallet");

      const devWalletConfig = {
        networkId: this.config.networkId || "development",
        networkName: this.config.networkName,
        rpcUrl: this.config.rpcUrl || "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
        showUI: this.config.showUI !== false, // Default to true unless explicitly disabled
        storagePrefix: this.config.storagePrefix || "pact-toolbox-dev-wallet",
        accountName: this.config.accountName,
        chainId: this.config.chainId || "0",
      };

      // If private key is provided, use the static factory method
      if (this.config.privateKey) {
        return await DevWallet.fromPrivateKey(this.config.privateKey, devWalletConfig);
      }

      return new DevWallet(devWalletConfig);
    } catch (error) {
      throw new Error(`Failed to create DevWallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}