import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from "react";
import type { PactToolboxContext, ContextConfig, ContextEventMap } from "./types";
import type { TypeSafeWalletConfig } from "@pact-toolbox/wallet-adapters";
import { getStore, PactToolboxStore } from "./store";
import { createConfigWithGlobal } from "./config";
import { eventBus } from "./events";

const PactToolboxReactContext = createContext<PactToolboxContext | null>(null);

/**
 * Configuration that includes full wallet system config
 */
export interface PactToolboxContextConfig extends Omit<ContextConfig, 'preferredWallets'> {
  /**
   * Full wallet system configuration
   * This replaces the simple preferredWallets array with a comprehensive config
   */
  walletConfig?: TypeSafeWalletConfig;
  
  /**
   * Legacy wallet configuration (for backward compatibility)
   */
  preferredWallets?: string[];
}

export interface PactToolboxProviderProps {
  /**
   * Configuration for the context and wallet system
   */
  config?: Partial<PactToolboxContextConfig>;
  
  /**
   * Wallet configuration (overrides config.walletConfig if provided)
   * This allows for more flexible wallet configuration
   */
  walletConfig?: TypeSafeWalletConfig;
  
  /**
   * Use a preset configuration
   */
  preset?: "development" | "production" | "test";
  
  /**
   * Children components
   */
  children: React.ReactNode;
}

/**
 * PactToolboxProvider with full wallet system integration
 * 
 * @example
 * ```tsx
 * // Basic usage with auto-detection
 * <PactToolboxProvider>
 *   <App />
 * </PactToolboxProvider>
 * 
 * // Custom wallet configuration
 * <PactToolboxProvider
 *   walletConfig={{
 *     wallets: {
 *       keypair: {
 *         networkId: "development",
 *         showUI: true // Enable DevWallet UI
 *       },
 *       ecko: true,
 *       chainweaver: false // Disable chainweaver
 *     },
 *     preferences: {
 *       autoConnect: true,
 *       preferredOrder: ["keypair", "ecko"]
 *     }
 *   }}
 * >
 *   <App />
 * </PactToolboxProvider>
 * 
 * // Production configuration
 * <PactToolboxProvider
 *   config={{
 *     networks: productionNetworks,
 *     enableWalletUI: true
 *   }}
 *   walletConfig={{
 *     wallets: {
 *       ecko: true,
 *       chainweaver: true,
 *       zelcore: true,
 *       walletconnect: {
 *         projectId: "your-project-id"
 *       }
 *     },
 *     ui: {
 *       showOnConnect: true,
 *       theme: { theme: "dark" }
 *     }
 *   }}
 * >
 *   <App />
 * </PactToolboxProvider>
 * 
 * // Use preset configuration
 * <PactToolboxProvider preset="development">
 *   <App />
 * </PactToolboxProvider>
 * ```
 */
export function PactToolboxProvider({ 
  config = {}, 
  walletConfig,
  preset,
  children 
}: PactToolboxProviderProps) {
  // Merge wallet configuration
  const mergedWalletConfig = useMemo(() => {
    // Priority: props.walletConfig > preset > config.walletConfig > legacy config
    if (walletConfig) {
      return walletConfig;
    }
    
    if (preset) {
      return walletPresets[preset];
    }
    
    if (config.walletConfig) {
      return config.walletConfig;
    }
    
    // Build from legacy config
    if (config.preferredWallets || config.autoConnectWallet !== undefined) {
      return {
        preferences: {
          autoConnect: config.autoConnectWallet,
          preferredOrder: config.preferredWallets,
        },
        ui: {
          showOnConnect: config.enableWalletUI,
        }
      } as TypeSafeWalletConfig;
    }
    
    // Default configuration based on environment
    const isLocal = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1");
    
    return {
      wallets: isLocal ? {
        keypair: {
          deterministic: true,
          showUI: true, // Enable DevWallet UI for local development
        }
      } : undefined,
      preferences: {
        autoConnect: false,
      },
      ui: {
        showOnConnect: true,
      }
    } as TypeSafeWalletConfig;
  }, [config, walletConfig, preset]);
  
  // Create full config with wallet config integrated
  const fullConfig = useMemo(() => {
    const baseConfig = createConfigWithGlobal(config);
    
    // Inject wallet config into the store config
    return {
      ...baseConfig,
      // Store the wallet config for the wallet integration to use
      _walletConfig: mergedWalletConfig,
    } as ContextConfig & { _walletConfig: TypeSafeWalletConfig };
  }, [config, mergedWalletConfig]);
  
  const storeRef = useRef<PactToolboxStore | undefined>(undefined);

  if (!storeRef.current) {
    storeRef.current = getStore(fullConfig);
  }

  const store = storeRef.current;

  // Create state that will trigger re-renders
  const [state, setState] = useState({
    network: store.network,
    wallet: store.wallet,
    isConnecting: store.isConnecting,
    isWalletModalOpen: store.isWalletModalOpen,
  });

  // Subscribe to store changes
  useEffect(() => {
    const networkChangedHandler = ({ network }: any) => {
      setState((prev) => ({ ...prev, network }));
    };
    const walletChangedHandler = ({ wallet }: any) => {
      setState((prev) => ({ ...prev, wallet }));
    };
    const walletConnectedHandler = ({ wallet }: any) => {
      setState((prev) => ({ ...prev, wallet, isConnecting: false }));
    };
    const walletDisconnectedHandler = () => {
      setState((prev) => ({ ...prev, wallet: null }));
    };
    const modalOpenHandler = () => {
      setState((prev) => ({ ...prev, isWalletModalOpen: true }));
    };
    const modalCloseHandler = () => {
      setState((prev) => ({ ...prev, isWalletModalOpen: false }));
    };

    // Subscribe to events
    eventBus.on("network:changed", networkChangedHandler);
    eventBus.on("wallet:changed", walletChangedHandler);
    eventBus.on("wallet:connected", walletConnectedHandler);
    eventBus.on("wallet:disconnected", walletDisconnectedHandler);
    eventBus.on("wallet:modal:open", modalOpenHandler);
    eventBus.on("wallet:modal:close", modalCloseHandler);

    // Cleanup
    return () => {
      eventBus.off("network:changed", networkChangedHandler);
      eventBus.off("wallet:changed", walletChangedHandler);
      eventBus.off("wallet:connected", walletConnectedHandler);
      eventBus.off("wallet:disconnected", walletDisconnectedHandler);
      eventBus.off("wallet:modal:open", modalOpenHandler);
      eventBus.off("wallet:modal:close", modalCloseHandler);
    };
  }, []);

  // Create context value
  const contextValue: PactToolboxContext = useMemo(
    () => ({
      // State
      network: state.network,
      networks: store.networks,
      wallet: state.wallet,
      wallets: store.wallets,
      isConnecting: state.isConnecting,
      client: store.client,
      clients: store.clients,
      isWalletModalOpen: state.isWalletModalOpen,
      environment: store.environment,
      isDevNet: store.isDevNet,

      // Actions
      setNetwork: store.setNetwork.bind(store),
      connectWallet: store.connectWallet.bind(store),
      disconnectWallet: store.disconnectWallet.bind(store),
      setWallet: store.setWallet.bind(store),
      openWalletModal: store.openWalletModal.bind(store),
      closeWalletModal: store.closeWalletModal.bind(store),
      getClient: store.getClient.bind(store),
      updateConfig: store.updateConfig.bind(store),
    }),
    [state, store],
  );

  return <PactToolboxReactContext.Provider value={contextValue}>{children}</PactToolboxReactContext.Provider>;
}

// Hook to use the context
export function usePactToolboxContext(): PactToolboxContext {
  const context = useContext(PactToolboxReactContext);
  if (!context) {
    throw new Error("usePactToolboxContext must be used within a PactToolboxProvider");
  }
  return context;
}

// Convenience hooks
export function useNetwork() {
  const { network, networks, setNetwork } = usePactToolboxContext();
  return { network, networks, setNetwork };
}

export function useWallet() {
  const { wallet, wallets, connectWallet, disconnectWallet, isConnecting } = usePactToolboxContext();
  return { wallet, wallets, connectWallet, disconnectWallet, isConnecting };
}

export function useClient() {
  const { client, getClient } = usePactToolboxContext();
  return { client, getClient };
}

export function useWalletModal() {
  const { isWalletModalOpen, openWalletModal, closeWalletModal } = usePactToolboxContext();
  return { isOpen: isWalletModalOpen, open: openWalletModal, close: closeWalletModal };
}

// Hook to subscribe to specific events
export function usePactToolboxEvent<K extends keyof ContextEventMap>(event: K, handler: ContextEventMap[K]) {
  useEffect(() => {
    eventBus.on(event, handler as any);
    return () => {
      eventBus.off(event, handler as any);
    };
  }, [event, handler]);
}

/**
 * Default configurations for common scenarios
 */
export const walletPresets = {
  /**
   * Development preset - Keypair wallet with DevWallet UI
   */
  development: {
    wallets: {
      keypair: {
        deterministic: true,
        showUI: true,
      },
      ecko: true,
      chainweaver: true,
    },
    preferences: {
      autoConnect: true,
      preferredOrder: ["keypair", "ecko", "chainweaver"],
    },
  } as TypeSafeWalletConfig,
  
  /**
   * Production preset - Browser wallets only
   */
  production: {
    wallets: {
      ecko: true,
      chainweaver: true,
      zelcore: true,
    },
    preferences: {
      autoConnect: true,
      preferredOrder: ["ecko", "chainweaver", "zelcore"],
    },
    ui: {
      showOnConnect: true,
      showInstallGuide: true,
    },
  } as TypeSafeWalletConfig,
  
  /**
   * Test preset - Minimal configuration
   */
  test: {
    wallets: {
      keypair: {
        deterministic: true,
        privateKey: "0000000000000000000000000000000000000000000000000000000000000000",
      },
    },
    preferences: {
      autoConnect: false,
    },
    ui: {
      showOnConnect: false,
    },
  } as TypeSafeWalletConfig,
} as const;
