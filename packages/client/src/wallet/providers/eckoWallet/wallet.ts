import type { IEckoSignFunction, IEckoSignSingleFunction } from "@kadena/client";
import type { PartiallySignedTransaction, Transaction } from "@pact-toolbox/types";
import { createQuicksignWithEckoWallet, createSignWithEckoWallet } from "@kadena/client";

import type { Wallet, WalletNetwork } from "../../wallet";
import type { ConnectResponse, RequestAccountResponse, WalletApi, WalletEvent, WalletEventHandlers } from "./types";

declare const globalThis: {
  kadena?: WalletApi;
};
export class EckoWalletProvider implements Wallet {
  private api: WalletApi | undefined;
  public _eckoSign: IEckoSignSingleFunction = createSignWithEckoWallet();
  public _eckoQuickSign: IEckoSignFunction = createQuicksignWithEckoWallet();

  constructor() {
    this.api = globalThis.kadena;
  }

  //@ts-expect-error
  sign(tx: PartiallySignedTransaction): Promise<Transaction> {
    //@ts-expect-error
    const _res = this._eckoSign(tx);
  }
  quickSign(tx: PartiallySignedTransaction): Promise<Transaction>;
  quickSign(txs: PartiallySignedTransaction[]): Promise<Transaction[]>;
  async quickSign(
    txs: PartiallySignedTransaction | PartiallySignedTransaction[],
    //@ts-expect-error
  ): Promise<Transaction | Transaction[]> {
    txs = Array.isArray(txs) ? txs : [txs];
    const _signer = await this.getSigner();
    const _cmds = txs.map((tx) => JSON.parse(tx.cmd));
  }

  on<E extends WalletEvent>(event: E, callback: WalletEventHandlers[E]): void {
    this.api?.on(event, callback);
  }

  isInstalled(): boolean {
    const { kadena } = globalThis;
    return Boolean(kadena && kadena.isKadena);
  }

  async connect(networkId?: string): Promise<import("../..").WalletSigner> {
    if (!this.api || !this.isInstalled()) {
      throw new Error("Ecko Wallet is not installed");
    }
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<ConnectResponse>({
      method: "kda_connect",
      networkId,
    });
    if ("fail" === res.status) {
      throw new Error(res.message);
    }
    return res.account;
  }

  async getSigner(networkId?: string): Promise<import("../..").WalletSigner> {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    return this.checkStatus(networkId);
  }

  async getAccountDetails(networkId?: string): Promise<import("../..").WalletAccount> {
    if (!this.api || !this.isInstalled()) {
      throw new Error("Ecko Wallet is not installed");
    }
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<RequestAccountResponse>({
      method: "kda_requestAccount",
      networkId,
    });
    if ("fail" === res.status) {
      throw new Error(res.message);
    }
    return res.wallet;
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.checkStatus();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(networkId?: string): Promise<void> {
    if (!this.api || !this.isInstalled()) {
      throw new Error("Ecko Wallet is not installed");
    }
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    await this.api.request({
      method: "kda_disconnect",
      networkId,
    });
  }

  async getNetwork(): Promise<WalletNetwork> {
    if (!this.api || !this.isInstalled()) {
      throw new Error("Ecko Wallet is not installed");
    }
    const result = await this.api.request<WalletNetwork>({
      method: "kda_getNetwork",
    });
    return result;
  }

  private async checkStatus(networkId?: string) {
    if (!this.api || !this.isInstalled()) {
      throw new Error("Ecko Wallet is not installed");
    }
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<ConnectResponse>({
      method: "kda_checkStatus",
      networkId,
    });
    if ("fail" === res.status) {
      throw new Error(res.message);
    }
    return res.account;
  }
}
