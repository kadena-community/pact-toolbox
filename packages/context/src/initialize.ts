import type { ContextConfig } from "./types";
import type { TypeSafeWalletConfig } from "@pact-toolbox/wallet-adapters";
import { getStore, resetStore } from "./store";
import { walletPresets } from "./react";
import { eventBus } from "./events";

/**
 * Configuration options for initializing PactToolbox
 */
export interface PactToolboxInitOptions extends ContextConfig {
  /**
   * Full wallet system configuration
   */
  walletConfig?: TypeSafeWalletConfig;
  
  /**
   * Use a preset configuration
   */
  preset?: "development" | "production" | "test";
}

/**
 * Initialize PactToolbox context for non-React environments
 * 
 * This provides the same functionality as PactToolboxProvider but for vanilla JS/TS
 * 
 * @example
 * ```ts
 * // Basic initialization with auto-detection
 * const pactToolbox = await initializePactToolbox();
 * 
 * // Use preset configuration
 * const pactToolbox = await initializePactToolbox({
 *   preset: "development"
 * });
 * 
 * // Custom configuration
 * const pactToolbox = await initializePactToolbox({
 *   networks: myNetworkConfig,
 *   walletConfig: {
 *     wallets: {
 *       keypair: {
 *         showUI: true,
 *         networkId: "development"
 *       },
 *       ecko: true
 *     },
 *     preferences: {
 *       autoConnect: true,
 *       preferredOrder: ["keypair", "ecko"]
 *     }
 *   }
 * });
 * 
 * // Access the context
 * const { wallet, network, connectWallet } = pactToolbox;
 * 
 * // Connect a wallet
 * await connectWallet("ecko");
 * 
 * // Switch networks
 * await pactToolbox.setNetwork("mainnet01");
 * 
 * // Subscribe to events
 * pactToolbox.on("wallet:connected", ({ wallet }) => {
 *   console.log("Wallet connected:", wallet);
 * });
 * ```
 */
export async function initializePactToolbox(options: PactToolboxInitOptions = {}) {
  // Reset any existing store (useful for testing)
  resetStore();
  
  // Extract wallet config from options
  const { walletConfig, preset, ...contextConfig } = options;
  
  // Build final wallet configuration
  let finalWalletConfig: TypeSafeWalletConfig | undefined;
  
  if (walletConfig) {
    // Use provided wallet config
    finalWalletConfig = walletConfig;
  } else if (preset) {
    // Use preset configuration
    finalWalletConfig = walletPresets[preset];
  } else if (contextConfig.preferredWallets || contextConfig.autoConnectWallet !== undefined) {
    // Build from legacy config
    finalWalletConfig = {
      preferences: {
        autoConnect: contextConfig.autoConnectWallet,
        preferredOrder: contextConfig.preferredWallets,
      },
      ui: {
        showOnConnect: contextConfig.enableWalletUI,
      }
    };
  } else {
    // Default configuration based on environment
    const isBrowser = typeof window !== "undefined";
    const isLocal = isBrowser && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1");
    
    const isNode = !isBrowser;
    
    finalWalletConfig = {
      wallets: isLocal && !isNode ? {
        keypair: {
          deterministic: true,
          showUI: true, // Enable DevWallet UI for local browser development
        }
      } : undefined,
      preferences: {
        autoConnect: false,
      },
      ui: {
        showOnConnect: !isNode && contextConfig.enableWalletUI !== false,
      }
    };
  }
  
  // Create enhanced config with wallet config
  const enhancedConfig = {
    ...contextConfig,
    _walletConfig: finalWalletConfig,
  } as ContextConfig & { _walletConfig: TypeSafeWalletConfig };
  
  // Initialize the store
  const store = getStore(enhancedConfig);
  
  // Wait for wallet system initialization if needed
  if (contextConfig.enableWalletUI !== false) {
    // Give wallet system time to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Return the store with event subscription capabilities
  return {
    // State getters
    get network() { return store.network; },
    get networks() { return store.networks; },
    get wallet() { return store.wallet; },
    get wallets() { return store.wallets; },
    get isConnecting() { return store.isConnecting; },
    get client() { return store.client; },
    get clients() { return store.clients; },
    get isWalletModalOpen() { return store.isWalletModalOpen; },
    get environment() { return store.environment; },
    get isDevNet() { return store.isDevNet; },
    
    // Actions
    setNetwork: store.setNetwork.bind(store),
    connectWallet: store.connectWallet.bind(store),
    disconnectWallet: store.disconnectWallet.bind(store),
    setWallet: store.setWallet.bind(store),
    openWalletModal: store.openWalletModal.bind(store),
    closeWalletModal: store.closeWalletModal.bind(store),
    getClient: store.getClient.bind(store),
    updateConfig: store.updateConfig.bind(store),
    
    // Event subscription
    on: (event: string, handler: any) => {
      return eventBus.on(event as any, handler);
    },
    off: (event: string, handler: any) => {
      return eventBus.off(event as any, handler);
    },
    once: (event: string, handler: any) => {
      return eventBus.once(event as any, handler);
    },
  };
}

/**
 * Type for the initialized PactToolbox instance
 */
export type PactToolboxInstance = Awaited<ReturnType<typeof initializePactToolbox>>;

/**
 * Global instance holder for convenience
 */
let globalInstance: PactToolboxInstance | null = null;

/**
 * Get or create a global PactToolbox instance
 * 
 * @example
 * ```ts
 * // First call initializes with options
 * const pactToolbox = await getPactToolbox({
 *   preset: "development"
 * });
 * 
 * // Subsequent calls return the same instance
 * const samePactToolbox = await getPactToolbox();
 * ```
 */
export async function getPactToolbox(options?: PactToolboxInitOptions): Promise<PactToolboxInstance> {
  if (!globalInstance) {
    globalInstance = await initializePactToolbox(options);
  }
  return globalInstance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetPactToolbox(): void {
  globalInstance = null;
  resetStore();
}