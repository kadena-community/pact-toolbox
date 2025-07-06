import type { SignedTransaction } from "../pact";

/**
 * Minimal Chainweb client interface for DI
 * The actual implementation will have many more methods
 */
export interface IChainwebClient {
  /**
   * Send transactions to chainweb
   * @param transactions - Array of signed transactions
   * @param config - Optional request configuration
   */
  send(transactions: SignedTransaction[], config?: any): Promise<any>;
  
  /**
   * Execute a local Pact command
   * @param command - The command to execute locally
   * @param config - Optional request configuration
   */
  local(command: any, config?: any): Promise<any>;
  
  /**
   * Listen for a single transaction result
   * @param requestKey - Transaction request key to listen for
   * @param config - Optional request configuration
   */
  listen(requestKey: string, config?: any): Promise<any>;
  
  /**
   * Poll for transaction results
   * @param requestKeys - Transaction request keys to poll
   * @param config - Optional request configuration
   */
  poll(requestKeys: string[], config?: any): Promise<any>;
}