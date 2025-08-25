import { useState, useEffect, useCallback, useMemo } from "react";
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

/**
 * Wallet hook state
 */
export interface WalletState {
  // Wallet state
  wallet: Wallet | null;
  wallets: Wallet[];
  availableWallets: WalletMetadata[];
  
  // Connection state
  isConnecting: boolean;
  isConnected: boolean;
  
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

/**
 * Main wallet hook that provides wallet state and actions
 */
export function useWallet(): WalletState {
  const manager = useMemo(() => WalletManager.getInstance(), []);
  
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [availableWallets, setAvailableWallets] = useState<WalletMetadata[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
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
      } catch (err) {
        if (!mounted) return;
        setError(err as Error);
      }
    };

    initialize();

    // Subscribe to events
    const handleConnected = (connectedWallet: Wallet) => {
      if (!mounted) return;
      setWallets(manager.getConnectedWallets());
      if (!wallet) {
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
  }, [manager, wallet]);

  // Connect action
  const connect = useCallback(async (options?: ConnectOptions): Promise<Wallet | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const connectedWallet = await manager.connect(options);
      setWallet(connectedWallet);
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

  const isConnected = Boolean(wallet);

  return {
    wallet,
    wallets,
    availableWallets,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
    sign,
    selectWallet,
    manager,
  };
}

/**
 * Hook to get just the primary wallet
 */
export function usePrimaryWallet(): Wallet | null {
  const { wallet } = useWallet();
  return wallet;
}

/**
 * Hook to get connection status
 */
export function useWalletConnection(): {
  isConnected: boolean;
  isConnecting: boolean;
  connect: (options?: ConnectOptions) => Promise<Wallet | null>;
  disconnect: () => Promise<void>;
} {
  const { isConnected, isConnecting, connect, disconnect } = useWallet();
  
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
  const { availableWallets } = useWallet();
  return availableWallets;
}

/**
 * Hook for signing transactions
 */
export function useWalletSign(): {
  sign: (tx: PartiallySignedTransaction | PartiallySignedTransaction[]) => Promise<SignedTransaction | SignedTransaction[] | null>;
  isReady: boolean;
  error: Error | null;
} {
  const { wallet, sign, error } = useWallet();
  
  return {
    sign,
    isReady: Boolean(wallet),
    error,
  };
}