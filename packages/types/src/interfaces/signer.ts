import type { ITransactionOptions } from "./transaction";
import type { KeyPair } from "../config";

/**
 * Signer interface for signing transactions
 */
export interface ISigner {
  /**
   * Sign a transaction
   * @param transaction - The transaction to sign
   * @param options - Transaction options
   */
  sign(transaction: any, options?: ITransactionOptions): Promise<any>;
  
  /**
   * Get signer public keys
   */
  getKeys(): string[];
}

/**
 * Signer resolver interface for resolving signers
 */
export interface ISignerResolver {
  /**
   * Get the default signer
   */
  getDefaultSigner(): ISigner | null;
  
  /**
   * Get signer keys for a specific account
   * @param account - The account name
   */
  getSignerKeys(account?: string): string[];
  
  /**
   * Create a signer from keypairs
   * @param keypairs - Array of keypairs
   */
  createSigner(keypairs: KeyPair[]): ISigner;
}

/**
 * Signer provider interface for providing signers
 */
export interface ISignerProvider {
  /**
   * Get a signer for an account
   * @param account - The account name
   */
  getSigner(account: string): Promise<ISigner | null>;
  
  /**
   * List available accounts
   */
  listAccounts(): Promise<string[]>;
}