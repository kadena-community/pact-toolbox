import React, { useEffect, useState, useCallback, createContext, useContext } from "react";
import { getDefaultModalManager, type ModalManagerOptions } from "../modal-manager";
import type { ModalManager } from "../modal-manager";

interface WalletModalContextValue {
  modalManager: ModalManager;
  showWalletSelector: () => Promise<string | null>;
  setTheme: (theme: "light" | "dark") => void;
}

const WalletModalContext = createContext<WalletModalContextValue | null>(null);

export interface WalletModalProviderProps {
  children: React.ReactNode;
  modalOptions?: ModalManagerOptions;
}

/**
 * Provider component that sets up wallet UI infrastructure
 */
export function WalletModalProvider({ children, modalOptions }: WalletModalProviderProps) {
  const [modalManager] = useState(() => getDefaultModalManager(modalOptions));

  useEffect(() => {
    // Initialize modal manager
    modalManager.initialize();

    return () => {
      // Cleanup on unmount
      modalManager.cleanup();
    };
  }, [modalManager]);

  const showWalletSelector = useCallback(async () => {
    return modalManager.showWalletSelector();
  }, [modalManager]);

  const setTheme = useCallback(
    (theme: "light" | "dark") => {
      modalManager.setTheme(theme);
    },
    [modalManager],
  );

  const value: WalletModalContextValue = {
    modalManager,
    showWalletSelector,
    setTheme,
  };

  return <WalletModalContext.Provider value={value}>{children}</WalletModalContext.Provider>;
}

/**
 * Hook to access wallet modal functionality
 */
export function useWalletModal() {
  const context = useContext(WalletModalContext);

  if (!context) {
    throw new Error("useWalletModal must be used within a WalletModalProvider");
  }

  return context;
}

/**
 * Hook to manually trigger wallet selection
 */
export function useWalletSelector() {
  const { showWalletSelector } = useWalletModal();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSelector = useCallback(async () => {
    setIsOpen(true);
    setError(null);

    try {
      const walletId = await showWalletSelector();
      if (walletId) {
        // Wallet was selected
        return walletId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select wallet");
    } finally {
      setIsOpen(false);
    }

    return null;
  }, [showWalletSelector]);

  return {
    openSelector,
    isOpen,
    error,
  };
}

/**
 * Component that automatically shows wallet selector on mount if no wallet is connected
 */
export function AutoConnectWallet({ children }: { children?: React.ReactNode }) {
  const { modalManager } = useWalletModal();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check if wallet is already connected
        const { getWalletSystem } = await import("@pact-toolbox/wallet-adapters");

        const walletSystem = await getWalletSystem();
        if (!walletSystem.getPrimaryWallet()) {
          // No wallet connected, show selector
          const walletId = await modalManager.showWalletSelector();
          if (walletId) {
            await modalManager.connectWallet(walletId);
          }
        }
      } catch (error) {
        console.error("Auto-connect failed:", error);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
  }, [modalManager]);

  if (checking) {
    return <div>Checking wallet connection...</div>;
  }

  return <>{children}</>;
}

/**
 * Button component that triggers wallet selection
 */
export interface ConnectWalletButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  onConnect?: (walletId: string) => void;
  onError?: (error: Error) => void;
}

export function ConnectWalletButton({
  children = "Connect Wallet",
  onConnect,
  onError,
  ...props
}: ConnectWalletButtonProps) {
  const { openSelector, isOpen } = useWalletSelector();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleClick = async () => {
    setIsConnecting(true);

    try {
      const walletId = await openSelector();
      if (walletId && onConnect) {
        onConnect(walletId);
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button {...props} onClick={handleClick} disabled={props.disabled || isOpen || isConnecting}>
      {isConnecting ? "Connecting..." : children}
    </button>
  );
}
