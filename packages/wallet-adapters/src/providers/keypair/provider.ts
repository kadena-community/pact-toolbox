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
}

/**
 * Provider for the built-in KeypairWallet
 */
export class KeypairWalletProvider extends BaseWalletProvider {
  static id = "keypair";
  static autoRegister = true;
  static priority = 10; // Lower priority than dev-wallet and browser extensions

  readonly metadata: WalletMetadata;
  private config: KeypairProviderConfig;

  constructor(config: KeypairProviderConfig = {}) {
    super();
    this.config = config;

    this.metadata = {
      id: "keypair",
      name: "Keypair Wallet",
      description: "Simple keypair-based wallet for development, testing, and scripts",
      type: "built-in",
      icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJDMiAxNy41MjMgNi40NzcgMjIgMTIgMjJDMTcuNTIzIDIyIDIyIDE3LjUyMyAyMiAxMkMyMiA2LjQ3NyAxNy41MjMgMiAxMiAyWiIgZmlsbD0iIzY2NjY2NiIvPgo8cGF0aCBkPSJNOSA5SDEySDEzVjEySDE1VjE1SDE0VjEzSDEySDlWMTBIOVY5WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+",
      features: ["sign", "batch-sign", "deterministic-keys", "export-keys"],
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
   * Create a new KeypairWallet instance
   */
  async createWallet(): Promise<Wallet> {
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