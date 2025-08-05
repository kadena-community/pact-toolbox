import { useEffect, useState, useCallback, useRef } from "react";
import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import { getWalletSystem } from "../wallet-system";
import type { TypeSafeWalletConfig } from "../config";

/**
 * Wallet hook state
 */
export interface WalletHookState {
  /** Current connected wallet */
  wallet: Wallet | null;
  /** Available wallets */
  availableWallets: WalletMetadata[];
  /** Connection state */
  isConnecting: boolean;
  /** Error state */
  error: Error | null;
  /** Connection status */
  isConnected: boolean;
}

/**
 * Wallet hook actions
 */
export interface WalletHookActions {
  /** Connect to a wallet */
  connect: (walletId?: string) => Promise<void>;
  /** Disconnect wallet */
  disconnect: (walletId?: string) => Promise<void>;
  /** Ensure wallet is connected */
  ensure: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

/**
 * Wallet hook return type
 */
export type UseWalletReturn = WalletHookState & WalletHookActions;

/**
 * React hook for wallet management
 */
export function useWallet(config?: TypeSafeWalletConfig): UseWalletReturn {
  const [state, setState] = useState<WalletHookState>({
    wallet: null,
    availableWallets: [],
    isConnecting: false,
    error: null,
    isConnected: false,
  });

  const systemRef = useRef<Awaited<ReturnType<typeof getWalletSystem>> | undefined>(undefined);
  const handlersRef = useRef<{
    handleConnected: (wallet: Wallet) => void;
    handleDisconnected: () => void;
    handleError: (error: Error) => void;
  } | null>(null);

  // Initialize wallet system
  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        const system = await getWalletSystem(config);
        if (!mounted) return;
        
        systemRef.current = system;

        // Load initial state
        const [available, primary] = await Promise.all([
          system.getAvailable(),
          Promise.resolve(system.getPrimary()),
        ]);

        if (!mounted) return;

        setState((prev: WalletHookState) => ({
          ...prev,
          availableWallets: available,
          wallet: primary,
          isConnected: !!primary,
        }));

        // Set up event listeners
        const handleConnected = (wallet: Wallet) => {
          if (!mounted) return;
          setState((prev: WalletHookState) => ({
            ...prev,
            wallet,
            isConnected: true,
            isConnecting: false,
            error: null,
          }));
        };

        const handleDisconnected = () => {
          if (!mounted) return;
          setState((prev: WalletHookState) => ({
            ...prev,
            wallet: null,
            isConnected: false,
          }));
        };

        const handleError = (error: Error) => {
          if (!mounted) return;
          setState((prev: WalletHookState) => ({
            ...prev,
            error,
            isConnecting: false,
          }));
        };

        // Store handlers in ref for cleanup
        handlersRef.current = {
          handleConnected,
          handleDisconnected,
          handleError,
        };

        system.on("connected", handleConnected);
        system.on("disconnected", handleDisconnected);
        system.on("error", handleError);

        // Auto-connect if configured
        if (config?.preferences?.autoConnect !== false) {
          system.autoConnect().catch(() => {
            // Ignore auto-connect failures
          });
        }
      } catch (error) {
        if (!mounted) return;
        setState((prev: WalletHookState) => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    }

    init();

    return () => {
      mounted = false;
      // Properly cleanup event listeners using stored handlers
      if (systemRef.current && handlersRef.current) {
        systemRef.current.off("connected", handlersRef.current.handleConnected);
        systemRef.current.off("disconnected", handlersRef.current.handleDisconnected);
        systemRef.current.off("error", handlersRef.current.handleError);
      }
    };
  }, []);

  // Connect action
  const connect = useCallback(async (walletId?: string) => {
    if (!systemRef.current) return;

    setState((prev: WalletHookState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      await systemRef.current.connect(walletId);
    } catch (error) {
      setState((prev: WalletHookState) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isConnecting: false,
      }));
      throw error;
    }
  }, []);

  // Disconnect action
  const disconnect = useCallback(async (walletId?: string) => {
    if (!systemRef.current) return;

    try {
      await systemRef.current.disconnect(walletId);
    } catch (error) {
      setState((prev: WalletHookState) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      throw error;
    }
  }, []);

  // Ensure action
  const ensure = useCallback(async () => {
    if (!systemRef.current) return;

    setState((prev: WalletHookState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      await systemRef.current.ensure();
    } catch (error) {
      setState((prev: WalletHookState) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isConnecting: false,
      }));
      throw error;
    }
  }, []);

  // Clear error action
  const clearError = useCallback(() => {
    setState((prev: WalletHookState) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    ensure,
    clearError,
  };
}