/**
 * Transaction options interface
 */
export interface ITransactionOptions {
  /** Gas limit override */
  gasLimit?: number;
  
  /** Gas price override */
  gasPrice?: number;
  
  /** Time to live override */
  ttl?: number;
  
  /** Sender account override */
  senderAccount?: string;
  
  /** Additional options */
  [key: string]: any;
}

/**
 * Transaction defaults interface
 */
export interface ITransactionDefaults {
  /** Network ID for transactions */
  networkId?: string;
  
  /** Chain ID for transactions */
  chainId?: string;
  
  /** Gas limit for transactions */
  gasLimit?: number;
  
  /** Gas price for transactions */
  gasPrice?: number;
  
  /** Time to live (TTL) for transactions */
  ttl?: number;
}