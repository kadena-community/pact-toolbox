import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";

interface ChainweaverQuicksignRequest {
  cmdSigDatas: Array<{
    cmd: string;
    sigs: Array<{
      pubKey: string;
      sig: string | null;
    }>;
  }>;
}

interface ChainweaverQuicksignResponse {
  responses: Array<{
    outcome: {
      result: "success" | "failure" | "noSig";
      msg?: string;
      hash?: string;
    };
    commandSigData: {
      cmd: string;
      sigs: Array<{
        pubKey: string;
        sig: string | null;
      }>;
    };
  }>;
}

/**
 * Chainweaver Legacy wallet implementation using desktop app HTTP endpoints
 */
export class ChainweaverLegacyWallet extends BaseWallet {
  override readonly id = "chainweaver-legacy";
  private static readonly CHAINWEAVER_URL = "http://127.0.0.1:9467";
  private static readonly QUICKSIGN_ENDPOINT = "/v1/quicksign";

  isInstalled(): boolean {
    // Can't directly detect desktop app, always return true
    return true;
  }

  async connect(networkId: string = "mainnet01"): Promise<WalletAccount> {
    try {
      // Test connection by attempting a simple request
      const testUrl = `${ChainweaverLegacyWallet.CHAINWEAVER_URL}/v1/status`;
      const response = await fetch(testUrl, { method: "GET" });

      if (!response.ok) {
        throw new Error("Cannot reach Chainweaver desktop app");
      }

      // For legacy, we just assume connection and return a placeholder account
      // User needs to select account when signing
      this.account = {
        address: "chainweaver-account",
        publicKey: "", // Chainweaver manages keys internally
        balance: 0,
      };

      // Set up network info
      this.network = {
        id: networkId,
        networkId,
        name: this.getNetworkName(networkId),
        url: this.getNetworkUrl(networkId),
        explorer: this.getExplorerUrl(networkId),
      };

      this.connected = true;
      return this.account;
    } catch (error) {
      throw WalletError.connectionFailed(
        "Failed to connect to Chainweaver desktop app. Make sure it's running on port 9467.",
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
    const isList = Array.isArray(txOrTxs);

    try {
      // Prepare quicksign request
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
        `${ChainweaverLegacyWallet.CHAINWEAVER_URL}${ChainweaverLegacyWallet.QUICKSIGN_ENDPOINT}`,
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
          // Return unsigned transaction
          return transactions[index]!;
        }

        return {
          cmd: res.commandSigData.cmd,
          sigs: res.commandSigData.sigs,
          hash: res.outcome.hash || (typeof transactions[index]!.hash === 'string' ? transactions[index]!.hash : '') || "",
        } as SignedTransaction;
      });

      return isList ? (signedTxs as SignedTransaction[]) : (signedTxs[0]! as SignedTransaction);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          throw WalletError.connectionFailed(
            "Cannot connect to Chainweaver desktop app. Make sure it's running.",
          );
        }
        if (error.message.includes("User denied") || error.message.includes("rejected")) {
          throw WalletError.userRejected("signing");
        }
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  override async disconnect(): Promise<void> {
    await super.disconnect();
  }

  /**
   * Helper to get network name
   */
  private getNetworkName(networkId: string): string {
    const names: Record<string, string> = {
      mainnet01: "Mainnet",
      testnet04: "Testnet",
      development: "Development",
    };
    return names[networkId] || networkId;
  }

  /**
   * Helper to get network URL
   */
  private getNetworkUrl(networkId: string): string {
    const urls: Record<string, string> = {
      mainnet01: "https://api.chainweb.com",
      testnet04: "https://api.testnet.chainweb.com",
      development: "http://localhost:8080",
    };
    return urls[networkId] || "";
  }

  /**
   * Helper to get explorer URL
   */
  private getExplorerUrl(networkId: string): string | undefined {
    const explorers: Record<string, string> = {
      mainnet01: "https://explorer.chainweb.com/mainnet",
      testnet04: "https://explorer.chainweb.com/testnet",
    };
    return explorers[networkId];
  }
}