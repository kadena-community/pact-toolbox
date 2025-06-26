// Core types and interfaces from wallet-core
export type {
  AutoConnectOptions,
  ConnectOptions,
  Wallet,
  WalletAccount,
  WalletErrorType,
  WalletEvents,
  WalletMetadata,
  WalletNetwork,
  WalletProvider,
} from "@pact-toolbox/wallet-core";

export { WalletError, BaseWallet, detectBrowserExtension } from "@pact-toolbox/wallet-core";

// Core services
export { WalletService, walletService } from "./wallet-service";

import type { ConnectOptions, Wallet, AutoConnectOptions, WalletProvider } from "@pact-toolbox/wallet-core";
// Convenience functions
import { walletService } from "./wallet-service";

/**
 * Connect to a specific wallet
 */
export async function connectWallet(walletId: string, options?: ConnectOptions): Promise<Wallet> {
  return walletService.connect(walletId, options);
}

/**
 * Auto-connect to the best available wallet
 */
export async function autoConnectWallet(options?: AutoConnectOptions): Promise<Wallet> {
  return walletService.autoConnect(options);
}

/**
 * Initialize wallet providers
 */
export function initializeWallets(providers: WalletProvider[]): void {
  walletService.registerAll(providers);
}

/**
 * Get available wallets
 */
export async function getAvailableWallets() {
  return walletService.getAvailableWallets();
}

/**
 * Get connected wallets
 */
export function getConnectedWallets() {
  return walletService.getConnectedWallets();
}

/**
 * Get primary wallet
 */
export function getPrimaryWallet() {
  return walletService.getPrimaryWallet();
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(walletId: string) {
  return walletService.disconnect(walletId);
}

/**
 * Clear all wallet connections
 */
export async function clearWallets() {
  return walletService.clearConnections();
}

/**
 * Configuration for WalletConnect provider
 */
export interface WalletConnectConfig {
  projectId: string;
  relayUrl?: string;
  networkId?: string;
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  pairingTopic?: string;
}

/**
 * Configuration for Magic provider
 */
export interface MagicConfig {
  magicApiKey: string;
  chainwebApiUrl?: string;
  chainId?: string;
  networkId?: string;
  createAccountsOnChain?: boolean;
}

/**
 * Wallet configuration map
 */
export interface WalletConfigs {
  walletconnect?: WalletConnectConfig;
  magic?: MagicConfig;
}

/**
 * Setup wallets with auto-connect capability
 */
export interface SetupWalletsOptions {
  autoConnect?: boolean;
  wallets?: string[];
  preferredWallets?: string[];
  skipUnavailable?: boolean;
  walletConfigs?: WalletConfigs;
}

export async function setupWallets(options: SetupWalletsOptions = {}): Promise<Wallet | null> {
  // Initialize default wallet providers if not already done
  const existingProviders = walletService.getProviders();
  const walletIds = options.wallets || ["keypair", "ecko", "chainweaver", "walletconnect", "zelcore"];

  // Only load providers that aren't already registered
  const missingWalletIds = walletIds.filter((id) => !existingProviders.some((provider) => provider.metadata.id === id));

  if (missingWalletIds.length > 0) {
    const providerPromises = missingWalletIds.map(async (walletId) => {
      try {
        switch (walletId) {
          case "keypair": {
            const { KeypairWalletProvider } = await import("./providers/keypair");
            return new KeypairWalletProvider();
          }
          case "ecko": {
            const { EckoWalletProvider } = await import("./providers/ecko");
            return new EckoWalletProvider();
          }
          case "chainweaver": {
            const { ChainweaverWalletProvider } = await import("./providers/chainweaver");
            return new ChainweaverWalletProvider();
          }
          case "walletconnect": {
            const { WalletConnectProvider } = await import("./providers/walletconnect");
            const config = options.walletConfigs?.walletconnect;
            if (!config?.projectId) {
              console.warn("WalletConnect requires a projectId. Skipping...");
              return null;
            }
            return new WalletConnectProvider(config);
          }
          case "zelcore": {
            const { ZelcoreWalletProvider } = await import("./providers/zelcore");
            return new ZelcoreWalletProvider();
          }
          case "magic": {
            const { MagicWalletProvider } = await import("./providers/magic");
            const config = options.walletConfigs?.magic;
            if (!config?.magicApiKey) {
              console.warn("Magic requires a magicApiKey. Skipping...");
              return null;
            }
            return new MagicWalletProvider(config);
          }
          default:
            console.warn(`Unknown wallet provider: ${walletId}`);
            return null;
        }
      } catch (error) {
        console.debug(`Failed to load wallet provider ${walletId}:`, error);
        return null;
      }
    });

    const loadedProviders = (await Promise.all(providerPromises)).filter(Boolean) as WalletProvider[];
    if (loadedProviders.length > 0) {
      walletService.registerAll(loadedProviders);
    }
  }

  // Auto-connect if requested
  if (options.autoConnect) {
    try {
      return await walletService.autoConnect({
        preferredWallets: options.preferredWallets,
        skipUnavailable: options.skipUnavailable !== false, // default to true
      });
    } catch (error) {
      console.debug("Auto-connect failed:", error);
      return null;
    }
  }

  return null;
}
