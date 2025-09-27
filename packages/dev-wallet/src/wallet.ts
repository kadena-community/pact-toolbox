import type { PactCommand, PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { ChainwebClient } from "@pact-toolbox/chainweb-client";
import { KeypairWallet } from "@pact-toolbox/wallet-core";
import { getGlobalRegistry } from "./keypair-registry";
import { generateSecurePassword, genKeyPair } from "@pact-toolbox/crypto";
import { DevWalletStorage } from "./storage";
import type {
  DevWalletConfig,
  DevWalletKey,
  DevWalletTransaction,
  PendingTransaction,
  Account,
  TransactionResult,
} from "./types";
import { walletLogger } from "./utils/logger";
import { getDefaultModalManager, type DevWalletManager as ModalManager } from "./manager";
import { walletEventEmitter } from "./stores/wallet-store";

export class DevWallet extends BaseWallet {
  private keypairRegistry = getGlobalRegistry();
  private config: DevWalletConfig;
  private storage: DevWalletStorage;
  private selectedKey: DevWalletKey | null = null;
  private modalManager?: ModalManager;
  private modalManagerPromise?: Promise<void>;
  private encryptionEnabled = false;
  // Don't store password in plain text - only keep it temporarily during operations
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
    // Only store temporarily for current session
    this.sessionPassword = pwd;
    await this.storage.setEncryptionPassword(pwd);
    walletLogger.operation("Encryption enabled", "success");
    // Password will be cleared on disconnect or after operations
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
      walletLogger.debug("UI components available");

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
          // Get or create KeypairWallet through registry
          await this.keypairRegistry.getOrCreateWallet(this.selectedKey, {
            networkId: networkId || this.config.networkId,
            rpcUrl: this.config.rpcUrl,
          });
          walletLogger.connection("Auto-reconnected with saved key");
          // Clear private key from memory
          this.selectedKey.privateKey = '';
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
          // Get or create KeypairWallet through registry
          await this.keypairRegistry.getOrCreateWallet(this.selectedKey, {
            networkId: networkId || this.config.networkId,
            rpcUrl: this.config.rpcUrl,
          });
          // Clear private key from memory
          this.selectedKey.privateKey = '';
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
        // Get or create KeypairWallet through registry
        await this.keypairRegistry.getOrCreateWallet(this.selectedKey, {
          networkId: networkId || this.config.networkId,
          rpcUrl: this.config.rpcUrl,
        });
        // Clear private key from memory
        this.selectedKey.privateKey = '';
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

    // Ensure floating button is in DOM if UI is enabled
    if (this.shouldUseUI()) {
      this.ensureFloatingButton();
    }

    return this.account;
  }

  override async disconnect(): Promise<void> {
    this.connected = false;
    this.account = null;

    // Clear sensitive data from memory
    if (this.selectedKey) {
      this.clearSensitiveData(this.selectedKey);
      this.selectedKey = null;
    }

    // Clear session password for security
    this.sessionPassword = undefined;

    // Clear all KeypairWallet instances from registry
    await this.keypairRegistry.clear();

    // Clear the selected key from storage
    await this.storage.setSelectedKey(null);
  }

  /**
   * Securely clear sensitive data from memory
   */
  private clearSensitiveData(obj: any): void {
    if (obj && typeof obj === 'object') {
      if ('privateKey' in obj && typeof obj.privateKey === 'string') {
        // Overwrite the string memory (best effort)
        (obj as any).privateKey = '';
        delete obj.privateKey;
      }
      if ('encryptedPrivateKey' in obj) {
        delete obj.encryptedPrivateKey;
      }
    }
  }

  /**
   * Validate private key format
   */
  private validatePrivateKey(privateKey: string): boolean {
    if (!privateKey || typeof privateKey !== 'string') {
      return false;
    }

    // Remove any whitespace
    const cleanKey = privateKey.trim();

    // Check if it's a valid hex string (64 characters for Ed25519)
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (hexRegex.test(cleanKey)) {
      return true;
    }

    // Check if it's base64 (44 characters with optional padding)
    const base64Regex = /^[A-Za-z0-9+/]{43}=?$/;
    if (base64Regex.test(cleanKey)) {
      return true;
    }

    return false;
  }

  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    walletLogger.transaction("Sign called", { connected: this.connected });
    if (!this.connected) {
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
      // Parse the first transaction to get the signer
      const cmd = JSON.parse(transactions[0]!.cmd) as PactCommand;
      const signerPublicKey = cmd.signers?.[0]?.pubKey;

      if (!signerPublicKey) {
        throw WalletError.signingFailed("No signer found in transaction");
      }

      // Find the correct KeypairWallet for this signer
      let signerWallet: KeypairWallet | undefined;

      // Look through our stored keys to find matching public key
      const keys = await this.storage.getKeys();
      const signerKey = keys.find(k => k.publicKey === signerPublicKey);

      if (!signerKey) {
        throw WalletError.signingFailed(`No key found for signer: ${signerPublicKey}`);
      }

      // Get or create KeypairWallet for this signer through registry
      signerWallet = this.keypairRegistry.getWallet(signerKey.address);

      if (!signerWallet) {
        // Try to get by public key
        signerWallet = this.keypairRegistry.getWalletByPublicKey(signerKey.publicKey);
      }

      if (!signerWallet) {
        // Need to create a new KeypairWallet for this signer
        if (!signerKey.privateKey) {
          throw WalletError.signingFailed("Private key not available for signer");
        }

        signerWallet = await this.keypairRegistry.getOrCreateWallet(signerKey, {
          networkId: this.config.networkId,
          rpcUrl: this.config.rpcUrl,
        });

        // Clear private key from memory
        signerKey.privateKey = '';
      }

      // Sign using the correct KeypairWallet
      let signed: SignedTransaction | SignedTransaction[];

      if (Array.isArray(txOrTxs)) {
        signed = await signerWallet.sign(txOrTxs);
      } else {
        signed = await signerWallet.sign(txOrTxs);
      }

      // Add transaction to history
      if (!Array.isArray(signed)) {
        walletLogger.transaction("Transaction finalized", {
          transaction: signed,
          hash: signed.hash,
        });
        await this.addTransactionToHistory(transactions[0]!, signed);
      } else if (signed[0]) {
        await this.addTransactionToHistory(transactions[0]!, signed[0]);
      }

      return signed;
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
      if (key && key.privateKey) {
        this.selectedKey = key;
        // Get or create KeypairWallet through registry
        await this.keypairRegistry.getOrCreateWallet(key, {
          networkId: this.config.networkId,
          rpcUrl: this.config.rpcUrl,
        });
        // Clear private key from memory after creating wallet
        key.privateKey = '';
        return;
      }
    }

    // If no selected key, try to get the first key
    const keys = await this.storage.getKeys();
    if (keys.length > 0) {
      const firstKey = keys[0]!;
      if (firstKey.privateKey) {
        this.selectedKey = firstKey;
        // Get or create KeypairWallet through registry
        await this.keypairRegistry.getOrCreateWallet(firstKey, {
          networkId: this.config.networkId,
          rpcUrl: this.config.rpcUrl,
        });
        await this.storage.setSelectedKey(firstKey.address);
        // Clear private key from memory after creating wallet
        firstKey.privateKey = '';
        return;
      } else {
        throw new Error("Cannot use encrypted key without password");
      }
    }

    // If no keys exist, generate a new one
    const keyPair = await genKeyPair();

    // Enable encryption with a generated password if not already enabled
    if (!this.encryptionEnabled && !this.sessionPassword) {
      await this.enableEncryption();
    }

    const newKey: DevWalletKey = {
      address: `k:${keyPair.publicKey}`,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      name: "Default Key",
      createdAt: Date.now(),
    };

    await this.storage.saveKey(newKey);
    await this.storage.setSelectedKey(newKey.address);

    // Create wallet with this key through registry
    await this.keypairRegistry.getOrCreateWallet(newKey, {
      networkId: this.config.networkId,
      rpcUrl: this.config.rpcUrl,
    });

    this.selectedKey = { ...newKey, privateKey: '' }; // Don't keep private key in memory
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
      walletEventEmitter.emit('connect-requested');

      const handleConnectApproved = (account: Account) => {
        walletLogger.connection("Connect approved", { account });
        // Convert Account to DevWalletKey format if needed
        const keyAccount = account as unknown as DevWalletKey;
        if (keyAccount && keyAccount.privateKey) {
          cleanup();
          // Don't hide the modal yet - we might need it for signing
          resolve(keyAccount);
        } else {
          walletLogger.error("Connect approved but invalid account", { account: keyAccount });
        }
      };

      const handleConnectCancelled = () => {
        cleanup();
        if (this.modalManager) {
          this.modalManager.cleanup?.();
        }
        resolve(null);
      };

      const cleanup = () => {
        walletEventEmitter.off("connect-approved", handleConnectApproved);
        walletEventEmitter.off("connect-cancelled", handleConnectCancelled);
      };

      // Listen for events
      walletEventEmitter.on("connect-approved", handleConnectApproved);
      walletEventEmitter.on("connect-cancelled", handleConnectCancelled);
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
      walletEventEmitter.emit('sign-requested', pendingTransaction);

      const handleSignApproved = (transaction?: PendingTransaction) => {
        walletLogger.transaction("Sign approved", { transaction });
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
        walletEventEmitter.off("sign-approved", handleSignApproved);
        walletEventEmitter.off("sign-rejected", handleSignRejected);
      };

      // Listen for approval/rejection events
      walletEventEmitter.on("sign-approved", handleSignApproved);
      walletEventEmitter.on("sign-rejected", handleSignRejected);
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
        this.notifyTransactionAdded(newTx);
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

    walletLogger.operation("Transaction polling", "start", { hash });

    try {
      // Get chainweb client from global context or create a new one
      interface GlobalContext {
        getClient?: () => ChainwebClient;
      }

      function isGlobalContext(obj: unknown): obj is GlobalContext & { getClient: () => ChainwebClient } {
        return obj !== null && typeof obj === 'object' && 'getClient' in obj && typeof (obj as any).getClient === 'function';
      }

      let client: ChainwebClient;
      const globalContext = typeof window !== 'undefined'
        ? (window as any).__PACT_TOOLBOX_CONTEXT__
        : typeof globalThis !== 'undefined'
          ? (globalThis as any).__PACT_TOOLBOX_CONTEXT__
          : undefined;

      if (isGlobalContext(globalContext)) {
        client = globalContext.getClient();
        walletLogger.debug("Using global context client");
      } else {
        // Fallback: create a new client
        walletLogger.debug("Creating new ChainwebClient for polling");
        client = new ChainwebClient({
          networkId: this.config.networkId || "development",
          chainId: "0",
          rpcUrl: (networkId: string, chainId: string) => {
            return this.config.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId);
          },
        });
      }

      walletLogger.debug("Starting waitForResult with proper polling", { client: !!client, hash });

      // Try to get the result with proper polling and retry logic
      try {
        // First try a single poll to see if result is already available
        const quickResult = await client.pollOne(hash);
        if (quickResult) {
          walletLogger.debug("Transaction result received immediately", { result: quickResult });
          // Process the quick result
          const status = quickResult.result?.status === "success" ? "success" : "failure";
          const txResult: TransactionResult = {
            requestKey: hash,
            status,
            data: quickResult.result?.data as Record<string, unknown> | undefined,
            error: quickResult.result?.error ? {
              message: typeof quickResult.result.error === 'string' ? quickResult.result.error : quickResult.result.error.message,
              type: 'error'
            } : undefined
          };

          await this.updateTransactionStatus(transactionId, status, txResult);
          if (this.shouldUseUI()) {
            this.notifyTransactionUpdated(transactionId, status, txResult);
          }
          return;
        }

        // If not immediately available, continue polling with retry logic
        let attempts = 0;
        const maxAttempts = 12; // 1 minute with 5s intervals
        const pollInterval = 5000;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          attempts++;

          try {
            const result = await client.pollOne(hash);
            if (result) {
              walletLogger.debug("Transaction result received after polling", { result, attempts });

              const status = result.result?.status === "success" ? "success" : "failure";
              const txResult: TransactionResult = {
                requestKey: hash,
                status,
                data: result.result?.data as Record<string, unknown> | undefined,
                error: result.result?.error ? {
                  message: typeof result.result.error === 'string' ? result.result.error : result.result.error.message,
                  type: 'error'
                } : undefined
              };

              await this.updateTransactionStatus(transactionId, status, txResult);
              if (this.shouldUseUI()) {
                this.notifyTransactionUpdated(transactionId, status, txResult);
              }
              return;
            }
          } catch (pollError) {
            walletLogger.debug("Poll attempt failed", { attempt: attempts, error: pollError });
            // Continue trying
          }
        }

        // After max attempts, log timeout but don't throw error
        walletLogger.debug("Transaction polling timed out", { hash, attempts });

      } catch (initialError) {
        walletLogger.debug("Initial poll failed", { error: initialError });
        // Still pending, will be retried later
      }


      walletLogger.operation("Transaction polling", "success", { hash });
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
    result?: TransactionResult,
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

  private notifyTransactionAdded(transaction: DevWalletTransaction): void {
    walletEventEmitter.emit('transaction-added', transaction);
  }

  private notifyTransactionUpdated(transactionId: string, status: string, result?: TransactionResult): void {
    walletEventEmitter.emit('transaction-updated', transactionId, status, result);
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
    // Validate private key format before proceeding
    if (!this.validatePrivateKey(privateKey)) {
      throw new Error("Invalid private key format. Expected 64-character hex string or 44-character base64 string.");
    }

    try {
      // Use registry to create wallet and get account info
      const wallet = await this.keypairRegistry.createWalletFromPrivateKey(privateKey, {
        networkId: this.config.networkId,
        rpcUrl: this.config.rpcUrl,
        accountName,
      });

      // The wallet is already connected in createWalletFromPrivateKey, but we can call connect to get the account
      const account = await wallet.connect();

      const key: DevWalletKey = {
        address: accountName ?? account.address,
        publicKey: account.publicKey,
        privateKey,
        name: accountName ?? `Development Key`,
        createdAt: Date.now(),
      };

      // Save the key to storage
      await this.storage.saveKey(key);
      await this.storage.setSelectedKey(key.address);

      this.selectedKey = { ...key, privateKey: '' }; // Clear private key from memory
    } catch (error) {
      walletLogger.error("Failed to initialize from private key", { error });
    }
  }
}
