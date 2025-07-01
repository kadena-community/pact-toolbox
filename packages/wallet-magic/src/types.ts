/**
 * Magic wallet types
 */

import type { ChainId } from "@pact-toolbox/types";

/**
 * Magic configuration options
 */
export interface MagicOptions {
  /** Magic API key (publishable key) */
  magicApiKey: string;
  /** Chainweb API URL */
  chainwebApiUrl?: string;
  /** Target chain ID */
  chainId?: ChainId;
  /** Network ID */
  networkId?: string;
  /** Enable account creation on chain */
  createAccountsOnChain?: boolean;
}

/**
 * Magic account structure from SpireKey
 */
export interface MagicSpireKeyAccount {
  /** Account name (usually r:format) */
  accountName: string;
  /** Network ID */
  networkId: string;
  /** Chain IDs where account exists */
  chainIds: ChainId[];
  /** Account keyset */
  keyset: {
    keys: string[];
    pred: string;
  };
  /** Account guard (may be keyset or custom) */
  guard?: unknown;
  /** Requested fungible contracts */
  requestedFungibles?: Array<{
    fungible: string;
    amount?: string;
  }>;
}

/**
 * Magic credential information
 */
export interface MagicCredential {
  /** Credential ID */
  id: string;
  /** Public key */
  publicKey: string;
  /** Credential type */
  type: string;
}

/**
 * Magic transaction for signing
 */
export interface MagicTransaction {
  /** Transaction command (JSON string) */
  cmd: string;
  /** Transaction hash */
  hash: string;
  /** Signatures array */
  sigs: Array<{
    sig?: string;
    pubKey: string;
  }>;
}

/**
 * Magic signing response
 */
export interface MagicSigningResponse {
  /** Array of signed transactions */
  transactions: Array<{
    cmd: string;
    hash: string;
    sigs: Array<{
      sig: string;
      pubKey?: string;
    }>;
  }>;
}

/**
 * Magic Kadena extension interface
 */
export interface MagicKadenaExtension {
  /** Login with SpireKey */
  loginWithSpireKey(): Promise<MagicSpireKeyAccount>;
  
  /** Sign transaction with SpireKey */
  signTransactionWithSpireKey(transaction: MagicTransaction): Promise<MagicSigningResponse>;
  
  /** Get account information */
  getAccount(): Promise<MagicSpireKeyAccount>;
  
  /** Check if user is logged in */
  isLoggedIn(): Promise<boolean>;
  
  /** Logout */
  logout(): Promise<void>;
}

/**
 * Magic SDK instance interface
 */
export interface MagicSDK {
  /** Kadena extension */
  kadena: MagicKadenaExtension;
  
  /** User module */
  user: {
    isLoggedIn(): Promise<boolean>;
    logout(): Promise<void>;
    getInfo(): Promise<Record<string, unknown>>;
  };
  
  /** Authentication module */
  auth: {
    loginWithMagicLink(params: { email: string }): Promise<string>;
    loginWithSMS(params: { phoneNumber: string }): Promise<string>;
  };
}

/**
 * Magic metadata
 */
export interface MagicMetadata {
  /** App name */
  name?: string;
  /** App description */
  description?: string;
  /** App URL */
  url?: string;
  /** App icon URLs */
  icons?: string[];
  /** App domain */
  domain?: string;
}

/**
 * Magic connection events
 */
export interface MagicEvents {
  /** User logged in */
  login: (account: MagicSpireKeyAccount) => void;
  /** User logged out */
  logout: () => void;
  /** Account changed */
  accountChanged: (account: MagicSpireKeyAccount) => void;
  /** Error occurred */
  error: (error: Error) => void;
}