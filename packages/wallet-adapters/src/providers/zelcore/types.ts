/**
 * Zelcore wallet types
 */

import type { ChainId } from "@pact-toolbox/types";

/**
 * Zelcore account response
 */
export interface ZelcoreAccountsResponse {
  data: string[]; // Array of accounts like ["k:pubkey", "pubkey"]
  status: string;
}

/**
 * Zelcore sign request
 */
export interface ZelcoreSignRequest {
  signingPubKey: string;
  networkId: string;
  [key: string]: unknown; // Include all signing command fields
}

/**
 * Zelcore sign response
 */
export interface ZelcoreSignResponse {
  body: {
    cmd: string;
    hash: string;
    sigs: Array<{
      sig: string;
    }>;
  };
}

/**
 * Zelcore connection options
 */
export interface ZelcoreConnectionOptions {
  networkId?: string;
  accountName: string;
  chainIds: ChainId[];
  tokenContract?: string;
}

/**
 * Zelcore error response
 */
export interface ZelcoreErrorResponse {
  status: string;
  error?: string;
  message?: string;
}