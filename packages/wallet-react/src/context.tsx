import React, { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { WalletManager, WalletManagerConfig } from '@pact-toolbox/wallet-manager';
import type { Wallet, WalletAccount, WalletNetwork, WalletMetadata } from '@pact-toolbox/wallet-core';

/**
 * Wallet context state interface
 */
export interface WalletContextState {
  /** Wallet manager instance */
  walletManager: WalletManager | null;
  /** Manager initialization state */
  isInitialized: boolean;
  /** Manager initialization loading state */
  isInitializing: boolean;
  /** Initialization error */
  initError: Error | null;
  /** Currently connected wallets */
  connectedWallets: Wallet[];
  /** Primary (active) wallet */
  primaryWallet: Wallet | null;
  /** Available wallet providers */
  availableWallets: WalletMetadata[];
  /** Current account */
  account: WalletAccount | null;
  /** Current network */
  network: WalletNetwork | null;
  /** Connection loading state */
  isConnecting: boolean;
  /** Connection error */
  connectionError: Error | null;
}

/**
 * Wallet context actions interface
 */
export interface WalletContextActions {
  /** Connect to a wallet */
  connect: (walletId?: string) => Promise<Wallet>;
  /** Disconnect from a wallet */
  disconnect: (walletId?: string) => Promise<void>;
  /** Set primary wallet */
  setPrimaryWallet: (wallet: Wallet | string) => void;
  /** Refresh wallet state */
  refresh: () => Promise<void>;
}

/**
 * Complete wallet context interface
 */
export interface WalletContextValue extends WalletContextState, WalletContextActions {}

/**
 * Wallet context with default values
 */
const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Wallet provider props
 */
export interface WalletManagerProviderProps {
  children: ReactNode;
  /** Pre-configured wallet manager instance */
  walletManager?: WalletManager;
  /** Configuration for new wallet manager instance */
  config?: WalletManagerConfig;
  /** Auto-initialize the wallet manager (default: true) */
  autoInitialize?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
}

/**
 * Get global wallet manager instance
 */
function getGlobalWalletManager(): WalletManager | null {
  if (typeof globalThis !== 'undefined') {
    return (globalThis as any).__PACT_WALLET_MANAGER__ || null;
  }
  return null;
}

/**
 * Create wallet manager instance from config
 */
async function createWalletManagerFromConfig(config: WalletManagerConfig): Promise<WalletManager> {
  const { WalletManager: WalletManagerClass } = await import('@pact-toolbox/wallet-manager');
  return new WalletManagerClass(config);
}

/**
 * Wallet Manager Provider Component
 *
 * Provides wallet management context to child components.
 * Supports three initialization modes:
 * 1. Pre-configured instance via walletManager prop
 * 2. Global instance from globalThis.__PACT_WALLET_MANAGER__
 * 3. New instance created from config prop
 */
export function WalletManagerProvider({
  children,
  walletManager: providedWalletManager,
  config = {},
  autoInitialize = true,
  onError,
}: WalletManagerProviderProps): React.JSX.Element {
  // Refs for cleanup
  const cleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // State
  const [state, setState] = useState<WalletContextState>({
    walletManager: null,
    isInitialized: false,
    isInitializing: false,
    initError: null,
    connectedWallets: [],
    primaryWallet: null,
    availableWallets: [],
    account: null,
    network: null,
    isConnecting: false,
    connectionError: null,
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<WalletContextState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Refresh wallet state from manager
  const refreshState = useCallback(async (manager: WalletManager) => {
    if (!manager || !mountedRef.current) return;

    try {
      const connectedWallets = manager.getConnectedWallets();
      const primaryWallet = manager.getPrimaryWallet();
      const availableWallets = manager.getAvailableWallets();

      let account: WalletAccount | null = null;
      let network: WalletNetwork | null = null;

      if (primaryWallet) {
        try {
          account = await primaryWallet.getAccount();
          network = await primaryWallet.getNetwork();
        } catch (error) {
          console.debug('Failed to get wallet account/network:', error);
        }
      }

      updateState({
        connectedWallets,
        primaryWallet,
        availableWallets,
        account,
        network,
      });
    } catch (error) {
      console.error('Failed to refresh wallet state:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }, [updateState, onError]);

  // Setup wallet manager event listeners
  const setupEventListeners = useCallback((manager: WalletManager) => {
    const handleConnected = (_wallet: Wallet) => {
      if (!mountedRef.current) return;
      refreshState(manager);
    };

    const handleDisconnected = () => {
      if (!mountedRef.current) return;
      refreshState(manager);
    };

    const handlePrimaryWalletChanged = () => {
      if (!mountedRef.current) return;
      refreshState(manager);
    };

    const handleAccountChanged = (account: WalletAccount) => {
      if (!mountedRef.current) return;
      updateState({ account });
    };

    const handleNetworkChanged = (network: WalletNetwork) => {
      if (!mountedRef.current) return;
      updateState({ network });
    };

    const handleError = (error: Error) => {
      if (!mountedRef.current) return;
      updateState({ connectionError: error });
      if (onError) {
        onError(error);
      }
    };

    // Add event listeners
    manager.on('connected', handleConnected);
    manager.on('disconnected', handleDisconnected);
    manager.on('primaryWalletChanged', handlePrimaryWalletChanged);
    manager.on('accountChanged', handleAccountChanged);
    manager.on('networkChanged', handleNetworkChanged);
    manager.on('error', handleError);

    // Return cleanup function
    return () => {
      manager.off('connected', handleConnected);
      manager.off('disconnected', handleDisconnected);
      manager.off('primaryWalletChanged', handlePrimaryWalletChanged);
      manager.off('accountChanged', handleAccountChanged);
      manager.off('networkChanged', handleNetworkChanged);
      manager.off('error', handleError);
    };
  }, [refreshState, updateState, onError]);

  // Initialize wallet manager
  const initializeWalletManager = useCallback(async () => {
    if (!autoInitialize || !mountedRef.current) return;

    updateState({ isInitializing: true, initError: null });

    try {
      let manager: WalletManager;

      // Priority order: provided instance -> global instance -> new instance from config
      if (providedWalletManager) {
        manager = providedWalletManager;
      } else {
        const globalManager = getGlobalWalletManager();
        if (globalManager) {
          manager = globalManager;
        } else {
          manager = await createWalletManagerFromConfig(config);
        }
      }

      // Initialize (manager handles initialization check internally)
      await manager.initialize();

      if (!mountedRef.current) return;

      // Setup event listeners
      const cleanup = setupEventListeners(manager);
      cleanupRef.current = cleanup;

      // Update state
      updateState({
        walletManager: manager,
        isInitialized: true,
        isInitializing: false,
      });

      // Refresh initial state
      await refreshState(manager);
    } catch (error) {
      if (!mountedRef.current) return;

      const initError = error instanceof Error ? error : new Error(String(error));
      updateState({
        isInitializing: false,
        initError,
      });

      if (onError) {
        onError(initError);
      }
    }
  }, [
    autoInitialize,
    providedWalletManager,
    config,
    setupEventListeners,
    updateState,
    refreshState,
    onError,
  ]);

  // Actions
  const connect = useCallback(async (walletId?: string): Promise<Wallet> => {
    if (!state.walletManager) {
      throw new Error('Wallet manager not initialized');
    }

    updateState({ isConnecting: true, connectionError: null });

    try {
      const wallet = await state.walletManager.connect({ walletId });
      updateState({ isConnecting: false });
      return wallet;
    } catch (error) {
      const connectionError = error instanceof Error ? error : new Error(String(error));
      updateState({ isConnecting: false, connectionError });
      throw connectionError;
    }
  }, [state.walletManager, updateState]);

  const disconnect = useCallback(async (walletId?: string): Promise<void> => {
    if (!state.walletManager) {
      throw new Error('Wallet manager not initialized');
    }

    try {
      await state.walletManager.disconnect(walletId);
    } catch (error) {
      const disconnectError = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(disconnectError);
      }
      throw disconnectError;
    }
  }, [state.walletManager, onError]);

  const setPrimaryWallet = useCallback((wallet: Wallet | string): void => {
    if (!state.walletManager) {
      throw new Error('Wallet manager not initialized');
    }

    try {
      state.walletManager.setPrimaryWallet(wallet);
    } catch (error) {
      const setPrimaryError = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(setPrimaryError);
      }
      throw setPrimaryError;
    }
  }, [state.walletManager, onError]);

  const refresh = useCallback(async (): Promise<void> => {
    if (state.walletManager) {
      await refreshState(state.walletManager);
    }
  }, [state.walletManager, refreshState]);

  // Context value
  const contextValue: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    setPrimaryWallet,
    refresh,
  };

  // Initialize on mount
  useEffect(() => {
    initializeWalletManager();

    return () => {
      mountedRef.current = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [initializeWalletManager]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to access wallet context
 * @throws Error if used outside WalletManagerProvider
 */
export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWalletContext must be used within a WalletManagerProvider');
  }

  return context;
}