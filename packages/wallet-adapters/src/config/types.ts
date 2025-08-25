import type { ChainId } from "@pact-toolbox/types";

/**
 * Built-in wallet configuration
 */
export interface BuiltInWalletConfig {
  /** Enable or disable the wallet */
  enabled?: boolean;
}

/**
 * Keypair wallet specific configuration
 */
export interface KeypairWalletConfig extends BuiltInWalletConfig {
  /** Use deterministic key generation */
  deterministic?: boolean;
  /** Seed for deterministic generation */
  seed?: string;
  /** Private key to use */
  privateKey?: string;
  /** Account name */
  accountName?: string;
  /** Chain ID */
  chainId?: ChainId;
  /** Network ID */
  networkId?: string;
  /** Network name */
  networkName?: string;
  /** RPC URL */
  rpcUrl?: string;
  /** Whether to show DevWallet UI (defaults to auto-detect based on network) */
  showUI?: boolean;
  /** Force DevWallet usage even in non-browser environments */
  forceDevWallet?: boolean;
}

/**
 * Ecko wallet specific configuration
 */
export interface EckoWalletConfig extends BuiltInWalletConfig {
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Chainweaver wallet specific configuration
 */
export interface ChainweaverWalletConfig extends BuiltInWalletConfig {
  /** Desktop app port */
  port?: number;
}

/**
 * Zelcore wallet specific configuration
 */
export interface ZelcoreWalletConfig extends BuiltInWalletConfig {
  /** Desktop app port */
  port?: number;
}

/**
 * WalletConnect configuration (required)
 */
export interface WalletConnectWalletConfig {
  /** WalletConnect project ID (required) */
  projectId: string;
  /** Relay URL */
  relayUrl?: string;
  /** Metadata */
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  /** Pairing topic for reconnection */
  pairingTopic?: string;
}

/**
 * Magic Link configuration (required)
 */
export interface MagicWalletConfig {
  /** Magic API key (required) */
  apiKey: string;
  /** Chainweb API URL */
  chainwebApiUrl?: string;
  /** Chain ID */
  chainId?: ChainId;
  /** Network ID */
  networkId?: string;
  /** Create accounts on chain */
  createAccountsOnChain?: boolean;
}

/**
 * Complete wallet configuration with type safety
 */
export interface WalletConfigurations {
  /** Keypair wallet configuration */
  keypair?: KeypairWalletConfig | boolean;
  /** Ecko wallet configuration */
  ecko?: EckoWalletConfig | boolean;
  /** Chainweaver wallet configuration */
  chainweaver?: ChainweaverWalletConfig | boolean;
  /** Zelcore wallet configuration */
  zelcore?: ZelcoreWalletConfig | boolean;
  /** WalletConnect configuration (required if enabled) */
  walletconnect?: WalletConnectWalletConfig;
  /** Magic Link configuration (required if enabled) */
  magic?: MagicWalletConfig;
}

/**
 * Type helper to extract enabled wallet names
 */
export type EnabledWallets<T extends WalletConfigurations> = {
  [K in keyof T]: T[K] extends false ? never : K;
}[keyof T];

/**
 * Type helper to validate required configs
 */
export type ValidateWalletConfig<T extends WalletConfigurations> = T extends {
  walletconnect: boolean | BuiltInWalletConfig;
}
  ? "WalletConnect requires projectId configuration"
  : T extends { magic: boolean | BuiltInWalletConfig }
    ? "Magic requires apiKey configuration"
    : T;

/**
 * Theme configuration
 */
export interface WalletThemeConfig {
  /** Color scheme */
  theme?: "light" | "dark" | "auto";
  /** Primary color */
  primaryColor?: string;
  /** Border radius */
  borderRadius?: string;
  /** Font family */
  fontFamily?: string;
}

/**
 * UI configuration
 */
export interface WalletUIConfig {
  /** Show UI on connect */
  showOnConnect?: boolean;
  /** Show wallet installation guide */
  showInstallGuide?: boolean;
  /** Modal z-index */
  zIndex?: number;
  /** Theme configuration */
  theme?: WalletThemeConfig;
}

/**
 * Preferences configuration
 */
export interface WalletPreferencesConfig {
  /** Auto-connect on page load */
  autoConnect?: boolean;
  /** Remember last connected wallet */
  rememberLast?: boolean;
  /** Preferred wallet order */
  preferredOrder?: string[];
  /** Connection timeout */
  timeout?: number;
}

/**
 * Complete wallet system configuration
 */
export interface WalletConfig<W extends WalletConfigurations = WalletConfigurations> {
  /** Wallet configurations */
  wallets?: W;
  /** UI options */
  ui?: WalletUIConfig;
  /** User preferences */
  preferences?: WalletPreferencesConfig;
}

/**
 * Type-safe config builder
 */
export function defineWalletConfig<W extends WalletConfigurations>(
  config: WalletConfig<W> & ValidateWalletConfig<W>,
): WalletConfig<W> {
  return config;
}
