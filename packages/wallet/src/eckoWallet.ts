import { createEckoWalletQuicksign, createEckoWalletSign } from '@kadena/client';

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

// eslint-disable-next-line @typescript-eslint/ban-types
export type SuccessResponse<T = {}> = {
  status: 'success';
  message: string;
} & T;

export interface GetNetworkResponse {
  explorer: string;
  id: string;
  isDefault: boolean;
  name: string;
  networkId: string;
  url: string;
}

export async function getNetwork() {
  const kadena = getWalletApi();
  const result = await kadena.request<GetNetworkResponse>({
    method: 'kda_getNetwork',
  });
  return result;
}

export function on<E extends WalletEvent>(event: E, callback: WalletEventHandlers[E]) {
  const kadena = getWalletApi();
  kadena.on(event, callback);
}

export function isXWalletInstalled() {
  const { kadena } = window;
  return Boolean(kadena && kadena.isKadena);
}

export function getWalletApi() {
  if (!isXWalletInstalled()) {
    throw new Error('EckoWallet not installed');
  }
  return window.kadena as WalletApi;
}

export type ConnectResponse =
  | FailedResponse
  | SuccessResponse<{
      account: Account;
    }>;
export async function connect() {
  const kadena = getWalletApi();
  const network = await getNetwork();
  const res = await kadena.request<ConnectResponse>({
    method: 'kda_connect',
    networkId: network.networkId,
  });
  if (res.status === 'fail') {
    throw new Error(res.message);
  }
  return res.account;
}

export async function getAccountOrFail() {
  const status = await isConnected();
  if (!status.isConnected || !status.account) {
    throw new Error('Not connected');
  }
  return status.account;
}

export async function isConnected() {
  try {
    const status = await checkStatus();
    return {
      isConnected: true,
      account: status,
    };
  } catch (e) {
    return {
      isConnected: false,
    };
  }
}

export async function disconnect() {
  const kadena = getWalletApi();
  const network = await getNetwork();
  const result = await kadena.request({
    method: 'kda_disconnect',
    networkId: network.networkId,
  });
  console.log(result);
  return result;
}

export interface Account {
  account: string;
  publicKey: string;
}

export async function checkStatus() {
  const kadena = getWalletApi();
  const network = await getNetwork();
  const res = await kadena.request<ConnectResponse>({
    method: 'kda_checkStatus',
    networkId: network.networkId,
  });
  if (res.status === 'fail') {
    throw new Error(res.message);
  }
  return res.account;
}

export interface Wallet extends Account {
  connectedSites: string[];
  balance: number;
}

export type RequestAccountResponse =
  | FailedResponse
  | SuccessResponse<{
      wallet: Wallet;
    }>;
export async function requestAccount() {
  const kadena = getWalletApi();
  const network = await getNetwork();
  const res = await kadena.request<RequestAccountResponse>({
    method: 'kda_requestAccount',
    networkId: network.networkId,
  });
  if (res.status === 'fail') {
    throw new Error(res.message);
  }
  return res.wallet;
}

export const sign = createEckoWalletSign();
export const quickSign = createEckoWalletQuicksign();
