import { isBrowser } from "@pact-toolbox/utils";

interface WalletManagerLike {
  getPrimaryWallet: () => WalletLike | null;
  connect: (options?: any) => Promise<WalletLike | null>;
  getConnectedWallets: () => WalletLike[];
  getAvailableWallets?: () => any[];
}

export interface WalletLike {
  sign: (data: any) => Promise<any>;
  getAccount: () => Promise<string>;
}

function isWalletManagerLike(obj: any): obj is WalletManagerLike {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "getPrimaryWallet" in obj &&
    "connect" in obj &&
    "getConnectedWallets" in obj
  );
}

/**
 * Get the global wallet manager if available
 */
export function getGlobalWalletManager(): WalletManagerLike | null {
  // Try window first (for browser environment)
  if (isBrowser() && (window as any).__PACT_WALLET_MANAGER__) {
    const manager = (window as any).__PACT_WALLET_MANAGER__;
    if (isWalletManagerLike(manager)) {
      return manager;
    }
  }

  // Then try globalThis as fallback
  if (typeof globalThis !== "undefined" && (globalThis as any).__PACT_WALLET_MANAGER__) {
    const manager = (globalThis as any).__PACT_WALLET_MANAGER__;
    if (isWalletManagerLike(manager)) {
      return manager;
    }
  }

  return null;
}

/**
 * Get wallet manager or throw error if not found
 */
export async function getWalletManager(): Promise<any> {
  const globalManager = getGlobalWalletManager();
  if (globalManager) {
    return globalManager;
  }

  // Check if it's available on window (for dev environment)
  if (isBrowser() && (window as any).__PACT_WALLET_MANAGER__) {
    const manager = (window as any).__PACT_WALLET_MANAGER__;
    if (isWalletManagerLike(manager)) {
      return manager;
    }
  }

  throw new Error("Wallet manager not found. Please ensure wallet adapters are initialized.");
}
