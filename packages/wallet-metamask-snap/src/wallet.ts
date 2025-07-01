import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type { WalletAccount, WalletNetwork } from "@pact-toolbox/wallet-core";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";

// Default Snap origin
const DEFAULT_SNAP_ORIGIN = "npm:@kadena/kadena-snap";

// MetaMask types
interface SnapAccount {
  address: string;
  publicKey: string;
  chainIds?: string[];
}

interface SnapNetwork {
  networkId: string;
  networkName: string;
  urls: string[];
}

interface QuicksignResponse {
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
 * MetaMask Snap wallet implementation for Kadena
 */
export class MetaMaskSnapWallet extends BaseWallet {
  override readonly id = "metamask-snap";
  private snapId: string;
  private connectedAccountId?: string;

  constructor(snapId: string = DEFAULT_SNAP_ORIGIN) {
    super();
    this.snapId = snapId;
  }

  isInstalled(): boolean {
    return typeof window !== "undefined" && Boolean((window as any).ethereum?.isMetaMask);
  }

  async connect(networkId: string = "mainnet01"): Promise<WalletAccount> {
    if (!this.isInstalled()) {
      throw WalletError.notFound("MetaMask");
    }

    try {
      // Request Snap installation/connection
      const snaps = await (window as any).ethereum.request({
        method: "wallet_requestSnaps",
        params: {
          [this.snapId]: {},
        },
      });

      if (!snaps[this.snapId]) {
        throw new Error("Failed to install/connect to Kadena Snap");
      }

      // Check connection status
      const isConnected = await this.invokeSnap<boolean>("kda_checkConnection");
      
      if (!isConnected) {
        // Connect to the snap
        await this.invokeSnap("kda_connect", { networkId });
      }

      // Get accounts from snap
      const accounts = await this.invokeSnap<SnapAccount[]>("kda_getAccounts");
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in Snap");
      }

      const firstAccount = accounts[0]!;
      this.connectedAccountId = firstAccount.address;
      
      // Clean up public key (remove 0x00 prefix if present)
      const publicKey = firstAccount.publicKey.replace(/^0x00/, "");
      
      this.account = {
        address: firstAccount.address,
        publicKey,
        connectedSites: [],
      };

      // Get network info
      await this.updateNetworkInfo();
      
      this.connected = true;
      this.emit("connected");
      this.emit("accountChanged", this.account);
      return this.account;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User rejected") || error.message.includes("denied")) {
          throw WalletError.userRejected("connection");
        }
        if (error.message.includes("MetaMask not found")) {
          throw WalletError.notFound("MetaMask");
        }
      }
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      throw WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
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
      // Prepare commandSigDatas for quicksign
      const commandSigDatas = transactions.map((tx) => ({
        cmd: tx.cmd,
        sigs: tx.sigs.map((sig) => ({
          pubKey: sig.pubKey || "",
          sig: sig.sig ?? null,
        })),
      }));

      // Use quicksign
      const response = await this.invokeSnap<QuicksignResponse>("kda_requestQuickSign", {
        commandSigDatas,
      });

      if (!response.responses || !Array.isArray(response.responses)) {
        throw new Error("Invalid response from Snap");
      }

      const signedTxs = response.responses.map((res, index) => {
        if (res.outcome.result === "failure") {
          throw new Error(res.outcome.msg || "Signing failed");
        }

        if (res.outcome.result === "noSig") {
          // Return unsigned transaction
          return {
            ...transactions[index]!,
            hash: typeof transactions[index]!.hash === 'string' ? transactions[index]!.hash : '',
          } as SignedTransaction;
        }

        return {
          cmd: res.commandSigData.cmd,
          sigs: res.commandSigData.sigs,
          hash: res.outcome.hash || (typeof transactions[index]!.hash === 'string' ? transactions[index]!.hash : '') || "",
        } as SignedTransaction;
      });

      return isList ? signedTxs : signedTxs[0]!;
    } catch (error) {
      if (error instanceof Error && (error.message.includes("User rejected") || error.message.includes("denied"))) {
        throw WalletError.userRejected("signing");
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  override async disconnect(): Promise<void> {
    try {
      await this.invokeSnap("kda_disconnect");
    } finally {
      this.connected = false;
      this.account = null;
      this.network = null;
      this.connectedAccountId = undefined;
      this.emit("disconnected");
    }
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<WalletAccount[]> {
    if (!this.connected) {
      return [];
    }

    const accounts = await this.invokeSnap<SnapAccount[]>("kda_getAccounts");
    return accounts.map((acc) => ({
      address: acc.address,
      publicKey: acc.publicKey.replace(/^0x00/, ""),
      connectedSites: [],
    }));
  }

  /**
   * Get all networks
   */
  async getNetworks(): Promise<WalletNetwork[]> {
    const networks = await this.invokeSnap<SnapNetwork[]>("kda_getNetworks_v1");
    return networks.map((net) => ({
      id: net.networkId,
      networkId: net.networkId,
      name: net.networkName,
      url: net.urls[0] || "",
      explorer: this.getExplorerUrl(net.networkId),
    }));
  }

  /**
   * Update network info from snap
   */
  private async updateNetworkInfo(): Promise<void> {
    try {
      const networkInfo = await this.invokeSnap<SnapNetwork>("kda_getNetwork_v1");
      this.network = {
        id: networkInfo.networkId,
        networkId: networkInfo.networkId,
        name: networkInfo.networkName,
        url: networkInfo.urls[0] || "",
        explorer: this.getExplorerUrl(networkInfo.networkId),
      };
    } catch (error) {
      // Fallback to default network
      this.network = {
        id: "mainnet01",
        networkId: "mainnet01",
        name: "Mainnet",
        url: "https://api.chainweb.com",
        explorer: "https://explorer.chainweb.com/mainnet",
      };
    }
  }

  /**
   * Invoke a Snap method
   */
  private async invokeSnap<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return (window as any).ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: this.snapId,
        request: {
          method,
          ...(params ? { params } : {}),
        },
      },
    }) as Promise<T>;
  }

  /**
   * Get explorer URL for network
   */
  private getExplorerUrl(networkId: string): string | undefined {
    const explorers: Record<string, string> = {
      mainnet01: "https://explorer.chainweb.com/mainnet",
      testnet04: "https://explorer.chainweb.com/testnet",
    };
    return explorers[networkId];
  }
}
