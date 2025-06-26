/**
 * Chainweaver wallet types
 */

import type { ChainId } from "@pact-toolbox/types";

/**
 * Chainweaver sign request
 */
export interface ChainweaverSignRequest {
  cmd: string;
}

/**
 * Chainweaver sign response
 */
export interface ChainweaverSignResponse {
  body: {
    cmd: string;
    hash: string;
    sigs: Array<{
      sig: string;
    }>;
  };
  chainId?: ChainId;
}

/**
 * Chainweaver quicksign request
 */
export interface ChainweaverQuicksignRequest {
  cmdSigDatas: Array<{
    cmd: string;
    sigs: Array<{
      pubKey: string;
      sig: string | null;
    }>;
  }>;
}

/**
 * Chainweaver quicksign response
 */
export interface ChainweaverQuicksignResponse {
  responses: Array<{
    commandSigData: {
      cmd: string;
      sigs: Array<{
        pubKey: string;
        sig: string;
      }>;
    };
    outcome: {
      result: "success" | "failure" | "noSig";
      hash?: string;
      msg?: string;
    };
  }>;
}

/**
 * Chainweaver error response
 */
export interface ChainweaverErrorResponse {
  type: "reject" | "emptyList" | "other";
  msg?: string;
}

/**
 * Chainweaver connection options
 */
export interface ChainweaverConnectionOptions {
  networkId?: string;
  accountName: string;
  chainIds: ChainId[];
  tokenContract?: string;
}