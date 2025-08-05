import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";
import type { 
  ZelcoreAccountsResponse,
  ZelcoreSignRequest,
  ZelcoreSignResponse,
  ZelcoreConnectionOptions
} from "./types";

/**
 * Zelcore wallet implementation
 */
import { BaseWallet } from "@pact-toolbox/wallet-core";

export class ZelcoreWallet extends BaseWallet {
  readonly id = "zelcore";
  private static readonly ZELCORE_URL = "http://127.0.0.1:9467";
  private static readonly SIGN_ENDPOINT = "/v1/sign";
  private static readonly ACCOUNTS_ENDPOINT = "/v1/accounts";
  
  private connectionOptions: ZelcoreConnectionOptions | undefined;

  /**
   * Check if Zelcore is installed/available
   */
  isInstalled(): boolean {
    // Zelcore is a desktop app, we can't detect it directly
    return true;
  }

  /**
   * Connect to Zelcore wallet
   */
  async connect(networkId?: string): Promise<WalletAccount> {
    try {
      // Fetch available accounts from Zelcore
      const response = await fetch(`${ZelcoreWallet.ZELCORE_URL}${ZelcoreWallet.ACCOUNTS_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ asset: "kadena" }),
      });

      if (!response.ok) {
        throw new Error(`Zelcore returned ${response.status}`);
      }

      const result = await response.json() as ZelcoreAccountsResponse;
      
      if (result.status !== "success" || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("No Kadena accounts found in Zelcore");
      }

      // Parse the first account
      // Zelcore returns accounts as ["k:pubkey", "pubkey", ...]
      const accountData = result.data[0];
      if (!accountData) {
        throw new Error("No accounts found in Zelcore");
      }
      const publicKey = accountData.startsWith("k:") ? accountData.slice(2) : accountData;
      const address = `k:${publicKey}`;

      this.account = {
        address,
        publicKey,
        balance: 0,
        connectedSites: [],
      };
      this.connected = true;

      // Store network ID if provided
      if (this.connectionOptions && networkId) {
        this.connectionOptions.networkId = networkId;
      }

      // Set up network info
      const networkId2 = networkId || this.connectionOptions?.networkId || "mainnet01";
      const networks: Record<string, { name: string; url: string; explorer?: string }> = {
        mainnet01: {
          name: "Mainnet",
          url: "https://api.chainweb.com",
          explorer: "https://explorer.chainweb.com/mainnet"
        },
        testnet04: {
          name: "Testnet",
          url: "https://api.testnet.chainweb.com",
          explorer: "https://explorer.chainweb.com/testnet"
        },
        development: {
          name: "Development",
          url: "http://localhost:8080",
        }
      };

      const network = networks[networkId2] || networks["mainnet01"];
      this.network = {
        id: networkId2,
        networkId: networkId2,
        name: network!.name,
        url: network!.url,
        explorer: network!.explorer,
      };

      return this.account;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Failed to fetch")) {
        throw WalletError.connectionFailed(
          "Cannot connect to Zelcore. Make sure Zelcore is running."
        );
      }
      throw WalletError.connectionFailed(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Set connection options for Zelcore
   */
  setConnectionOptions(options: ZelcoreConnectionOptions): void {
    this.connectionOptions = options;
  }






  /**
   * Disconnect from wallet
   */
  async disconnect(_networkId?: string): Promise<void> {
    await super.disconnect();
    this.connectionOptions = undefined;
  }

  /**
   * Sign transaction(s) - signs one by one as Zelcore doesn't support batch signing
   */
  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    const transactions = Array.isArray(txs) ? txs : [txs];
    const isArray = Array.isArray(txs);
    
    const signedTxs = await Promise.all(
      transactions.map(tx => this._signSingle(tx))
    );

    return isArray ? signedTxs : signedTxs[0]!;
  }

  /**
   * Internal method to sign a single transaction
   */
  private async _signSingle(tx: PartiallySignedTransaction): Promise<SignedTransaction> {
    if (!this.connected || !this.account) {
      throw WalletError.notConnected(this.id);
    }

    try {
      const parsedCmd = JSON.parse(tx.cmd);
      const networkId = this.connectionOptions?.networkId || parsedCmd.networkId || "mainnet01";
      
      // Prepare Zelcore sign request
      const signRequest: ZelcoreSignRequest = {
        ...parsedCmd,
        signingPubKey: parsedCmd.meta?.sender?.slice(2) || this.account.publicKey,
        networkId,
      };

      const response = await fetch(`${ZelcoreWallet.ZELCORE_URL}${ZelcoreWallet.SIGN_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zelcore returned ${response.status}: ${errorText}`);
      }

      const result = await response.json() as ZelcoreSignResponse;

      return {
        cmd: result.body.cmd,
        sigs: result.body.sigs,
        hash: result.body.hash,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          throw WalletError.connectionFailed(
            "Cannot connect to Zelcore. Make sure Zelcore is running."
          );
        }
        if (error.message.includes("User denied") || error.message.includes("rejected")) {
          throw WalletError.userRejected("signing");
        }
      }
      throw WalletError.signingFailed(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}