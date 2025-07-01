import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount, WalletNetwork } from "@pact-toolbox/wallet-core";
import { createTransaction } from "@pact-toolbox/transaction";
import type { ChainweaverConnectionOptions } from "./types";

interface ChainweaverAccount {
  address: string;
  alias: string;
  chains: string[];
  guard: any;
  overallBalance: string;
}

interface ChainweaverNetwork {
  uuid: string;
  networkId: string;
  name: string;
  default: boolean;
  creationTime: number;
  hosts: Array<{
    url: string;
    submit: boolean;
    read: boolean;
    confirm: boolean;
  }>;
}

/**
 * Chainweaver wallet implementation using popup window communication
 */
export class ChainweaverWallet extends BaseWallet {
  override readonly id = "chainweaver";
  private url?: string;
  private walletUrl: string;
  private walletWindow: Window | null = null;
  private appName: string;

  constructor(options: { walletUrl?: string; appName?: string } = {}) {
    super();
    this.walletUrl = options.walletUrl || "https://wallet.kadena.io";
    this.appName = options.appName || "Pact Toolbox App";
  }

  override isInstalled(): boolean {
    // Chainweaver is a web wallet, always available
    return true;
  }

  override async connect(networkId: string = "mainnet01"): Promise<WalletAccount> {
    try {
      // Open wallet popup if not already open
      await this.openWallet();

      // Request connection
      const connectionResponse = await this.message("CONNECTION_REQUEST", {
        name: this.appName,
      });

      if ((connectionResponse.payload as any).status !== "accepted") {
        throw new Error("Connection rejected by user");
      }

      // Get status to retrieve accounts
      const statusResponse = await this.message("GET_STATUS", {
        name: this.appName,
      }) as any;

      const accounts = statusResponse.payload?.accounts as ChainweaverAccount[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in Chainweaver");
      }

      const firstAccount = accounts[0]!;
      const publicKey = firstAccount.guard?.keys?.[0] || "";

      this.account = {
        address: firstAccount.address,
        publicKey,
        balance: parseFloat(firstAccount.overallBalance) || 0,
        connectedSites: [],
      };

      // Get network info
      await this.updateNetworkInfo(networkId);

      this.connected = true;
      this.emit("connected");
      this.closeWallet();
      return this.account;
    } catch (error) {
      this.closeWallet();
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("denied")) {
          throw WalletError.userRejected("connection");
        }
        if (error.message.includes("POPUP_BLOCKED")) {
          throw WalletError.connectionFailed("Popup was blocked. Please allow popups for this site.");
        }
      }
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      throw WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
    }
  }

  override async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  override async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  override async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.connected) {
      throw WalletError.notConnected(this.id);
    }

    const transactions = Array.isArray(txOrTxs) ? txOrTxs : [txOrTxs];
    const isList = Array.isArray(txOrTxs);

    try {
      await this.openWallet();

      const signedTxs: SignedTransaction[] = [];

      // Sign each transaction one by one
      for (const tx of transactions) {
        const parsedCmd = JSON.parse(tx.cmd);
        const transaction = createTransaction(parsedCmd);

        const response = await this.message("SIGN_REQUEST", transaction as unknown as Record<string, unknown>) as any;

        if (response.payload.status === "rejected") {
          throw new Error("User rejected signing");
        }

        if (response.payload.status === "signed" && response.payload.transaction) {
          const signedTx = response.payload.transaction;
          signedTxs.push({
            cmd: signedTx.cmd || tx.cmd,
            sigs: signedTx.sigs,
            hash: signedTx.hash || tx.hash || "",
          });
        } else {
          throw new Error("Failed to sign transaction");
        }
      }

      this.closeWallet();
      return isList ? signedTxs : signedTxs[0]!;
    } catch (error) {
      this.closeWallet();
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("denied")) {
          throw WalletError.userRejected("signing");
        }
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  override async disconnect(): Promise<void> {
    this.closeWallet();
    await super.disconnect();
    this.emit("disconnected");
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<WalletAccount[]> {
    if (!this.connected) {
      return [];
    }

    try {
      await this.openWallet();
      const response = await this.message("GET_ACCOUNTS", {
        name: this.appName,
      }) as any;

      const accounts = response.payload as ChainweaverAccount[];
      this.closeWallet();

      return accounts.map(acc => ({
        address: acc.address,
        publicKey: acc.guard?.keys?.[0] || "",
        balance: parseFloat(acc.overallBalance) || 0,
        connectedSites: [],
      }));
    } catch {
      this.closeWallet();
      return [];
    }
  }

  /**
   * Get all networks
   */
  async getNetworks(): Promise<WalletNetwork[]> {
    try {
      await this.openWallet();
      const response = await this.message("GET_NETWORKS", {
        name: this.appName,
      }) as any;

      const networks = response.payload as ChainweaverNetwork[];
      this.closeWallet();

      return networks.map(net => ({
        id: net.uuid,
        networkId: net.networkId,
        name: net.name,
        url: net.hosts.find(h => h.submit)?.url || "",
        isDefault: net.default,
      }));
    } catch {
      this.closeWallet();
      return [];
    }
  }

  /**
   * Update network info
   */
  private async updateNetworkInfo(networkId: string): Promise<void> {
    try {
      const networks = await this.getNetworks();
      const network = networks.find(n => n.networkId === networkId) || networks[0];

      if (network) {
        this.network = network;
      } else {
        // Fallback to default
        this.network = {
          id: networkId,
          networkId,
          name: networkId,
          url: "https://api.chainweb.com",
        };
      }
    } catch {
      // Fallback
      this.network = {
        id: networkId,
        networkId,
        name: networkId,
        url: "https://api.chainweb.com",
      };
    }
  }

  /**
   * Open wallet popup
   */
  private async openWallet(minimal = false): Promise<void> {
    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.focus();
      return;
    }

    const windowFeatures = minimal ? "width=1,height=1" : "width=800,height=800";
    this.walletWindow = window.open("", "chainweaver", windowFeatures);

    if (!this.walletWindow) {
      throw new Error("POPUP_BLOCKED");
    }

    // Check if wallet is already loaded
    try {
      await this.message("GET_STATUS", { name: this.appName });
    } catch {
      // Navigate to wallet URL if not loaded
      this.walletWindow.location.href = this.walletUrl;
      // Wait for wallet to load
      await this.waitForWallet();
    }
  }

  /**
   * Close wallet popup
   */
  private closeWallet(): void {
    this.walletWindow?.close();
    this.walletWindow = null;
  }

  /**
   * Wait for wallet to be ready
   */
  private async waitForWallet(): Promise<void> {
    const maxAttempts = 50;
    const delay = 300;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.message("GET_STATUS", { name: this.appName });
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Timeout waiting for Chainweaver to load");
  }

  /**
   * Send message to wallet window
   */
  private async message(type: string, payload: Record<string, unknown>): Promise<any> {
    if (!this.walletWindow || this.walletWindow.closed) {
      throw new Error("Wallet window is not open");
    }

    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      const origin = new URL(this.walletUrl).origin;

      const listener = (event: MessageEvent) => {
        if (event.origin !== origin) return;
        if (event.data?.messageId !== messageId) return;

        window.removeEventListener("message", listener);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      window.addEventListener("message", listener);

      this.walletWindow?.postMessage(
        {
          type,
          payload,
          messageId,
        },
        origin,
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener("message", listener);
        reject(new Error("Message timeout"));
      }, 30000);
    });
  }

  /**
   * Set connection options for the wallet
   */
  setConnectionOptions(options: ChainweaverConnectionOptions): void {
    // Store connection options for later use
    // These are primarily used during the connect flow
    if (options.networkId) {
      this.network = {
        id: options.networkId,
        networkId: options.networkId,
        name: options.networkId,
        url: this.walletUrl,
      };
    }
  }
}
