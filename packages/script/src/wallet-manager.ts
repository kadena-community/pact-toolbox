import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { DEFAULT_TESTNET_RPC_URL } from "@pact-toolbox/config";
import type { Wallet } from "@pact-toolbox/wallet-adapters";
import { KeypairWallet } from "@pact-toolbox/wallet-adapters/keypair";
import { logger, select, text, isCancel } from "@pact-toolbox/node-utils";

export interface SigningConfig {
  /** Private key for signing (hex string) */
  privateKey?: string;
  /** Account name to use for transactions */
  account?: string;
  /** Environment variable name for private key */
  privateKeyEnv?: string;
  /** Environment variable name for account */
  accountEnv?: string;
  /** Use interactive TUI for signing */
  interactive?: boolean;
  /** Wallet type to use */
  walletType?: "keypair" | "zelcore" | "chainweaver";
  /** Additional wallet configuration */
  walletConfig?: Record<string, any>;
}

export interface SignerInfo {
  account: string;
  publicKey: string;
  capabilities?: Array<{
    name: string;
    args: any[];
  }>;
}

export class WalletManager {
  private wallet: Wallet | null = null;
  private config: PactToolboxConfigObj;
  private signingConfig: SigningConfig;
  private currentSigner: SignerInfo | null = null;
  private network: string;

  constructor(config: PactToolboxConfigObj, signingConfig: SigningConfig = {}, network?: string) {
    this.config = config;
    this.signingConfig = signingConfig;
    this.network = network || config.defaultNetwork;
  }

  /**
   * Initialize wallet based on configuration
   */
  async initialize(): Promise<Wallet> {
    if (this.wallet) {
      return this.wallet;
    }

    // Try different initialization methods in order of preference
    this.wallet =
      (await this.tryKeyPairFromArgs()) ||
      (await this.tryKeyPairFromEnv()) ||
      (await this.tryKeyPairFromNetworkConfig()) ||
      (await this.tryInteractiveSetup()) ||
      (await this.tryDesktopWallet());

    if (!this.wallet) {
      throw new Error("Unable to initialize wallet. Please provide signing credentials.");
    }

    await this.wallet.connect();
    await this.setupDefaultSigner();

    logger.success(`Wallet initialized: ${this.currentSigner?.account || "unknown"}`);
    return this.wallet;
  }

  /**
   * Get current signer information
   */
  getCurrentSigner(): SignerInfo | null {
    return this.currentSigner;
  }

  /**
   * Get the wallet instance
   */
  getWallet(): Wallet | null {
    return this.wallet;
  }

  /**
   * Switch to a different signer account
   */
  async switchSigner(account?: string): Promise<SignerInfo> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    const walletAccount = await this.wallet.getAccount();
    const availableAccount = walletAccount.address;

    if (account && account !== availableAccount) {
      throw new Error(`Account ${account} not found in wallet. Available: ${availableAccount}`);
    }

    // Use the provided account or the wallet's account
    const selectedAccount = account || availableAccount;

    // Update current signer
    this.currentSigner = {
      account: selectedAccount,
      publicKey: selectedAccount.startsWith("k:") ? selectedAccount.slice(2) : walletAccount.publicKey,
      capabilities: [],
    };

    return this.currentSigner;
  }

  /**
   * Add capability to current signer
   */
  addCapability(name: string, ...args: any[]): void {
    if (!this.currentSigner) {
      throw new Error("No signer configured");
    }

    this.currentSigner.capabilities = this.currentSigner.capabilities || [];
    this.currentSigner.capabilities.push({ name, args });
  }

  /**
   * Clear all capabilities from current signer
   */
  clearCapabilities(): void {
    if (this.currentSigner) {
      this.currentSigner.capabilities = [];
    }
  }

  /**
   * Create a scoped signer for a specific operation
   */
  createScopedSigner(capabilities: Array<{ name: string; args: any[] }>): SignerInfo {
    if (!this.currentSigner) {
      throw new Error("No signer configured");
    }

    return {
      ...this.currentSigner,
      capabilities: [...capabilities],
    };
  }

  // Private methods for different initialization strategies

  private async tryKeyPairFromArgs(): Promise<Wallet | null> {
    if (!this.signingConfig.privateKey) {
      return null;
    }

    logger.debug("Initializing keypair wallet from provided private key");

    // Get network configuration from config
    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";
    const rpcUrlTemplate = networkConfig?.rpcUrl || DEFAULT_TESTNET_RPC_URL;
    const rpcUrl = rpcUrlTemplate
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    return new KeypairWallet({
      privateKey: this.signingConfig.privateKey,
      accountName: this.signingConfig.account,
      networkId,
      rpcUrl,
    });
  }

  private async tryKeyPairFromEnv(): Promise<Wallet | null> {
    const privateKeyEnv = this.signingConfig.privateKeyEnv || "PACT_PRIVATE_KEY";
    const accountEnv = this.signingConfig.accountEnv || "PACT_ACCOUNT";

    const privateKey = process.env[privateKeyEnv];
    const account = process.env[accountEnv];

    if (!privateKey) {
      return null;
    }

    logger.debug(`Initializing keypair wallet from environment variable: ${privateKeyEnv}`);

    // Get network configuration from config
    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";
    const rpcUrlTemplate = networkConfig?.rpcUrl || DEFAULT_TESTNET_RPC_URL;
    const rpcUrl = rpcUrlTemplate
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    return new KeypairWallet({
      privateKey,
      accountName: account,
      networkId,
      rpcUrl,
    });
  }

  private async tryKeyPairFromNetworkConfig(): Promise<Wallet | null> {
    // Get network configuration
    const networkConfig = this.config.networks?.[this.network];
    if (!networkConfig || !networkConfig.keyPairs || networkConfig.keyPairs.length === 0) {
      return null;
    }

    logger.debug(`Initializing keypair wallet from network config (${this.network})`);

    // Use the first available keypair or the configured account
    let selectedKeyPair = networkConfig.keyPairs[0];
    
    // If a specific account is configured, try to find it in the network keypairs
    if (this.signingConfig.account) {
      const foundKeyPair = networkConfig.keyPairs.find(
        kp => kp.account === this.signingConfig.account
      );
      if (foundKeyPair) {
        selectedKeyPair = foundKeyPair;
      } else {
        logger.warn(`Account ${this.signingConfig.account} not found in network config, using first available`);
      }
    }

    const networkId = networkConfig.networkId;
    const rpcUrlTemplate = networkConfig.rpcUrl || "https://testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact";
    const rpcUrl = (rpcUrlTemplate as string)
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    return new KeypairWallet({
      privateKey: selectedKeyPair.secretKey,
      accountName: selectedKeyPair.account,
      networkId,
      rpcUrl,
    });
  }

  private async tryInteractiveSetup(): Promise<Wallet | null> {
    if (!this.signingConfig.interactive) {
      return null;
    }

    logger.info("🔐 Interactive wallet setup");

    const walletType = await select({
      message: "Select wallet type:",
      options: [
        { value: "keypair", label: "Keypair (Private Key)" },
        { value: "zelcore", label: "Zelcore Desktop" },
        { value: "chainweaver", label: "Chainweaver Desktop" },
      ],
    });

    if (isCancel(walletType)) {
      throw new Error("Wallet setup cancelled");
    }

    switch (walletType) {
      case "keypair":
        return this.setupKeypairWalletInteractive();
      case "zelcore":
      case "chainweaver":
        throw new Error(`${walletType} desktop wallet integration is planned but not yet implemented`);
      default:
        throw new Error(`Wallet type ${walletType} not supported`);
    }
  }

  private async setupKeypairWalletInteractive(): Promise<Wallet> {
    const privateKey = await text({
      message: "Enter private key (hex):",
      placeholder: "e.g., 251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
    });

    if (isCancel(privateKey)) {
      throw new Error("Private key input cancelled");
    }

    const account = await text({
      message: "Enter account name (optional):",
      placeholder: "e.g., k:your-public-key or sender00",
    });

    if (isCancel(account)) {
      throw new Error("Account input cancelled");
    }

    // Get network configuration from config
    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";
    const rpcUrlTemplate = networkConfig?.rpcUrl || DEFAULT_TESTNET_RPC_URL;
    const rpcUrl = rpcUrlTemplate
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    return new KeypairWallet({
      privateKey: privateKey as string,
      accountName: (account as string) || undefined,
      networkId,
      rpcUrl,
    });
  }

  private async tryDesktopWallet(): Promise<Wallet | null> {
    const walletType = this.signingConfig.walletType;

    if (!walletType || walletType === "keypair") {
      return null;
    }

    logger.debug(`Attempting to connect to ${walletType} wallet`);

    switch (walletType) {
      case "zelcore":
        throw new Error("Zelcore desktop wallet integration is planned but not yet implemented");
      case "chainweaver":
        throw new Error("Chainweaver desktop wallet integration is planned but not yet implemented");
      default:
        throw new Error(`Unknown wallet type: ${walletType}`);
    }
  }

  private async setupDefaultSigner(): Promise<void> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    const walletAccount = await this.wallet.getAccount();
    const availableAccount = walletAccount.address;

    if (!availableAccount) {
      throw new Error("No account found in wallet");
    }

    // Use configured account or available account
    const account = this.signingConfig.account || availableAccount;

    this.currentSigner = {
      account,
      publicKey: account.startsWith("k:") ? account.slice(2) : walletAccount.publicKey,
      capabilities: [],
    };
  }

  private async selectAccount(availableAccounts: string[]): Promise<string> {
    if (availableAccounts.length === 1) {
      return availableAccounts[0];
    }

    const { select, isCancel } = await import("@pact-toolbox/node-utils");
    
    const selectedAccount = await select({
      message: "Select account to use:",
      options: availableAccounts.map((account) => ({
        value: account,
        label: account,
      })),
    });

    if (isCancel(selectedAccount)) {
      throw new Error("Account selection cancelled");
    }

    return selectedAccount as string;
  }

  /**
   * Disconnect wallet and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.wallet) {
      try {
        await this.wallet.disconnect();
      } catch (error) {
        logger.warn("Error disconnecting wallet:", error);
      }
      this.wallet = null;
      this.currentSigner = null;
    }
  }

  /**
   * Create signing configuration from CLI arguments and environment
   */
  static createSigningConfig(args: Record<string, any> = {}): SigningConfig {
    return {
      privateKey: args["privateKey"] || args["key"],
      account: args["account"] || args["from"],
      privateKeyEnv: args["privateKeyEnv"] || "PACT_PRIVATE_KEY",
      accountEnv: args["accountEnv"] || "PACT_ACCOUNT",
      interactive: args["interactive"] || (!args["privateKey"] && !process.env["PACT_PRIVATE_KEY"]),
      walletType: args["wallet"] || args["walletType"],
      walletConfig: args["walletConfig"] || {},
    };
  }

  /**
   * Validate signing configuration
   */
  static validateSigningConfig(config: SigningConfig): string[] {
    const errors: string[] = [];

    // Check if we have any signing method available
    const hasPrivateKey = !!(config.privateKey || (config.privateKeyEnv && process.env[config.privateKeyEnv]));
    const hasWalletType = !!config.walletType;
    const hasInteractive = !!config.interactive;

    if (!hasPrivateKey && !hasWalletType && !hasInteractive) {
      errors.push("No signing method configured. Provide privateKey, walletType, or enable interactive mode.");
    }

    // Validate private key format if provided
    if (config.privateKey && !/^[0-9a-fA-F]{64}$/.test(config.privateKey)) {
      errors.push("Private key must be a 64-character hexadecimal string");
    }

    // Validate account format if provided
    if (config.account && !/^(k:[0-9a-fA-F]{64}|[a-zA-Z0-9\-_.]+)$/.test(config.account)) {
      errors.push("Account must be in k:public-key format or valid account name");
    }

    return errors;
  }
}

/**
 * Create a wallet manager instance with configuration
 */
export function createWalletManager(config: PactToolboxConfigObj, signingConfig: SigningConfig = {}, network?: string): WalletManager {
  return new WalletManager(config, signingConfig, network);
}

/**
 * Helper to get signing configuration from various sources
 */
export function resolveSigningConfig(
  scriptArgs: Record<string, any> = {},
  envOverrides: Record<string, string> = {},
): SigningConfig {
  // Merge environment overrides into process.env temporarily
  const originalEnv = { ...process.env };
  Object.assign(process.env, envOverrides);

  try {
    const config = WalletManager.createSigningConfig(scriptArgs);

    // Validate configuration
    const errors = WalletManager.validateSigningConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid signing configuration:\n${errors.join("\n")}`);
    }

    return config;
  } finally {
    // Restore original environment
    process.env = originalEnv;
  }
}
