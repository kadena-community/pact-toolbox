import { openDB, type IDBPDatabase } from "idb";
import { encrypt, decrypt } from "@pact-toolbox/crypto";
import type { DevWalletKey, DevWalletTransaction, DevWalletSettings } from "./types";

export class DevWalletStorage {
  private dbName = "pact-toolbox-dev-wallet";
  private db: IDBPDatabase | null = null;
  private prefix: string;
  private encryptionPassword?: string;

  constructor(prefix = "pact-toolbox-wallet") {
    this.prefix = prefix;
  }

  /**
   * Set the encryption password for this session
   */
  async setEncryptionPassword(password: string): Promise<void> {
    this.encryptionPassword = password;
  }

  /**
   * Get the encryption password
   */
  private getEncryptionPassword(): string | undefined {
    return this.encryptionPassword;
  }

  /**
   * Clear the encryption password from memory
   */
  clearEncryptionPassword(): void {
    this.encryptionPassword = undefined;
  }

  private async getDB(): Promise<IDBPDatabase | null> {
    if (typeof window === "undefined" || !("indexedDB" in globalThis)) {
      return null;
    }

    if (!this.db) {
      this.db = await openDB(this.dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("keys")) {
            db.createObjectStore("keys", { keyPath: "address" });
          }
          if (!db.objectStoreNames.contains("transactions")) {
            db.createObjectStore("transactions", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
          }
        },
      });
    }
    return this.db;
  }

  async getKeys(): Promise<DevWalletKey[]> {
    let keys: DevWalletKey[] = [];
    
    const db = await this.getDB();
    if (db) {
      keys = await db.getAll("keys");
    } else if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      // Fallback to localStorage in browser
      const stored = localStorage.getItem(`${this.prefix}-keys`);
      keys = stored ? JSON.parse(stored) : [];
    }
    
    // Decrypt private keys if we have a password
    const password = this.getEncryptionPassword();
    if (password) {
      const decryptedKeys = await Promise.all(
        keys.map(async (key) => {
          if (key.encryptedPrivateKey && !key.privateKey) {
            try {
              const decryptedPrivateKey = await decrypt(key.encryptedPrivateKey, password);
              return { ...key, privateKey: decryptedPrivateKey };
            } catch (error) {
              // If decryption fails, return key without private key
              console.error("Failed to decrypt key", error);
              return key;
            }
          }
          return key;
        })
      );
      return decryptedKeys;
    }
    
    return keys;
  }

  async saveKey(key: DevWalletKey): Promise<void> {
    // Create a copy to avoid modifying the original
    const keyToStore = { ...key };

    // If encryption password is set, encrypt the private key
    const password = this.getEncryptionPassword();
    if (password && key.privateKey) {
      keyToStore.encryptedPrivateKey = await encrypt(key.privateKey, password);
      // Clear the plain text private key before storage
      keyToStore.privateKey = "";
    }

    const db = await this.getDB();
    if (db) {
      await db.put("keys", keyToStore);
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const keys = await this.getKeys();
      const existingIndex = keys.findIndex(k => k.address === key.address);
      if (existingIndex >= 0) {
        keys[existingIndex] = keyToStore;
      } else {
        keys.push(keyToStore);
      }
      localStorage.setItem(`${this.prefix}-keys`, JSON.stringify(keys));
    }
  }

  async removeKey(address: string): Promise<void> {
    const db = await this.getDB();
    if (db) {
      await db.delete("keys", address);
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const keys = await this.getKeys();
      const filtered = keys.filter(k => k.address !== address);
      localStorage.setItem(`${this.prefix}-keys`, JSON.stringify(filtered));
    }
  }

  async getTransactions(): Promise<DevWalletTransaction[]> {
    const db = await this.getDB();
    if (db) {
      return db.getAll("transactions");
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`${this.prefix}-transactions`);
      return stored ? JSON.parse(stored) : [];
    }

    return [];
  }

  async saveTransaction(transaction: DevWalletTransaction): Promise<void> {
    const db = await this.getDB();
    if (db) {
      await db.put("transactions", transaction);
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const transactions = await this.getTransactions();
      transactions.unshift(transaction);
      // Keep only last 100 transactions
      localStorage.setItem(
        `${this.prefix}-transactions`,
        JSON.stringify(transactions.slice(0, 100))
      );
    }
  }

  async saveTransactions(transactions: DevWalletTransaction[]): Promise<void> {
    const db = await this.getDB();
    if (db) {
      // Clear and save all transactions
      const tx = db.transaction("transactions", "readwrite");
      await tx.store.clear();
      for (const transaction of transactions) {
        await tx.store.put(transaction);
      }
      await tx.done;
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem(
        `${this.prefix}-transactions`,
        JSON.stringify(transactions.slice(0, 100))
      );
    }
  }

  async getSelectedKey(): Promise<string | null> {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      return localStorage.getItem(`${this.prefix}-selected-key`);
    }
    return null;
  }

  async setSelectedKey(address: string | null): Promise<void> {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      if (address) {
        localStorage.setItem(`${this.prefix}-selected-key`, address);
      } else {
        localStorage.removeItem(`${this.prefix}-selected-key`);
      }
    }
  }

  async getSettings(): Promise<DevWalletSettings> {
    const defaultSettings: DevWalletSettings = {
      autoLock: false,
      showTestNetworks: true,
    };

    const db = await this.getDB();
    if (db) {
      const stored = await db.get("settings", "wallet-settings");
      return stored ? stored.value : defaultSettings;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`${this.prefix}-settings`);
      return stored ? JSON.parse(stored) : defaultSettings;
    }

    return defaultSettings;
  }

  async saveSettings(settings: DevWalletSettings): Promise<void> {
    const db = await this.getDB();
    if (db) {
      await db.put("settings", { key: "wallet-settings", value: settings });
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem(`${this.prefix}-settings`, JSON.stringify(settings));
    }
  }

  /**
   * Get a specific key by address with decryption
   */
  async getKey(address: string): Promise<DevWalletKey | null> {
    const keys = await this.getKeys();
    return keys.find(k => k.address === address) || null;
  }

  /**
   * Check if we have encrypted keys that need a password
   */
  async hasEncryptedKeys(): Promise<boolean> {
    let keys: DevWalletKey[] = [];
    
    const db = await this.getDB();
    if (db) {
      keys = await db.getAll("keys");
    } else if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`${this.prefix}-keys`);
      keys = stored ? JSON.parse(stored) : [];
    }
    
    return keys.some(key => key.encryptedPrivateKey && !key.privateKey);
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    if (db) {
      // Clear IndexedDB
      const transaction = db.transaction(['keys', 'transactions', 'settings'], 'readwrite');
      await transaction.objectStore('keys').clear();
      await transaction.objectStore('transactions').clear();
      await transaction.objectStore('settings').clear();
      await transaction.done;
    }

    // Clear localStorage fallback data
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem(`${this.prefix}-keys`);
      localStorage.removeItem(`${this.prefix}-transactions`);
      localStorage.removeItem(`${this.prefix}-selected-key`);
      localStorage.removeItem(`${this.prefix}-settings`);
      // Also clear legacy localStorage keys that might exist
      localStorage.removeItem("pact-toolbox-wallet-accounts");
      localStorage.removeItem("pact-toolbox-wallet-transactions");
      localStorage.removeItem("pact-toolbox-wallet-settings");
    }
  }
}