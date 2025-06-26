import { openDB, type IDBPDatabase } from "idb";
import type { DevWalletKey, DevWalletTransaction } from "./types";

export class DevWalletStorage {
  private dbName = "pact-toolbox-dev-wallet";
  private db: IDBPDatabase | null = null;
  private prefix: string;

  constructor(prefix = "pact-toolbox-wallet") {
    this.prefix = prefix;
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
        },
      });
    }
    return this.db;
  }

  async getKeys(): Promise<DevWalletKey[]> {
    const db = await this.getDB();
    if (db) {
      return db.getAll("keys");
    }
    
    // Fallback to localStorage in browser or return empty in Node
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`${this.prefix}-keys`);
      return stored ? JSON.parse(stored) : [];
    }
    
    return [];
  }

  async saveKey(key: DevWalletKey): Promise<void> {
    const db = await this.getDB();
    if (db) {
      await db.put("keys", key);
      return;
    }

    // Fallback to localStorage in browser
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const keys = await this.getKeys();
      const existingIndex = keys.findIndex(k => k.address === key.address);
      if (existingIndex >= 0) {
        keys[existingIndex] = key;
      } else {
        keys.push(key);
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
}