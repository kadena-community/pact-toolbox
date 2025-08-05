import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError, KadenaNetworks } from "@pact-toolbox/wallet-core";
import type { WalletAccount, NetworkCapabilities } from "@pact-toolbox/wallet-core";

declare global {
  interface Window {
    kadena?: {
      isKadena: boolean;
      request: (args: unknown) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

/**
 * Simplified Ecko wallet implementation
 */
export class EckoWallet extends BaseWallet {
  readonly id = "ecko";
  
  constructor() {
    super();
    if (typeof window === "undefined" || !window.kadena?.isKadena) {
      throw WalletError.notFound("ecko");
    }
  }

  isInstalled(): boolean {
    return Boolean(window.kadena?.isKadena);
  }

  async connect(networkId?: string): Promise<WalletAccount> {
    try {
      // Connect to wallet
      await window.kadena!.request({
        method: "kda_connect",
        networkId,
      });

      // Get account info
      const response = await window.kadena!.request({
        method: "kda_requestAccount",
        networkId,
      });

      const account = (response as any).wallet;

      this.account = {
        address: account.account,
        publicKey: account.publicKey,
        balance: account.balance,
        connectedSites: account.connectedSites || [],
      };

      // Get network info
      const networkResponse = await window.kadena!.request({
        method: "kda_getNetwork",
      });

      const netData = networkResponse as any;
      this.network = {
        id: netData.networkId,
        networkId: netData.networkId,
        name: netData.name,
        url: netData.url || "",
        explorer: netData.explorerUrl,
      };

      this.connected = true;
      return this.account;
    } catch (error) {
      if (error instanceof Error && error.message.includes("User denied")) {
        throw WalletError.userRejected("connection");
      }
      throw WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
    }
  }

  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    const transactions = Array.isArray(txOrTxs) ? txOrTxs : [txOrTxs];

    try {
      // Parse networkId from first transaction
      const firstTx = transactions[0];
      if (!firstTx) {
        throw new Error("No transactions provided");
      }
      const parsedCmd = JSON.parse(firstTx.cmd);
      const networkId = parsedCmd.networkId || "mainnet01";

      // Use quickSign for better performance
      const quickSignRequest = {
        networkId,
        commandSigDatas: transactions.map((tx) => ({
          cmd: tx.cmd,
          sigs: tx.sigs.map((sig) => ({
            pubKey: sig.pubKey || "",
            sig: sig.sig ?? null,
          })),
        })),
      };

      const response = await window.kadena!.request({
        method: "kda_requestQuickSign",
        data: quickSignRequest,
      });

      const responseData = response as any;
      if (responseData.status === "fail") {
        throw new Error(responseData.error || "Signing failed");
      }

      const responses = responseData.quickSignData || responseData.responses;
      if (!Array.isArray(responses)) {
        throw new Error("Invalid response format");
      }

      const signedTxs = responses.map((res: any, index: number) => {
        if (res.outcome.result !== "success") {
          throw new Error(res.outcome.msg || "Signing failed");
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
      if (error instanceof Error && error.message.includes("User denied")) {
        throw WalletError.userRejected("signing");
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  async disconnect(): Promise<void> {
    try {
      await window.kadena!.request({
        method: "kda_disconnect",
        networkId: this.network?.networkId,
      });
    } finally {
      await super.disconnect();
    }
  }

  /**
   * Get network capabilities
   */
  getNetworkCapabilities(): NetworkCapabilities {
    return {
      canSwitchNetwork: true,
      canAddNetwork: false,
      supportedNetworks: ["mainnet01", "testnet04", "development"],
    };
  }

  /**
   * Switch network
   */
  async switchNetwork(networkId: string): Promise<void> {
    if (!this.connected) {
      throw WalletError.notConnected(this.id);
    }

    try {
      // Ecko uses kda_connect with networkId parameter
      await window.kadena!.request({
        method: "kda_connect",
        networkId,
      });

      // Update network info
      const networkResponse = await window.kadena!.request({
        method: "kda_getNetwork",
      });

      const netData = networkResponse as any;
      this.network = {
        id: netData.networkId,
        networkId: netData.networkId,
        name: netData.name || KadenaNetworks[netData.networkId]?.name || netData.networkId,
        url: netData.url || KadenaNetworks[netData.networkId]?.url || "",
        explorer: netData.explorerUrl || KadenaNetworks[netData.networkId]?.explorer,
      };
    } catch (error) {
      throw WalletError.connectionFailed(
        `Failed to switch network: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
