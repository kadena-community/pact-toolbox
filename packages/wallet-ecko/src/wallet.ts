import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet, WalletError } from "@pact-toolbox/wallet-core";
import type { WalletAccount, WalletNetwork } from "@pact-toolbox/wallet-core";

// Ecko wallet response types
interface EckoAccountResponse {
  status: "success" | "fail";
  message?: string;
  wallet?: {
    account: string;
    publicKey: string;
    balance?: number;
    connectedSites?: string[];
  };
}

interface EckoNetworkResponse {
  name: string;
  networkId: string;
  url: string;
  explorerUrl?: string;
}

interface EckoQuicksignResponse {
  status: "success" | "fail";
  error?: string;
  quickSignData?: Array<{
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

interface EckoStatusResponse {
  status: "success" | "fail";
  message?: string;
  account?: string;
  publicKey?: string;
}

interface EckoProvider {
  isKadena: boolean;
  request: (args: unknown) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    kadena?: EckoProvider;
  }
}

/**
 * Ecko wallet implementation using native Ecko API
 */
export class EckoWallet extends BaseWallet {
  override readonly id = "ecko";

  constructor() {
    super();
    this.setupEventListeners();
  }

  override isInstalled(): boolean {
    return typeof window !== "undefined" && Boolean(window.kadena?.isKadena);
  }

  override async connect(networkId: string = "mainnet01"): Promise<WalletAccount> {
    if (!this.isInstalled()) {
      throw WalletError.notFound("ecko");
    }

    try {
      // Check connection status first
      const statusResp = await window.kadena!.request({
        method: "kda_checkStatus",
        networkId,
      }) as EckoStatusResponse;

      // If not connected, request connection
      if (statusResp.status !== "success") {
        await window.kadena!.request({
          method: "kda_connect",
          networkId,
        });

        // Re-check status after connection
        const newStatus = await window.kadena!.request({
          method: "kda_checkStatus",
          networkId,
        }) as EckoStatusResponse;

        if (newStatus.status !== "success") {
          throw new Error(newStatus.message || "Failed to connect");
        }
      }

      // Get account info
      const accountResp = await window.kadena!.request({
        method: "kda_requestAccount",
        networkId,
      }) as EckoAccountResponse;

      if (accountResp.status !== "success" || !accountResp.wallet) {
        throw new Error(accountResp.message || "Could not fetch account");
      }

      this.account = {
        address: accountResp.wallet.account,
        publicKey: accountResp.wallet.publicKey,
        balance: accountResp.wallet.balance,
        connectedSites: accountResp.wallet.connectedSites || [],
      };

      // Get network info
      await this.updateNetworkInfo();

      this.connected = true;
      this.network!.networkId = networkId;
      this.emit("connected");
      this.emit("accountChanged", this.account);

      return this.account;
    } catch (error) {
      // Handle invalid network by getting active network and retrying
      if (error instanceof Error && error.message.toLowerCase().includes("invalid")) {
        try {
          const activeNetwork = await this.getActiveNetwork();
          return await this.connect(activeNetwork.networkId);
        } catch (retryError) {
          // Fall through to normal error handling
        }
      }

      if (error instanceof Error && error.message.includes("User denied")) {
        throw WalletError.userRejected("connection");
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

    try {
      // Parse networkId from first transaction
      const firstTx = transactions[0];
      if (!firstTx) {
        throw new Error("No transactions provided");
      }
      const parsedCmd = JSON.parse(firstTx.cmd);
      const networkId = parsedCmd.networkId || this.network?.networkId || "mainnet01";

      // Prepare quicksign request in Ecko's format
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
      }) as EckoQuicksignResponse;

      if (response.status === "fail") {
        throw new Error(response.error || "Signing failed");
      }

      const quickSignData = response.quickSignData;
      if (!quickSignData || !Array.isArray(quickSignData)) {
        throw new Error("Invalid response format from Ecko");
      }

      const signedTxs = quickSignData.map((res, index) => {
        if (res.outcome.result === "failure") {
          throw new Error(res.outcome.msg || "Signing failed");
        }

        if (res.outcome.result === "noSig") {
          // Return unsigned transaction as SignedTransaction with empty sigs
          return {
            cmd: transactions[index]!.cmd,
            sigs: transactions[index]!.sigs,
            hash: transactions[index]!.hash || "",
          } as SignedTransaction;
        }

        return {
          cmd: res.commandSigData.cmd,
          sigs: res.commandSigData.sigs,
          hash: res.outcome.hash || transactions[index]!.hash || "",
        } as SignedTransaction;
      });

      return Array.isArray(txOrTxs) ? signedTxs : signedTxs[0]!;
    } catch (error) {
      if (error instanceof Error && error.message.includes("User denied")) {
        throw WalletError.userRejected("signing");
      }
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  override async disconnect(networkId?: string): Promise<void> {
    try {
      await window.kadena!.request({
        method: "kda_disconnect",
        networkId: networkId || this.network?.networkId,
      });
    } finally {
      this.connected = false;
      this.account = null;
      this.network = null;
      this.emit("disconnected");
    }
  }

  /**
   * Get active network from wallet
   */
  async getActiveNetwork(): Promise<WalletNetwork> {
    const response = await window.kadena!.request({
      method: "kda_getNetwork",
    }) as EckoNetworkResponse;

    return {
      id: response.networkId,
      networkId: response.networkId,
      name: response.name || response.networkId,
      url: response.url || "",
      explorer: response.explorerUrl,
    };
  }

  /**
   * Update network info from wallet
   */
  private async updateNetworkInfo(): Promise<void> {
    try {
      const networkResponse = await window.kadena!.request({
        method: "kda_getNetwork",
      }) as EckoNetworkResponse;

      this.network = {
        id: networkResponse.networkId,
        networkId: networkResponse.networkId,
        name: networkResponse.name || networkResponse.networkId,
        url: networkResponse.url || "",
        explorer: networkResponse.explorerUrl,
      };
    } catch (error) {
      // Fallback to default network info
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
   * Setup event listeners from wallet provider
   */
  private setupEventListeners(): void {
    if (typeof window === "undefined" || !(window as any).kadena) return;
    const kadena = (window as any).kadena as EckoProvider;

    // Listen for account changes from the wallet
    if (kadena.on) {
      kadena.on("kadena_accountChanged", (accountInfo: any) => {
        if (accountInfo?.wallet) {
          this.account = {
            address: accountInfo.wallet.account,
            publicKey: accountInfo.wallet.publicKey,
            balance: accountInfo.wallet.balance,
            connectedSites: accountInfo.wallet.connectedSites || [],
          };
          this.emit("accountChanged", this.account);
        }
      });

      kadena.on("kadena_networkChanged", ((networkInfo: EckoNetworkResponse) => {
        this.network = {
          id: networkInfo.networkId,
          networkId: networkInfo.networkId,
          name: networkInfo.name || networkInfo.networkId,
          url: networkInfo.url || "",
          explorer: networkInfo.explorerUrl,
        };
        this.emit("networkChanged", this.network);
      }) as (...args: unknown[]) => void);
    }
  }
}
