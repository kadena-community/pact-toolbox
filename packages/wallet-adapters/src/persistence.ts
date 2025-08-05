/**
 * Storage keys for wallet persistence
 */
const STORAGE_KEYS = {
  LAST_WALLET: "pact-toolbox-last-wallet",
  WALLET_PREFERENCES: "pact-toolbox-wallet-preferences",
} as const;

/**
 * Wallet connection persistence
 */
export interface WalletPersistence {
  lastWalletId?: string;
  lastConnectedAt?: number;
  autoConnect?: boolean;
}

/**
 * Get persisted wallet data
 */
export function getPersistedWallet(): WalletPersistence | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_WALLET);
    if (!data) return null;
    
    const parsed = JSON.parse(data) as WalletPersistence;
    
    // Check if data is too old (7 days)
    if (parsed.lastConnectedAt) {
      const daysSinceConnection = (Date.now() - parsed.lastConnectedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceConnection > 7) {
        clearPersistedWallet();
        return null;
      }
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save wallet connection data
 */
export function persistWallet(walletId: string, autoConnect = true): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const data: WalletPersistence = {
      lastWalletId: walletId,
      lastConnectedAt: Date.now(),
      autoConnect,
    };
    
    localStorage.setItem(STORAGE_KEYS.LAST_WALLET, JSON.stringify(data));
  } catch (error) {
    console.debug("Failed to persist wallet connection", error);
  }
}

/**
 * Clear persisted wallet data
 */
export function clearPersistedWallet(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_WALLET);
  } catch (error) {
    console.debug("Failed to clear persisted wallet", error);
  }
}

/**
 * Wallet preferences (theme, etc.)
 */
export interface WalletPreferences {
  theme?: "light" | "dark" | "auto";
  preferredOrder?: string[];
  showInstallGuide?: boolean;
}

/**
 * Get wallet preferences
 */
export function getWalletPreferences(): WalletPreferences {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const data = localStorage.getItem(STORAGE_KEYS.WALLET_PREFERENCES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save wallet preferences
 */
export function saveWalletPreferences(preferences: WalletPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.WALLET_PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.debug("Failed to save wallet preferences", error);
  }
}