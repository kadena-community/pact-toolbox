import type { PactCommand, PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { KeyPairSigner } from "@pact-toolbox/signers";
import { finalizeTransaction } from "@pact-toolbox/signers";
import { exportBase16Key } from "@pact-toolbox/crypto";
import { DevWalletStorage } from "./storage";
import type { DevWalletConfig, DevWalletKey, DevWalletTransaction, DevWalletUIEvents } from "./types";

export class DevWallet extends BaseWallet {
  private keyPairSigner: KeyPairSigner | null = null;
  private config: DevWalletConfig;
  private storage: DevWalletStorage;
  private selectedKey: DevWalletKey | null = null;
  private modalManager?: any; // ModalManager instance for UI
  private modalManagerPromise?: Promise<void>; // Track initialization

  constructor(config: DevWalletConfig) {
    super();
    this.config = config;
    this.storage = new DevWalletStorage(config.storagePrefix);

    // Initialize modal manager if UI is enabled
    if (this.shouldUseUI()) {
      this.modalManagerPromise = this.initializeModalManager();
    }
  }

  private async initializeModalManager(): Promise<void> {
    try {
      // Import UI components first
      await import("./ui");

      const { ModalManager } = await import("./ui/modal-manager");
      this.modalManager = ModalManager.getInstance();
      this.modalManager.initialize();
      console.log("Dev wallet modal manager initialized successfully");
    } catch (error) {
      console.error("Modal manager not available:", error);
    }
  }

  isInstalled(): boolean {
    return true; // Always available
  }

  override async isConnected(): Promise<boolean> {
    // Check if we have a connection and a saved key
    if (this.connected && this.selectedKey) {
      return true;
    }

    // Check if we have a saved key that we can auto-reconnect with
    const savedKeyAddress = await this.storage.getSelectedKey();
    if (savedKeyAddress) {
      const keys = await this.storage.getKeys();
      return keys.some((k) => k.address === savedKeyAddress);
    }

    return false;
  }

  async connect(networkId?: string): Promise<WalletAccount> {
    // Check if we have a previously selected key for auto-reconnect
    const savedKeyAddress = await this.storage.getSelectedKey();

    if (this.shouldUseUI() && savedKeyAddress) {
      // Try to auto-reconnect with saved key
      const keys = await this.storage.getKeys();
      const savedKey = keys.find((k) => k.address === savedKeyAddress);

      if (savedKey) {
        // Auto-reconnect without showing UI
        this.selectedKey = savedKey;
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
        console.log("Auto-reconnected to dev wallet with saved key");
      } else {
        // Saved key not found, show UI for selection
        if (this.modalManagerPromise) {
          await this.modalManagerPromise;
        }

        const selectedKeyData = await this.showUIAndWaitForSelection();
        if (!selectedKeyData) {
          throw WalletError.userRejected("connection");
        }

        this.selectedKey = selectedKeyData;
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
      }
    } else if (this.shouldUseUI()) {
      // No saved key - check if this is from auto-connect
      const keys = await this.storage.getKeys();
      if (keys.length === 0) {
        // No accounts exist - fail silently for auto-connect, or show UI for manual connect
        // We can detect auto-connect by checking the call stack or adding a parameter
        throw WalletError.notFound("No accounts configured in dev wallet");
      }

      // Have keys but no selected key, show UI for selection
      if (this.modalManagerPromise) {
        await this.modalManagerPromise;
      }

      const selectedKeyData = await this.showUIAndWaitForSelection();
      if (!selectedKeyData) {
        throw WalletError.userRejected("connection");
      }

      this.selectedKey = selectedKeyData;
      this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
    } else {
      // Node.js or browser without UI - use or create a default key
      await this.selectOrCreateDefaultKey();
    }

    this.connected = true;
    this.account = {
      address: this.selectedKey!.address,
      publicKey: this.selectedKey!.publicKey,
    };
    console.log("Wallet connected with account:", this.account);

    // Save the selected key for persistence
    await this.storage.setSelectedKey(this.selectedKey!.address);

    // Set up network info
    const finalNetworkId = networkId || this.config.networkId || "development";
    this.network = {
      id: finalNetworkId,
      networkId: finalNetworkId,
      name: this.config.networkName || finalNetworkId,
      url: this.config.rpcUrl,
    };

    // Dispatch wallet connected event to show floating button
    if (this.shouldUseUI()) {
      this.dispatchEvent("dev-wallet-connected", {
        walletId: "keypair",
        address: this.account.address,
      });

      // Also ensure floating button is in DOM
      this.ensureFloatingButton();
    }

    return this.account;
  }

  override async disconnect(): Promise<void> {
    this.connected = false;
    this.account = null;
    this.selectedKey = null;
    this.keyPairSigner = null;

    // Clear the selected key from storage
    await this.storage.setSelectedKey(null);

    // Dispatch wallet disconnected event to hide floating button
    if (this.shouldUseUI()) {
      this.dispatchEvent("dev-wallet-disconnected", { walletId: "keypair" });
    }
  }

  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    console.log("Sign called, connected:", this.connected, "keyPairSigner:", !!this.keyPairSigner);
    if (!this.connected || !this.keyPairSigner) {
      throw WalletError.notConnected("dev-wallet");
    }

    const transactions = Array.isArray(txOrTxs) ? txOrTxs : [txOrTxs];

    // Show signing UI if enabled
    if (this.shouldUseUI()) {
      // Ensure modal manager is initialized
      if (this.modalManagerPromise) {
        await this.modalManagerPromise;
      }

      // Get approval for the first transaction
      const approved = await this.showSigningUI(transactions[0]!);
      if (!approved) {
        throw WalletError.userRejected("signing");
      }
    }

    try {
      const cmds = transactions.map((tx) => JSON.parse(tx.cmd) as PactCommand);
      const signed = await this.keyPairSigner.signPactCommands(cmds);

      // Finalize transactions to get proper hash and format
      const finalizedTransactions = signed.map(finalizeTransaction);

      // Add transaction to history using finalized transaction
      console.log("Finalized transaction:", finalizedTransactions[0]);
      console.log("Transaction hash for polling:", finalizedTransactions[0]?.hash);
      await this.addTransactionToHistory(transactions[0]!, finalizedTransactions[0]!);

      return Array.isArray(txOrTxs) ? finalizedTransactions : finalizedTransactions[0]!;
    } catch (error) {
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  private shouldUseUI(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined" && this.config.showUI === true;
  }

  private async selectOrCreateDefaultKey(): Promise<void> {
    // First, try to get the selected key from storage
    const selectedAddress = await this.storage.getSelectedKey();
    if (selectedAddress) {
      const keys = await this.storage.getKeys();
      const key = keys.find((k) => k.address === selectedAddress);
      if (key) {
        this.selectedKey = key;
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(key.privateKey);
        return;
      }
    }

    // If no selected key, try to get the first key
    const keys = await this.storage.getKeys();
    if (keys.length > 0) {
      this.selectedKey = keys[0]!;
      this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
      await this.storage.setSelectedKey(this.selectedKey.address);
      return;
    }

    // If no keys exist, generate a new one
    const newSigner = await KeyPairSigner.generate();
    const privateKey = await exportBase16Key(newSigner.keyPair.privateKey);
    const newKey: DevWalletKey = {
      address: `k:${newSigner.address}`,
      publicKey: newSigner.address,
      privateKey,
      name: "Default Key",
      createdAt: Date.now(),
    };

    await this.storage.saveKey(newKey);
    await this.storage.setSelectedKey(newKey.address);
    this.selectedKey = newKey;
    this.keyPairSigner = newSigner;
  }

  private async showUIAndWaitForSelection(): Promise<DevWalletKey | null> {
    console.log("showUIAndWaitForSelection called, modalManager:", this.modalManager);
    return new Promise((resolve) => {
      // Show the modal if available
      if (this.modalManager) {
        console.log("Showing dev wallet UI");
        this.modalManager.showDevWallet();
      } else {
        console.error("Modal manager not available in showUIAndWaitForSelection");
      }

      // Trigger UI connect request
      setTimeout(() => {
        this.dispatchEvent("toolbox-connect-requested", undefined);
      }, 100);

      const handleConnectApproved = (event: Event) => {
        const customEvent = event as DevWalletUIEvents["connect-approved"];
        const { account } = customEvent.detail;
        console.log("Connect approved event received, account:", account);
        if (account && account.privateKey) {
          cleanup();
          // Don't hide the modal yet - we might need it for signing
          resolve(account);
        } else {
          console.error("Connect approved but account is missing or has no private key", account);
        }
      };

      const handleConnectCancelled = () => {
        cleanup();
        if (this.modalManager) {
          this.modalManager.cleanup();
        }
        resolve(null);
      };

      const cleanup = () => {
        document.removeEventListener("connect-approved", handleConnectApproved);
        document.removeEventListener("connect-cancelled", handleConnectCancelled);
      };

      // Listen for events
      document.addEventListener("connect-approved", handleConnectApproved);
      document.addEventListener("connect-cancelled", handleConnectCancelled);
    });
  }

  private async showSigningUI(transaction: PartiallySignedTransaction): Promise<boolean> {
    console.log("showSigningUI called for transaction:", transaction);

    // Make sure modal is visible
    if (this.modalManager) {
      this.modalManager.showDevWallet();
    }

    return new Promise((resolve) => {
      // Trigger sign request event to show the sign screen
      setTimeout(() => {
        this.dispatchEvent("toolbox-sign-requested", { transaction });
      }, 100);

      const handleSignApproved = (_event: Event) => {
        console.log("Sign approved event received");
        cleanup();
        // Hide modal after approval
        if (this.modalManager) {
          this.modalManager.hideDevWallet();
        }
        resolve(true);
      };

      const handleSignRejected = () => {
        console.log("Sign rejected event received");
        cleanup();
        // Hide modal after rejection
        if (this.modalManager) {
          this.modalManager.hideDevWallet();
        }
        resolve(false);
      };

      const cleanup = () => {
        document.removeEventListener("sign-approved", handleSignApproved);
        document.removeEventListener("sign-rejected", handleSignRejected);
      };

      // Listen for approval/rejection events
      document.addEventListener("sign-approved", handleSignApproved);
      document.addEventListener("sign-rejected", handleSignRejected);
    });
  }

  private async addTransactionToHistory(request: PartiallySignedTransaction, finalizedTx: any): Promise<void> {
    try {
      const cmd = JSON.parse(request.cmd) as PactCommand;

      const newTx: DevWalletTransaction = {
        id: finalizedTx.hash || `tx-${Date.now()}`,
        hash: finalizedTx.hash,
        from: this.selectedKey?.address || "",
        to: (cmd.payload.exec?.data?.["recipient"] as string) || undefined,
        amount: (cmd.payload.exec?.data?.["amount"] as number) || undefined,
        gas: cmd.meta?.gasLimit,
        status: "pending",
        timestamp: Date.now(),
        chainId: cmd.meta?.chainId || "0",
        capability: cmd.signers?.[0]?.clist?.[0]?.name,
        data: cmd.payload,
      };

      await this.storage.saveTransaction(newTx);

      // Notify UI if in browser
      if (this.shouldUseUI()) {
        this.dispatchEvent("toolbox-transaction-added", { transaction: newTx });
      }

      // Start polling for transaction status if we have a hash
      console.log("Transaction hash for polling:", finalizedTx.hash);
      if (finalizedTx.hash) {
        console.log("Starting polling for transaction:", finalizedTx.hash);
        // Start polling in the background (don't await)
        this.pollTransactionStatus(finalizedTx.hash, newTx.id).catch((error) => {
          console.error("Background polling failed:", error);
        });
      } else {
        console.log("No hash found, skipping polling");
      }
    } catch (error) {
      console.error("Failed to add transaction to history:", error);
    }
  }

  private async pollTransactionStatus(hash: string, transactionId: string): Promise<void> {
    const pollInterval = 5000; // 5 seconds (waitForResult will handle retries)

    console.log(`Starting polling for transaction ${hash}`);

    try {
      // Get chainweb client from global context or create a new one
      let client;
      const globalContext = (window as any).__PACT_TOOLBOX_CONTEXT__ || (globalThis as any).__PACT_TOOLBOX_CONTEXT__;

      if (globalContext && typeof globalContext.getClient === "function") {
        client = globalContext.getClient();
        console.log("Using global context client");
      } else {
        // Fallback: create a new client
        console.log("Creating new ChainwebClient for polling");
        const { ChainwebClient } = await import("@pact-toolbox/chainweb-client");
        client = new ChainwebClient({
          networkId: this.config.networkId || "development",
          chainId: "0",
          rpcUrl: (networkId: string, chainId: string) => {
            return this.config.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId);
          },
        });
      }

      console.log("Polling with client:", client);
      console.log("About to call waitForResult with hash:", hash);

      // Poll for transaction result using the chainweb client (this will handle retries internally)
      const result = await client.waitForResult(hash, pollInterval);
      console.log("Poll result:", result);

      // Transaction result found
      const status = result.result?.status === "success" ? "success" : "failure";

      // Update transaction status in storage
      await this.updateTransactionStatus(transactionId, status, result);

      // Notify UI of status change
      if (this.shouldUseUI()) {
        this.dispatchEvent("toolbox-transaction-updated", {
          transactionId,
          status,
          result,
        });
      }

      console.log(`Transaction ${hash} completed with status: ${status}`);
    } catch (error) {
      console.error(`Error polling transaction ${hash}:`, error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: "success" | "failure",
    result?: any,
  ): Promise<void> {
    try {
      const transactions = await this.storage.getTransactions();
      const updatedTransactions = transactions.map((tx) =>
        tx.id === transactionId ? { ...tx, status, result, updatedAt: Date.now() } : tx,
      );

      // Save updated transactions
      await this.storage.saveTransactions(updatedTransactions);
    } catch (error) {
      console.error("Failed to update transaction status:", error);
    }
  }

  private dispatchEvent<K extends keyof DevWalletUIEvents>(
    type: K,
    detail: DevWalletUIEvents[K] extends CustomEvent<infer D> ? D : never,
  ): void {
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent(type, { detail }));
    }
  }

  private ensureFloatingButton(): void {
    if (typeof document === "undefined") {
      return;
    }

    // Check if floating button already exists
    let floatingButton = document.querySelector("toolbox-wallet-floating-button");
    if (!floatingButton) {
      // Create and append floating button to body
      floatingButton = document.createElement("toolbox-wallet-floating-button");
      document.body.appendChild(floatingButton);
      console.log("Dev wallet floating button added to DOM");
    }
  }

  /**
   * Get wallet storage (for UI access)
   */
  getStorage(): DevWalletStorage {
    return this.storage;
  }

  /**
   * Static factory methods
   */
  static async fromPrivateKey(privateKey: string, config: Partial<DevWalletConfig> = {}): Promise<DevWallet> {
    const wallet = new DevWallet({
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      ...config,
    });

    // Initialize the key properly
    await wallet.initializeFromPrivateKey(privateKey, config.accountName);

    return wallet;
  }

  private async initializeFromPrivateKey(privateKey: string, accountName?: string): Promise<void> {
    try {
      const { KeyPairSigner } = await import("@pact-toolbox/signers");
      const signer = await KeyPairSigner.fromPrivateKeyHex(privateKey);

      const key: DevWalletKey = {
        address: accountName ?? `k:${signer.address}`,
        publicKey: signer.address,
        privateKey,
        name: accountName ?? `Development Key`,
        createdAt: Date.now(),
      };

      // Save the key to storage
      await this.storage.saveKey(key);
      await this.storage.setSelectedKey(key.address);

      this.selectedKey = key;
      this.keyPairSigner = signer;
    } catch (error) {
      console.error("Failed to initialize from private key:", error);
    }
  }
}
