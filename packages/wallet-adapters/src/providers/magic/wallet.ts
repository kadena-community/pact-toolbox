import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";
import type {
  MagicOptions,
  MagicSDK,
  MagicSpireKeyAccount,
  MagicTransaction,
  MagicEvents,
} from "./types";

/**
 * Magic wallet implementation with SpireKey support
 */
import { BaseWallet } from "@pact-toolbox/wallet-core";

export class MagicWallet extends BaseWallet {
  private magic: MagicSDK | undefined;
  private magicAccount: MagicSpireKeyAccount | undefined;
  private options: Required<MagicOptions>;
  private events: Partial<MagicEvents> = {};

  constructor(options: MagicOptions) {
    super();
    this.options = {
      magicApiKey: options.magicApiKey,
      chainwebApiUrl: options.chainwebApiUrl || "https://api.chainweb.com",
      chainId: options.chainId || "0",
      networkId: options.networkId || "mainnet01",
      createAccountsOnChain: options.createAccountsOnChain ?? true,
    };

    if (!this.options.magicApiKey) {
      throw WalletError.connectionFailed("Magic API key is required");
    }
  }

  /**
   * Check if Magic is available
   */
  isInstalled(): boolean {
    // Magic doesn't require installation, it's a service
    return true;
  }

  /**
   * Initialize Magic SDK
   */
  private async initializeMagic(): Promise<void> {
    if (this.magic) return;

    try {
      // Dynamic import to avoid bundling Magic when not used
      const { Magic } = await import("magic-sdk");
      const { KadenaExtension } = await import("@magic-ext/kadena");

      // Create Kadena extension
      const kdaExtension = new KadenaExtension({
        rpcUrl: this.options.chainwebApiUrl,
        chainId: this.options.chainId,
        networkId: this.options.networkId,
        createAccountsOnChain: this.options.createAccountsOnChain,
      });

      // Initialize Magic with Kadena extension
      this.magic = new Magic(this.options.magicApiKey, {
        extensions: [kdaExtension],
      }) as unknown as MagicSDK;
    } catch (error) {
      throw WalletError.connectionFailed(
        `Failed to initialize Magic SDK: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Connect to Magic wallet using SpireKey
   */
  async connect(_networkId?: string): Promise<WalletAccount> {
    await this.initializeMagic();

    if (!this.magic) {
      throw WalletError.connectionFailed("Failed to initialize Magic SDK");
    }

    try {
      // Login with SpireKey (WebAuthn)
      const account = await this.magic.kadena.loginWithSpireKey();

      // Store account information
      this.magicAccount = account;

      // Emit login event
      this.events.login?.(account);

      // Extract signer information
      const publicKey = account.keyset.keys[0] || "";

      this.account = {
        address: account.accountName,
        publicKey,
        balance: 0,
        connectedSites: [],
      };
      this.connected = true;

      // Set up network info
      const networkId = this.options.networkId;
      const networks: Record<string, { name: string; url: string; explorer?: string }> = {
        mainnet01: {
          name: "Mainnet",
          url: "https://api.chainweb.com",
          explorer: "https://explorer.chainweb.com/mainnet",
        },
        testnet04: {
          name: "Testnet",
          url: "https://api.testnet.chainweb.com",
          explorer: "https://explorer.chainweb.com/testnet",
        },
        development: {
          name: "Development",
          url: "http://localhost:8080",
        },
      };

      const network = networks[networkId] || networks["mainnet01"];
      this.network = {
        id: networkId,
        networkId,
        name: network!.name,
        url: network!.url,
        explorer: network!.explorer,
      };

      return this.account;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User denied") || error.message.includes("rejected")) {
          throw WalletError.userRejected("connection");
        }
      }
      throw WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
    }
  }



  /**
   * Check if connected
   */
  async isConnected(_networkId?: string): Promise<boolean> {
    if (!this.magic) {
      return false;
    }

    try {
      return await this.magic.user.isLoggedIn();
    } catch {
      return false;
    }
  }



  /**
   * Disconnect from wallet
   */
  async disconnect(_networkId?: string): Promise<void> {
    if (this.magic) {
      try {
        await this.magic.user.logout();
      } catch (error) {
        // Ignore logout errors
        console.warn("Magic logout error:", error);
      }
    }

    await super.disconnect();
    this.magicAccount = undefined;
    this.events.logout?.();
  }

  /**
   * Sign transaction(s) - uses Magic's quickSign internally
   */
  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.magic || !this.magicAccount) {
      throw WalletError.notConnected("magic");
    }

    const transactions = Array.isArray(txs) ? txs : [txs];

    try {
      // Sign each transaction with Magic
      const signedTxs = await Promise.all(
        transactions.map(async (tx) => {
          // Parse command to create transaction object
          // Create Magic transaction object
          const magicTx: MagicTransaction = {
            cmd: tx.cmd,
            hash: typeof tx.hash === "string" ? tx.hash : "",
            sigs: tx.sigs.map((sig) => ({
              sig: sig.sig ?? undefined,
              pubKey: sig.pubKey || "",
            })),
          };

          // Sign with SpireKey
          const result = await this.magic!.kadena.signTransactionWithSpireKey(magicTx);

          // Return the first (and typically only) signed transaction
          const signedTx = result.transactions[0];
          if (!signedTx) {
            throw new Error("No signed transaction returned");
          }

          return {
            cmd: signedTx.cmd,
            sigs: signedTx.sigs,
            hash: signedTx.hash,
          } as SignedTransaction;
        }),
      );

      return Array.isArray(txs) ? signedTxs : signedTxs[0]!;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User denied") || error.message.includes("rejected")) {
          throw WalletError.userRejected("signing");
        }
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Login with email (Magic Link)
   */
  async loginWithEmail(email: string): Promise<WalletAccount> {
    await this.initializeMagic();

    if (!this.magic) {
      throw WalletError.connectionFailed("Failed to initialize Magic SDK");
    }

    try {
      // Login with Magic Link email
      await this.magic.auth.loginWithMagicLink({ email });

      // After email login, we still need to setup SpireKey for Kadena operations
      return this.connect();
    } catch (error) {
      throw WalletError.connectionFailed(
        `Email login failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Login with SMS
   */
  async loginWithSMS(phoneNumber: string): Promise<WalletAccount> {
    await this.initializeMagic();

    if (!this.magic) {
      throw WalletError.connectionFailed("Failed to initialize Magic SDK");
    }

    try {
      // Login with SMS
      await this.magic.auth.loginWithSMS({ phoneNumber });

      // After SMS login, we still need to setup SpireKey for Kadena operations
      return this.connect();
    } catch (error) {
      throw WalletError.connectionFailed(`SMS login failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.magic) {
      return false;
    }

    try {
      return await this.magic.user.isLoggedIn();
    } catch {
      return false;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<Record<string, unknown>> {
    if (!this.magic) {
      throw WalletError.notConnected("magic");
    }

    try {
      return await this.magic.user.getInfo();
    } catch (error) {
      throw WalletError.unknown(
        `Failed to get user info: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof MagicEvents>(event: K, handler: MagicEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof MagicEvents>(event: K): void {
    delete this.events[event];
  }
}
