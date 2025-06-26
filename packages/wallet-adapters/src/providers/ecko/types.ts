/**
 * Ecko wallet types based on the actual Ecko Wallet API
 */

export interface EckoAccount {
  account: string;
  publicKey: string;
  connectedSites: string[];
}

export interface EckoNetwork {
  networkId: string;
  name: string;
  url: string;
  explorerUrl?: string;
}

export interface EckoSignRequest {
  cmd: string;
}

export interface EckoSignResponse {
  signedCmd: {
    cmd: string;
    sigs: Array<{
      sig: string;
    }>;
    hash: string;
  };
}

export interface EckoQuickSignRequest {
  cmdSigDatas: Array<{
    cmd: string;
    sigs: Array<{
      pubKey: string;
      sig: string | null;
    }>;
  }>;
}

export interface EckoQuickSignResponse {
  status?: "success" | "fail";
  responses?: Array<{
    commandSigData: {
      cmd: string;
      sigs: Array<{
        pubKey: string;
        sig: string;
      }>;
    };
    outcome: {
      result: "success" | "failure";
      hash?: string;
      msg?: string;
    };
  }>;
  quickSignData?: Array<{
    commandSigData: {
      cmd: string;
      sigs: Array<{
        pubKey: string;
        sig: string;
      }>;
    };
    outcome: {
      result: "success" | "failure";
      hash?: string;
      msg?: string;
    };
  }>;
  quickSignError?: string;
  error?: string;
}

/**
 * Ecko account response from kda_requestAccount
 */
export interface EckoAccountResponse {
  wallet: {
    account: string;
    publicKey: string;
    connectedSites?: string[];
    balance?: number;
  };
}

/**
 * Ecko network response from kda_getNetwork
 */
export interface EckoNetworkResponse {
  networkId: string;
  name: string;
  url: string;
  explorerUrl?: string;
}

/**
 * Ecko status response from kda_checkStatus
 */
export interface EckoStatusResponse {
  status: "success" | "fail";
}

export interface EckoSendKadenaParams {
  networkId: string;
  account: string;
  sourceChainId: string;
  chainId: string;
  amount: string;
}

/**
 * Ecko wallet window interface
 */
export interface EckoWallet {
  isInstalled: () => boolean;
  isConnected: (networkId?: string) => Promise<boolean>;
  connect: (networkId?: string) => Promise<void>;
  disconnect: (networkId?: string) => Promise<void>;
  getAccount: (networkId?: string) => Promise<EckoAccount>;
  getNetwork: () => Promise<EckoNetwork>;
  sign: (signRequest: EckoSignRequest) => Promise<EckoSignResponse>;
  quickSign: (quickSignRequest: EckoQuickSignRequest) => Promise<EckoQuickSignResponse>;
  sendKadena: (params: EckoSendKadenaParams) => Promise<unknown>;
}

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