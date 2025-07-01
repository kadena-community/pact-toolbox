import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { DEFAULT_TESTNET_RPC_URL } from "@pact-toolbox/config";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { KeypairWallet } from "@pact-toolbox/wallet-core";
import { ChainweaverLegacyWallet } from "@pact-toolbox/wallet-chainweaver-legacy";
import { ZelcoreWallet } from "@pact-toolbox/wallet-zelcore";
import { KeyPairSigner } from "@pact-toolbox/signers";
import { exportBase16Key } from "@pact-toolbox/crypto";
import { logger, select, text, isCancel, confirm } from "@pact-toolbox/node-utils";
import { parseWalletArgs } from "./cli-utils";

export interface SigningConfig {
  /** Private key for signing (hex string) */
  privateKey?: string;
  /** Public key (hex string) - used when private key is managed externally */
  publicKey?: string;
  /** Account name to use for transactions */
  account?: string;
  /** Environment variable name for private key */
  privateKeyEnv?: string;
  /** Environment variable name for account */
  accountEnv?: string;
  /** Use interactive TUI for signing */
  interactive?: boolean;
  /** Wallet type to use */
  walletType?: "keypair" | "zelcore" | "chainweaver" | "chainweaver-legacy";
  /** Additional wallet configuration */
  walletConfig?: Record<string, any>;
  /** Skip wallet initialization (for read-only operations) */
  skipWallet?: boolean;
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
  async initialize(): Promise<Wallet | null> {
    if (this.wallet) {
      return this.wallet;
    }

    // Skip wallet if configured for read-only operations
    if (this.signingConfig.skipWallet) {
      logger.debug("Skipping wallet initialization (read-only mode)");
      return null;
    }

    // Try different initialization methods in order of preference
    this.wallet =
      (await this.tryKeyPairFromArgs()) ||
      (await this.tryKeyPairFromEnv()) ||
      (await this.tryKeyPairFromNetworkConfig()) ||
      (await this.tryInteractiveSetup()) ||
      (await this.tryDesktopWallet());

    if (!this.wallet) {
      // If we have a public key but no private key, create a read-only signer
      if (this.signingConfig.publicKey) {
        logger.info("Creating read-only signer with public key");
        this.setupReadOnlySigner(this.signingConfig.publicKey, this.signingConfig.account);
        return null;
      }

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

    // Validate private key format
    if (!/^[0-9a-fA-F]{64}$/.test(this.signingConfig.privateKey)) {
      logger.error("Invalid private key format. Expected 64-character hexadecimal string.");
      throw new Error("Invalid private key format");
    }

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
      const foundKeyPair = networkConfig.keyPairs.find((kp) => kp.account === this.signingConfig.account);
      if (foundKeyPair) {
        selectedKeyPair = foundKeyPair;
      } else {
        logger.warn(`Account ${this.signingConfig.account} not found in network config, using first available`);
      }
    }

    const networkId = networkConfig.networkId;
    const rpcUrlTemplate =
      networkConfig.rpcUrl || "https://testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact";
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
        { value: "generate", label: "Generate New Keypair" },
        { value: "zelcore", label: "Zelcore Desktop" },
        { value: "chainweaver-legacy", label: "Chainweaver Desktop (Legacy)" },
      ],
    });

    if (isCancel(walletType)) {
      throw new Error("Wallet setup cancelled");
    }

    switch (walletType) {
      case "keypair":
        return this.setupKeypairWalletInteractive();
      case "generate":
        return this.generateNewKeypairInteractive();
      case "zelcore":
        return this.setupZelcoreWalletInteractive();
      case "chainweaver-legacy":
        return this.setupChainweaverLegacyInteractive();
      default:
        throw new Error(`Wallet type ${walletType} not supported`);
    }
  }

  private async setupKeypairWalletInteractive(): Promise<Wallet> {
    const inputMethod = await select({
      message: "How would you like to provide the private key?",
      options: [
        { value: "paste", label: "Paste private key" },
        { value: "env", label: "Use environment variable" },
      ],
    });

    if (isCancel(inputMethod)) {
      throw new Error("Input method selection cancelled");
    }

    let privateKey: string;

    if (inputMethod === "env") {
      const envVar = await text({
        message: "Enter environment variable name:",
        placeholder: "e.g., PACT_PRIVATE_KEY",
        defaultValue: "PACT_PRIVATE_KEY",
      });

      if (isCancel(envVar)) {
        throw new Error("Environment variable input cancelled");
      }

      privateKey = process.env[envVar as string] || "";
      if (!privateKey) {
        throw new Error(`Environment variable ${envVar} not found or empty`);
      }
    } else {
      const keyInput = await text({
        message: "Enter private key (hex):",
        placeholder: "e.g., 251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
      });

      if (isCancel(keyInput)) {
        throw new Error("Private key input cancelled");
      }

      privateKey = keyInput as string;
    }

    // Validate private key
    if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error("Invalid private key format. Expected 64-character hexadecimal string.");
    }

    const account = await text({
      message: "Enter account name (optional, press Enter for k:account):",
      placeholder: "e.g., k:your-public-key or sender00",
    });

    if (isCancel(account)) {
      throw new Error("Account input cancelled");
    }

    // Get network configuration
    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";
    const rpcUrlTemplate = networkConfig?.rpcUrl || DEFAULT_TESTNET_RPC_URL;
    const rpcUrl = (rpcUrlTemplate as string)
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    logger.info("🚀 Creating keypair wallet...");

    return new KeypairWallet({
      privateKey,
      accountName: (account as string) || undefined,
      networkId,
      rpcUrl,
    });
  }

  /**
   * Generate a new keypair interactively
   */
  private async generateNewKeypairInteractive(): Promise<Wallet> {
    logger.info("🎆 Generating new keypair...");

    const signer = await KeyPairSigner.generate();
    const publicKey = signer.address;
    const privateKey = await exportBase16Key(signer.keyPair.privateKey!);

    logger.success(`✅ New keypair generated`);
    logger.info(`   Public Key: ${publicKey}`);
    logger.info(`   🔐 Private Key: ${privateKey}`);

    const saveKey = await confirm({
      message: "Would you like to save the private key to a file?",
    });

    if (!isCancel(saveKey) && saveKey) {
      const filename = await text({
        message: "Enter filename to save private key:",
        placeholder: "e.g., my-wallet.key",
        defaultValue: "wallet.key",
      });

      if (!isCancel(filename)) {
        const { writeFileSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const keyFile = resolve(process.cwd(), filename as string);
        writeFileSync(keyFile, privateKey, "utf-8");
        logger.success(`💾 Private key saved to: ${keyFile}`);
        logger.warn(`⚠️ Keep this file secure and never commit it to version control!`);
      }
    }

    const account = await text({
      message: "Enter account name (optional, press Enter for k:account):",
      placeholder: "e.g., sender00 or custom-name",
    });

    if (isCancel(account)) {
      throw new Error("Account input cancelled");
    }

    // Get network configuration
    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";
    const rpcUrlTemplate = networkConfig?.rpcUrl || DEFAULT_TESTNET_RPC_URL;
    const rpcUrl = (rpcUrlTemplate as string)
      .replace("{networkId}", networkId)
      .replace("{chainId}", networkConfig?.meta?.chainId || "0");

    return new KeypairWallet({
      privateKey,
      accountName: (account as string) || undefined,
      networkId,
      rpcUrl,
    });
  }

  /**
   * Setup Zelcore wallet interactively
   */
  private async setupZelcoreWalletInteractive(): Promise<Wallet> {
    logger.info("📦 Connecting to Zelcore desktop wallet...");
    logger.info("🚨 Make sure Zelcore is running and configured for Kadena");

    const proceed = await confirm({
      message: "Is Zelcore desktop app running?",
    });

    if (isCancel(proceed) || !proceed) {
      throw new Error("Zelcore setup cancelled. Please start Zelcore first.");
    }

    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";

    try {
      const zelcoreWallet = new ZelcoreWallet();
      await zelcoreWallet.connect(networkId);
      logger.success("✅ Connected to Zelcore wallet");
      return zelcoreWallet;
    } catch (error) {
      logger.error("❌ Failed to connect to Zelcore:", error);
      logger.info("💡 Troubleshooting:");
      logger.info("   1. Make sure Zelcore desktop is running");
      logger.info("   2. Check that Kadena is enabled in Zelcore");
      logger.info("   3. Verify Zelcore is listening on port 9467");
      throw error;
    }
  }

  /**
   * Setup Chainweaver Legacy wallet interactively
   */
  private async setupChainweaverLegacyInteractive(): Promise<Wallet> {
    logger.info("🏛️ Connecting to Chainweaver desktop wallet...");
    logger.info("🚨 Make sure Chainweaver is running");

    const proceed = await confirm({
      message: "Is Chainweaver desktop app running?",
    });

    if (isCancel(proceed) || !proceed) {
      throw new Error("Chainweaver setup cancelled. Please start Chainweaver first.");
    }

    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";

    try {
      const chainweaverWallet = new ChainweaverLegacyWallet();
      await chainweaverWallet.connect(networkId);
      logger.success("✅ Connected to Chainweaver wallet");
      logger.info("🔔 Note: You'll need to approve transactions in Chainweaver when signing");
      return chainweaverWallet;
    } catch (error) {
      logger.error("❌ Failed to connect to Chainweaver:", error);
      logger.info("💡 Troubleshooting:");
      logger.info("   1. Make sure Chainweaver desktop is running");
      logger.info("   2. Check that Chainweaver is listening on port 9467");
      logger.info("   3. Try restarting Chainweaver");
      throw error;
    }
  }

  private async tryDesktopWallet(): Promise<Wallet | null> {
    const walletType = this.signingConfig.walletType;

    if (!walletType || walletType === "keypair") {
      return null;
    }

    logger.debug(`Attempting to connect to ${walletType} wallet`);

    const networkConfig = this.config.networks?.[this.network];
    const networkId = networkConfig?.networkId || "testnet04";

    switch (walletType) {
      case "zelcore":
        logger.info("Connecting to Zelcore desktop wallet...");
        const zelcoreWallet = new ZelcoreWallet();
        await zelcoreWallet.connect(networkId);
        return zelcoreWallet;

      case "chainweaver":
      case "chainweaver-legacy":
        logger.info("Connecting to Chainweaver desktop wallet...");
        const chainweaverWallet = new ChainweaverLegacyWallet();
        await chainweaverWallet.connect(networkId);
        return chainweaverWallet;

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

  /**
   * Setup a read-only signer (no wallet, just public key)
   */
  private setupReadOnlySigner(publicKey: string, account?: string): void {
    // Validate public key format
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      throw new Error("Invalid public key format. Expected 64-character hexadecimal string.");
    }

    // Generate k: account if not provided
    const kAccount = account || `k:${publicKey}`;

    this.currentSigner = {
      account: kAccount,
      publicKey,
      capabilities: [],
    };

    logger.info(`Read-only signer configured: ${kAccount}`);
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
    // Use CLI parser to handle various argument formats
    const parsedArgs = parseWalletArgs(args);

    // Set defaults
    const privateKeyEnv = parsedArgs.privateKeyEnv || "PACT_PRIVATE_KEY";
    const accountEnv = parsedArgs.accountEnv || "PACT_ACCOUNT";

    // Determine if we should use interactive mode
    const hasCredentials =
      parsedArgs.privateKey ||
      parsedArgs.publicKey ||
      process.env[privateKeyEnv];

    const interactive = parsedArgs.interactive !== undefined
      ? parsedArgs.interactive
      : (!hasCredentials && !parsedArgs.skipWallet);

    return {
      privateKey: parsedArgs.privateKey,
      publicKey: parsedArgs.publicKey,
      account: parsedArgs.account,
      privateKeyEnv,
      accountEnv,
      interactive,
      walletType: parsedArgs.walletType,
      walletConfig: args["walletConfig"] || {},
      skipWallet: parsedArgs.skipWallet,
    };
  }

  /**
   * Validate signing configuration
   */
  static validateSigningConfig(config: SigningConfig): string[] {
    const errors: string[] = [];

    // Skip validation if wallet is disabled
    if (config.skipWallet) {
      return errors;
    }

    // Check if we have any signing method available
    const hasPrivateKey = !!(config.privateKey || (config.privateKeyEnv && process.env[config.privateKeyEnv]));
    const hasPublicKey = !!config.publicKey;
    const hasWalletType = !!config.walletType;
    const hasInteractive = !!config.interactive;

    if (!hasPrivateKey && !hasPublicKey && !hasWalletType && !hasInteractive) {
      errors.push("No signing method configured. Provide privateKey, publicKey, walletType, or enable interactive mode.");
    }

    // Validate private key format if provided
    if (config.privateKey && !/^[0-9a-fA-F]{64}$/.test(config.privateKey)) {
      errors.push("Private key must be a 64-character hexadecimal string");
    }

    // Validate public key format if provided
    if (config.publicKey && !/^[0-9a-fA-F]{64}$/.test(config.publicKey)) {
      errors.push("Public key must be a 64-character hexadecimal string");
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
export function createWalletManager(
  config: PactToolboxConfigObj,
  signingConfig: SigningConfig = {},
  network?: string,
): WalletManager {
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
