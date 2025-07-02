import type { 
  WalletConfigurations, 
  TypeSafeWalletConfig,
  WalletUIConfig,
  WalletPreferencesConfig,
  KeypairWalletConfig,
  EckoWalletConfig,
  ChainweaverWalletConfig,
  ZelcoreWalletConfig,
  WalletConnectWalletConfig,
  MagicWalletConfig
} from "./types";

/**
 * Fluent config builder for type-safe wallet configuration
 */
export class WalletConfigBuilder<W extends WalletConfigurations = {}> {
  private config: TypeSafeWalletConfig<W> = {};

  /**
   * Enable keypair wallet
   */
  withKeypair(config?: KeypairWalletConfig | boolean): WalletConfigBuilder<W & { keypair: typeof config }> {
    return new WalletConfigBuilder<W & { keypair: typeof config }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        keypair: config ?? true,
      } as any,
    });
  }

  /**
   * Enable Ecko wallet
   */
  withEcko(config?: EckoWalletConfig | boolean): WalletConfigBuilder<W & { ecko: typeof config }> {
    return new WalletConfigBuilder<W & { ecko: typeof config }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        ecko: config ?? true,
      } as any,
    });
  }

  /**
   * Enable Chainweaver wallet
   */
  withChainweaver(config?: ChainweaverWalletConfig | boolean): WalletConfigBuilder<W & { chainweaver: typeof config }> {
    return new WalletConfigBuilder<W & { chainweaver: typeof config }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        chainweaver: config ?? true,
      } as any,
    });
  }

  /**
   * Enable Zelcore wallet
   */
  withZelcore(config?: ZelcoreWalletConfig | boolean): WalletConfigBuilder<W & { zelcore: typeof config }> {
    return new WalletConfigBuilder<W & { zelcore: typeof config }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        zelcore: config ?? true,
      } as any,
    });
  }

  /**
   * Enable WalletConnect (requires configuration)
   */
  withWalletConnect(config: WalletConnectWalletConfig): WalletConfigBuilder<W & { walletconnect: WalletConnectWalletConfig }> {
    if (!config.projectId) {
      throw new Error("WalletConnect requires a projectId");
    }
    
    return new WalletConfigBuilder<W & { walletconnect: WalletConnectWalletConfig }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        walletconnect: config,
      } as any,
    });
  }

  /**
   * Enable Magic Link (requires configuration)
   */
  withMagic(config: MagicWalletConfig): WalletConfigBuilder<W & { magic: MagicWalletConfig }> {
    if (!config.apiKey) {
      throw new Error("Magic requires an apiKey");
    }
    
    return new WalletConfigBuilder<W & { magic: MagicWalletConfig }>({
      ...this.config,
      wallets: {
        ...this.config.wallets,
        magic: config,
      } as any,
    });
  }

  /**
   * Configure UI options
   */
  withUI(ui: WalletUIConfig): WalletConfigBuilder<W> {
    return new WalletConfigBuilder<W>({
      ...this.config,
      ui: { ...this.config.ui, ...ui },
    });
  }

  /**
   * Configure preferences
   */
  withPreferences(preferences: WalletPreferencesConfig): WalletConfigBuilder<W> {
    return new WalletConfigBuilder<W>({
      ...this.config,
      preferences: { ...this.config.preferences, ...preferences },
    });
  }

  /**
   * Build the configuration
   */
  build(): TypeSafeWalletConfig<W> {
    return this.config;
  }

  /**
   * Private constructor
   */
  private constructor(config: TypeSafeWalletConfig<W>) {
    this.config = config;
  }

  /**
   * Create a new builder
   */
  static create(): WalletConfigBuilder<{}> {
    return new WalletConfigBuilder({});
  }
}

/**
 * Create a wallet configuration using the builder
 */
export function createWalletConfig() {
  return WalletConfigBuilder.create();
}