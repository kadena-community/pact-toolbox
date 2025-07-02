/**
 * React-specific exports for wallet adapters
 * 
 * This entry point only exports React-related functionality,
 * allowing non-React users to import from the main entry point
 * without pulling in React dependencies.
 */

// Export React hooks
export { useWallet } from "./react/use-wallet";
export { useNetwork } from "./react/use-network";

// Export types that are useful for React components
export type { 
  WalletHookState,
  WalletHookActions,
  UseWalletReturn
} from "./react/use-wallet";
export type { UseNetworkReturn } from "./react/use-network";

// Re-export core types that React components might need
export type { 
  TypeSafeWalletConfig,
  WalletConfigurations,
  KeypairWalletConfig,
  EckoWalletConfig,
  ChainweaverWalletConfig,
  ZelcoreWalletConfig,
  WalletConnectWalletConfig,
  MagicWalletConfig,
} from "./config/types";

export type {
  Wallet,
  WalletMetadata,
  WalletProvider,
} from "@pact-toolbox/wallet-core";