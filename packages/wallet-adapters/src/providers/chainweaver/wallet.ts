import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";
import type {
  ChainweaverQuicksignRequest,
  ChainweaverQuicksignResponse,
  ChainweaverConnectionOptions,
} from "./types";

/**
 * Chainweaver wallet implementation
 */
export class ChainweaverWallet extends BaseWallet {
  readonly id = "chainweaver";
  private static readonly CHAINWEAVER_URL = "http://127.0.0.1:9467";
  private static readonly QUICKSIGN_ENDPOINT = "/v1/quicksign";

  private connectionOptions: ChainweaverConnectionOptions | undefined;

  /**
   * Set connection options for Chainweaver
   */
  setConnectionOptions(options: ChainweaverConnectionOptions): void {
    this.connectionOptions = options;
  }

  isInstalled(): boolean {
    // Chainweaver is a desktop app, we can't detect it directly
    return true;
  }

  async connect(networkId?: string): Promise<WalletAccount> {
    if (!this.connectionOptions) {
      throw WalletError.connectionFailed(
        "Connection options required for Chainweaver. Please provide accountName and chainIds.",
      );
    }

    try {
      // Test connection by attempting a simple request
      const testUrl = `${ChainweaverWallet.CHAINWEAVER_URL}/v1/status`;
      await fetch(testUrl, { method: 'GET' }).catch(() => {
        throw new Error("Cannot reach Chainweaver");
      });

      this.connected = true;
      
      // Set up account and network info
      this.account = {
        address: this.connectionOptions.accountName,
        publicKey: "", // Chainweaver manages keys internally
        balance: 0, // Would need to query chain for actual balance
      };

      const networkId2 = networkId || this.connectionOptions.networkId || "mainnet01";
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

      const network = networks[networkId2] || networks["mainnet01"];
      this.network = {
        id: networkId2,
        networkId: networkId2,
        name: network!.name,
        url: network!.url,
        explorer: network!.explorer,
      };

      return this.account;
    } catch {
      throw WalletError.connectionFailed(
        "Failed to connect to Chainweaver. Make sure Chainweaver is running on port 9467.",
      );
    }
  }


  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.connected) {
      throw WalletError.notConnected(this.id);
    }

    const transactions = Array.isArray(txOrTxs) ? txOrTxs : [txOrTxs];

    try {
      // Convert to Chainweaver format
      const quickSignRequest: ChainweaverQuicksignRequest = {
        cmdSigDatas: transactions.map((tx) => ({
          cmd: tx.cmd,
          sigs: tx.sigs.map((sig) => ({
            pubKey: sig.pubKey || "",
            sig: sig.sig ?? null,
          })),
        })),
      };

      const response = await fetch(
        `${ChainweaverWallet.CHAINWEAVER_URL}${ChainweaverWallet.QUICKSIGN_ENDPOINT}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(quickSignRequest),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chainweaver returned ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as ChainweaverQuicksignResponse;

      // Process responses
      const signedTxs = result.responses.map((res, index) => {
        if (res.outcome.result === "failure") {
          throw new Error(res.outcome.msg || "Signing failed");
        }

        if (res.outcome.result === "noSig") {
          throw new Error("No signature provided");
        }

        const tx = transactions[index]!;
        return {
          cmd: res.commandSigData.cmd,
          sigs: res.commandSigData.sigs,
          hash: res.outcome.hash || tx.hash || "",
        } as SignedTransaction;
      });

      return Array.isArray(txOrTxs) ? signedTxs : signedTxs[0]!;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          throw WalletError.connectionFailed("Cannot connect to Chainweaver. Make sure Chainweaver is running.");
        }
        if (error.message.includes("User denied") || error.message.includes("rejected")) {
          throw WalletError.userRejected("signing");
        }
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }
}
