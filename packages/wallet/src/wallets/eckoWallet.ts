import { createEckoWalletQuicksign, createEckoWalletSign } from '@kadena/client';
import { WalletAccount, WalletNetwork, WalletProvider, WalletSigner } from '../provider';

export interface WalletRequest {
  method: string;
  networkId?: string;
  data?: unknown;
}

export type WalletEvent = 'res_accountChange' | 'kda_checkStatus';
export type AccountChangeEvent = SuccessResponse;
export type WalletEventHandlers = {
  res_accountChange: (event: AccountChangeEvent) => void;
  kda_checkStatus: (event: unknown) => void;
};

export interface WalletApi {
  isKadena: boolean;
  request<T = unknown>(request: WalletRequest): Promise<T>;
  on<E extends WalletEvent>(event: string, callback: WalletEventHandlers[E]): void;
}

export interface FailedResponse {
  status: 'fail';
  message: string;
}

export type SuccessResponse<T = {}> = {
  status: 'success';
  message: string;
} & T;

export type ConnectResponse =
  | FailedResponse
  | SuccessResponse<{
      account: WalletSigner;
    }>;

export type RequestAccountResponse =
  | FailedResponse
  | SuccessResponse<{
      wallet: WalletAccount;
    }>;

export class EckoWalletProvider implements WalletProvider {
  private api: WalletApi;
  public sign = createEckoWalletSign();
  public quickSign = createEckoWalletQuicksign();

  constructor() {
    if (!this.isInstalled()) {
      throw new Error('EckoWallet not installed');
    }
    this.api = window.kadena as WalletApi;
  }

  on<E extends WalletEvent>(event: E, callback: WalletEventHandlers[E]) {
    this.api.on(event, callback);
  }

  isInstalled() {
    const { kadena } = window;
    return Boolean(kadena && kadena.isKadena);
  }

  async connect(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<ConnectResponse>({
      method: 'kda_connect',
      networkId,
    });
    if (res.status === 'fail') {
      throw new Error(res.message);
    }
    return res.account;
  }

  async getSigner(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    return this.checkStatus(networkId);
  }

  async getAccountDetails(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<RequestAccountResponse>({
      method: 'kda_requestAccount',
      networkId,
    });
    if (res.status === 'fail') {
      throw new Error(res.message);
    }
    return res.wallet;
  }

  async isConnected() {
    try {
      await this.checkStatus();
      return true;
    } catch (e) {
      return false;
    }
  }

  async disconnect(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    await this.api.request({
      method: 'kda_disconnect',
      networkId,
    });
  }

  async getNetwork() {
    const result = await this.api.request<WalletNetwork>({
      method: 'kda_getNetwork',
    });
    return result;
  }

  private async checkStatus(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const res = await this.api.request<ConnectResponse>({
      method: 'kda_checkStatus',
      networkId,
    });
    if (res.status === 'fail') {
      throw new Error(res.message);
    }
    return res.account;
  }
}
