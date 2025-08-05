import type { MultiNetworkConfig } from "@pact-toolbox/types";

export interface ContextConfig {
  // Network configuration - use existing types
  networks?: MultiNetworkConfig;

  // Wallet configuration
  enableWalletUI?: boolean;
  autoConnectWallet?: boolean;
  preferredWallets?: string[];

  // Development settings
  devMode?: boolean;

  // Client configuration
  clientConfig?: {
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

// Re-export context interfaces from types package
export type { ContextState, ContextActions, PactToolboxContext } from "@pact-toolbox/types";

// Re-export ContextEventMap from types package
export type { ContextEventMap } from "@pact-toolbox/types";

// Re-export types for convenience
export type { MultiNetworkConfig, SerializableNetworkConfig } from "@pact-toolbox/types";
