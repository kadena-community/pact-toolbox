import type { PactCommand, PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { KeyPairSigner } from "@pact-toolbox/signers";
import { finalizeTransaction } from "@pact-toolbox/signers";
import { exportBase16Key, generateSecurePassword } from "@pact-toolbox/crypto";
import { DevWalletStorage } from "./storage";
import type {
  DevWalletConfig,
  DevWalletKey,
  DevWalletTransaction,
  DevWalletUIEvents,
  PendingTransaction,
} from "./types";
import { walletLogger } from "./utils/logger";
import type { ModalManager } from "./ui/modal-manager";

export class DevWallet extends BaseWallet {
  private keyPairSigner: KeyPairSigner | null = null;
  private config: DevWalletConfig;
  private storage: DevWalletStorage;
  private selectedKey: DevWalletKey | null = null;
  private modalManager?: ModalManager; // ModalManager instance for UI
  private modalManagerPromise?: Promise<void>; // Track initialization
  private encryptionEnabled = false;
  private sessionPassword?: string;

  constructor(config: DevWalletConfig) {
    super();
    this.config = config;
    this.storage = new DevWalletStorage(config.storagePrefix);

    // Initialize modal manager if UI is enabled
    if (this.shouldUseUI()) {
      this.modalManagerPromise = this.initializeModalManager();
    }

    // Enable encryption if configured
    if (config.enableEncryption) {
      this.enableEncryption(config.encryptionPassword).catch((error) => {
        walletLogger.error("Failed to enable encryption", { error });
      });
    }
  }

  /**
   * Enable encryption for new keys and set session password
   */
  async enableEncryption(password?: string): Promise<void> {
    this.encryptionEnabled = true;
    const pwd = password || generateSecurePassword();
    this.sessionPassword = pwd;
    await this.storage.setEncryptionPassword(pwd);
    walletLogger.operation("Encryption enabled", "success");
  }

  /**
   * Disable encryption and clear session password
   */
  disableEncryption(): void {
    this.encryptionEnabled = false;
    this.sessionPassword = undefined;
    this.storage.clearEncryptionPassword();
    walletLogger.operation("Encryption disabled", "success");
  }

  /**
   * Check if wallet needs password for encrypted keys
   */
  async requiresPassword(): Promise<boolean> {
    return this.storage.hasEncryptedKeys();
  }

  /**
   * Unlock wallet with password
   */
  async unlock(password: string): Promise<boolean> {
    try {
      await this.storage.setEncryptionPassword(password);
      // Try to decrypt a key to verify password
      const hasEncrypted = await this.storage.hasEncryptedKeys();
      if (hasEncrypted) {
        const keys = await this.storage.getKeys();
        return keys.some((key) => key.privateKey !== "");
      }
      return true;
    } catch (error) {
      walletLogger.error("Failed to unlock wallet", { error });
      return false;
    }
  }

  private async initializeModalManager(): Promise<void> {
    try {
      walletLogger.operation("UI initialization", "start");
      // Import UI components first
      await import("./ui");
      walletLogger.debug("UI components imported successfully");

      const { getDefaultModalManager } = await import("./ui/modal-manager");
      walletLogger.debug("ModalManager imported successfully");
      this.modalManager = getDefaultModalManager();
      this.modalManager.initialize();
      walletLogger.operation("Modal manager initialization", "success");
    } catch (error) {
      walletLogger.error("Modal manager not available", { error });
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
    walletLogger.connection("Connect called", { shouldUseUI: this.shouldUseUI() });
    // Check if we have a previously selected key for auto-reconnect
    const savedKeyAddress = await this.storage.getSelectedKey();
    walletLogger.debug("Saved key address found", { savedKeyAddress });

    if (this.shouldUseUI() && savedKeyAddress) {
      // Try to auto-reconnect with saved key
      const keys = await this.storage.getKeys();
      const savedKey = keys.find((k) => k.address === savedKeyAddress);

      if (savedKey) {
        // Check if key needs decryption
        if (!savedKey.privateKey && savedKey.encryptedPrivateKey) {
          const requiresUnlock = await this.requiresPassword();
          if (requiresUnlock && !this.sessionPassword) {
            throw WalletError.userRejected("Wallet is locked. Please unlock first.");
          }
        }

        // Auto-reconnect without showing UI
        this.selectedKey = savedKey;
        if (this.selectedKey.privateKey) {
          this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
          walletLogger.connection("Auto-reconnected with saved key");
        } else {
          throw WalletError.userRejected("Failed to decrypt key");
        }
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
        if (this.selectedKey.privateKey) {
          this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
        } else {
          throw WalletError.userRejected("Failed to decrypt key");
        }
      }
    } else if (this.shouldUseUI()) {
      // No saved key - show UI for key creation/selection
      const keys = await this.storage.getKeys();
      walletLogger.debug("No saved key found", { existingKeysCount: keys.length });

      if (keys.length === 0) {
        // No accounts exist - for auto-connect scenarios, we should fail gracefully
        throw WalletError.notFound("No accounts configured in dev wallet");
      }

      // Have keys but no selected key, show UI for selection
      if (this.modalManagerPromise) {
        walletLogger.debug("Waiting for modal manager initialization...");
        await this.modalManagerPromise;
      }

      walletLogger.ui("Showing key selection/creation interface");
      const selectedKeyData = await this.showUIAndWaitForSelection();
      if (!selectedKeyData) {
        throw WalletError.userRejected("connection");
      }

      this.selectedKey = selectedKeyData;
      if (this.selectedKey.privateKey) {
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
      } else {
        throw WalletError.userRejected("Failed to decrypt key");
      }
    } else {
      // Node.js or browser without UI - use or create a default key
      await this.selectOrCreateDefaultKey();
    }

    this.connected = true;
    this.account = {
      address: this.selectedKey!.address,
      publicKey: this.selectedKey!.publicKey,
    };
    walletLogger.connection("Wallet connected successfully", { account: this.account });

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
    walletLogger.transaction("Sign called", { connected: this.connected, hasKeyPairSigner: !!this.keyPairSigner });
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
      walletLogger.transaction("Transaction finalized", {
        transaction: finalizedTransactions[0],
        hash: finalizedTransactions[0]?.hash,
      });
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
      if (this.selectedKey.privateKey) {
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.selectedKey.privateKey);
        await this.storage.setSelectedKey(this.selectedKey.address);
        return;
      } else {
        throw new Error("Cannot use encrypted key without password");
      }
    }

    // If no keys exist, generate a new one
    const newSigner = await KeyPairSigner.generate();
    const privateKey = await exportBase16Key(newSigner.keyPair.privateKey);

    // Enable encryption with a generated password if not already enabled
    if (!this.encryptionEnabled && !this.sessionPassword) {
      await this.enableEncryption();
    }

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
    walletLogger.ui("Showing selection UI", { hasModalManager: !!this.modalManager });
    return new Promise((resolve) => {
      // Show the modal if available
      if (this.modalManager) {
        walletLogger.ui("Dev wallet UI displayed");
        this.modalManager.showDevWallet();
      } else {
        walletLogger.error("Modal manager not available in showUIAndWaitForSelection");
      }

      // Trigger UI connect request
      setTimeout(() => {
        this.dispatchEvent("toolbox-connect-requested", undefined);
      }, 100);

      const handleConnectApproved = (event: Event) => {
        const customEvent = event as DevWalletUIEvents["connect-approved"];
        const { account } = customEvent.detail;
        walletLogger.connection("Connect approved", { account });
        if (account && account.privateKey) {
          cleanup();
          // Don't hide the modal yet - we might need it for signing
          resolve(account);
        } else {
          walletLogger.error("Connect approved but invalid account", { account });
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
    walletLogger.ui("Showing signing UI", { transaction });

    // Make sure modal is visible
    if (this.modalManager) {
      this.modalManager.showDevWallet();
    }

    return new Promise((resolve) => {
      // Parse the transaction to get chainId
      let chainId = "0";
      try {
        const cmd = JSON.parse(transaction.cmd) as PactCommand;
        chainId = cmd.meta?.chainId || "0";
      } catch (e) {
        walletLogger.error("Failed to parse transaction cmd", { error: e });
      }

      // Create a PendingTransaction from PartiallySignedTransaction
      const pendingTransaction: PendingTransaction = {
        id: `pending_${Date.now()}`,
        request: transaction,
        timestamp: Date.now(),
        chainId,
      };

      // Trigger sign request event to show the sign screen
      setTimeout(() => {
        this.dispatchEvent("toolbox-sign-requested", { transaction: pendingTransaction });
      }, 100);

      const handleSignApproved = (_event: Event) => {
        walletLogger.transaction("Sign approved");
        cleanup();
        // Hide modal after approval
        if (this.modalManager) {
          this.modalManager.hideDevWallet();
        }
        resolve(true);
      };

      const handleSignRejected = () => {
        walletLogger.transaction("Sign rejected");
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

  private async addTransactionToHistory(
    request: PartiallySignedTransaction,
    finalizedTx: SignedTransaction,
  ): Promise<void> {
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
        data: cmd.payload as unknown as Record<string, unknown>,
      };

      await this.storage.saveTransaction(newTx);

      // Notify UI if in browser
      if (this.shouldUseUI()) {
        this.dispatchEvent("toolbox-transaction-added", { transaction: newTx });
      }

      // Start polling for transaction status if we have a hash
      walletLogger.transaction("Starting transaction polling", { hash: finalizedTx.hash });
      if (finalizedTx.hash) {
        walletLogger.debug("Background polling started", { hash: finalizedTx.hash });
        // Start polling in the background (don't await)
        this.pollTransactionStatus(finalizedTx.hash, newTx.id).catch((error) => {
          walletLogger.error("Background polling failed", { error });
        });
      } else {
        walletLogger.warn("No transaction hash found, skipping polling");
      }
    } catch (error) {
      walletLogger.error("Failed to add transaction to history", { error });
    }
  }

  private async pollTransactionStatus(hash: string, transactionId: string): Promise<void> {
    const pollInterval = 5000; // 5 seconds (waitForResult will handle retries)

    walletLogger.operation("Transaction polling", "start", { hash });

    try {
      // Get chainweb client from global context or create a new one
      let client;
      const globalContext = (window as any).__PACT_TOOLBOX_CONTEXT__ || (globalThis as any).__PACT_TOOLBOX_CONTEXT__;

      if (globalContext && typeof globalContext.getClient === "function") {
        client = globalContext.getClient();
        walletLogger.debug("Using global context client");
      } else {
        // Fallback: create a new client
        walletLogger.debug("Creating new ChainwebClient for polling");
        const { ChainwebClient } = await import("@pact-toolbox/chainweb-client");
        client = new ChainwebClient({
          networkId: this.config.networkId || "development",
          chainId: "0",
          rpcUrl: (networkId: string, chainId: string) => {
            return this.config.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId);
          },
        });
      }

      walletLogger.debug("Starting waitForResult", { client: !!client, hash });

      // Poll for transaction result using the chainweb client (this will handle retries internally)
      const result = await client.waitForResult(hash, pollInterval);
      walletLogger.debug("Poll result received", { result });

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

      walletLogger.operation("Transaction polling", "success", { hash, status });
    } catch (error) {
      walletLogger.operation("Transaction polling", "error", {
        hash,
        error,
        details: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: "success" | "failure",
    result?: import("./types").TransactionResult,
  ): Promise<void> {
    try {
      const transactions = await this.storage.getTransactions();
      const updatedTransactions = transactions.map((tx) =>
        tx.id === transactionId ? { ...tx, status, result, updatedAt: Date.now() } : tx,
      );

      // Save updated transactions
      await this.storage.saveTransactions(updatedTransactions);
    } catch (error) {
      walletLogger.error("Failed to update transaction status", { error });
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
      walletLogger.ui("Floating button added to DOM");
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
      walletLogger.error("Failed to initialize from private key", { error });
    }
  }
}
