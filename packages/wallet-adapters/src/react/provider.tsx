import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import type {
  Wallet,
  WalletMetadata,
  ConnectOptions,
} from "@pact-toolbox/wallet-core";
import type {
  PartiallySignedTransaction,
  SignedTransaction,
} from "@pact-toolbox/types";
import { WalletManager } from "../wallet-manager";
import type { WalletConfig } from "../config";

/**
 * Wallet context value
 */
export interface WalletContextValue {
  // Wallet state
  wallet: Wallet | null;
  wallets: Wallet[];
  availableWallets: WalletMetadata[];
  
  // Connection state
  isConnecting: boolean;
  isConnected: boolean;
  isInitialized: boolean;
  
  // Error state
  error: Error | null;
  
  // Actions
  connect: (options?: ConnectOptions) => Promise<Wallet | null>;
  disconnect: (walletId?: string) => Promise<void>;
  sign: (tx: PartiallySignedTransaction | PartiallySignedTransaction[]) => Promise<SignedTransaction | SignedTransaction[] | null>;
  selectWallet: (walletId: string) => void;
  
  // Manager instance
  manager: WalletManager;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Wallet provider props
 */
export interface WalletProviderProps {
  children: ReactNode;
  config?: WalletConfig;
}

/**
 * Wallet provider component that manages wallet state
 */
export function WalletProvider({ children, config = {} }: WalletProviderProps) {
  const manager = useMemo(() => WalletManager.getInstance(config), []);
  
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [availableWallets, setAvailableWallets] = useState<WalletMetadata[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize manager and load state
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await manager.initialize();
        
        if (!mounted) return;
        
        setWallet(manager.getPrimaryWallet());
        setWallets(manager.getConnectedWallets());
        setAvailableWallets(manager.getAvailableWallets());
        setIsInitialized(true);
      } catch (err) {
        if (!mounted) return;
        setError(err as Error);
        setIsInitialized(true);
      }
    };

    initialize();

    // Subscribe to events
    const handleConnected = (connectedWallet: Wallet) => {
      if (!mounted) return;
      setWallets(manager.getConnectedWallets());
      if (!manager.getPrimaryWallet()) {
        setWallet(connectedWallet);
      }
      setError(null);
    };

    const handleDisconnected = () => {
      if (!mounted) return;
      setWallets(manager.getConnectedWallets());
      setWallet(manager.getPrimaryWallet());
    };

    const handlePrimaryChanged = (primary: Wallet | null) => {
      if (!mounted) return;
      setWallet(primary);
    };

    const handleError = (err: Error) => {
      if (!mounted) return;
      setError(err);
    };

    manager.on("connected", handleConnected);
    manager.on("disconnected", handleDisconnected);
    manager.on("primaryWalletChanged", handlePrimaryChanged);
    manager.on("error", handleError);

    return () => {
      mounted = false;
      manager.off("connected", handleConnected);
      manager.off("disconnected", handleDisconnected);
      manager.off("primaryWalletChanged", handlePrimaryChanged);
      manager.off("error", handleError);
    };
  }, [manager]);

  // Connect action
  const connect = useCallback(async (options?: ConnectOptions): Promise<Wallet | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const connectedWallet = await manager.connect(options);
      return connectedWallet;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [manager]);

  // Disconnect action
  const disconnect = useCallback(async (walletId?: string): Promise<void> => {
    setError(null);
    
    try {
      await manager.disconnect(walletId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [manager]);

  // Sign action
  const sign = useCallback(async (
    tx: PartiallySignedTransaction | PartiallySignedTransaction[]
  ): Promise<SignedTransaction | SignedTransaction[] | null> => {
    if (!wallet) {
      setError(new Error("No wallet connected"));
      return null;
    }
    
    setError(null);
    
    try {
      return await manager.sign(tx as any);
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, [manager, wallet]);

  // Select wallet action
  const selectWallet = useCallback((walletId: string) => {
    try {
      manager.setPrimaryWallet(walletId);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, [manager]);

  const value = useMemo<WalletContextValue>(() => ({
    wallet,
    wallets,
    availableWallets,
    isConnecting,
    isConnected: Boolean(wallet),
    isInitialized,
    error,
    connect,
    disconnect,
    sign,
    selectWallet,
    manager,
  }), [
    wallet,
    wallets,
    availableWallets,
    isConnecting,
    isInitialized,
    error,
    connect,
    disconnect,
    sign,
    selectWallet,
    manager,
  ]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to use wallet context
 */
export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

/**
 * Main wallet hook
 */
export function useWallet() {
  return useWalletContext();
}

/**
 * Hook to get just the primary wallet
 */
export function usePrimaryWallet(): Wallet | null {
  const { wallet } = useWalletContext();
  return wallet;
}

/**
 * Hook to get connection status
 */
export function useWalletConnection() {
  const { isConnected, isConnecting, connect, disconnect } = useWalletContext();
  
  return {
    isConnected,
    isConnecting,
    connect,
    disconnect: () => disconnect(),
  };
}

/**
 * Hook to get available wallets
 */
export function useAvailableWallets(): WalletMetadata[] {
  const { availableWallets } = useWalletContext();
  return availableWallets;
}

/**
 * Hook for signing transactions
 */
export function useWalletSign() {
  const { wallet, sign, error } = useWalletContext();
  
  return {
    sign,
    isReady: Boolean(wallet),
    error,
  };
}