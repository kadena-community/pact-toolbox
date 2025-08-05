import type {
  LocalPactTransactionResult,
  PactTransactionDescriptor,
  PactTransactionResult,
  PactValue,
  SignedTransaction,
  Transaction,
} from "@pact-toolbox/types";
import { finalizeTransaction, isFullySignedTransaction } from "@pact-toolbox/signers";
import { ChainwebClient } from "./client";
import type { LocalResult, NetworkConfig, TransactionResult } from "./types";

/**
 * Interface defining helper methods for the Chainweb client.
 */
export interface ChainwebClientHelpers {
  dirtyReadOrFail<T>(tx: Transaction | Transaction[]): Promise<T | T[]>;
  localOrFail<T>(tx: Transaction | Transaction[]): Promise<T | T[]>;
  submitAndListen<T>(signedTx: Transaction | Transaction[]): Promise<T | T[]>;
}

export type Client = ChainwebClient | (() => ChainwebClient);

/**
 * Retrieves the Chainweb client instance, resolving it if it's a factory function.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @returns The resolved Chainweb client instance.
 */
export function getClient(client: Client): ChainwebClient {
  return "function" === typeof client ? client() : client;
}

/**
 * Extracts transaction data or throws an error if the transaction failed.
 * @param response - The command result from the Chainweb client.
 * @returns The transaction data of type T.
 * @throws Error if the transaction status is "failure".
 */
export function getTxDataOrFail<T = PactValue>(
  response: PactTransactionResult | LocalPactTransactionResult | LocalResult | TransactionResult,
): T {
  if (response.result.status === "failure") {
    throw new Error(`Transaction failed with error:\n${JSON.stringify(response.result.error, undefined, 2)}`);
  }
  return response.result.data as T;
}

/**
 * Performs a dirty read operation using the Chainweb client and returns the transaction data.
 * Throws an error if any transaction fails.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The transaction data or an array of transaction data.
 */
export async function dirtyReadOrFail<T = PactValue>(
  client: Client,
  txs: Transaction | Transaction[],
): Promise<T | T[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getClient(client).local(finalizeTransaction(tx))));
  return 1 === transactions.length ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Performs a local operation using the Chainweb client and returns the transaction data.
 * Throws an error if any transaction fails.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The transaction data or an array of transaction data.
 */
export async function localOrFail<T = PactValue>(client: Client, txs: Transaction | Transaction[]): Promise<T | T[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getClient(client).local(finalizeTransaction(tx))));
  return 1 === transactions.length ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Performs a preflight check using the Chainweb client.
 * Throws an error if any preflight check fails.
 * Logs warnings if present.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The preflight command result or an array of command results.
 */
export async function preflight(
  client: Client,
  txs: Transaction | Transaction[],
): Promise<LocalResult | LocalResult[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getClient(client).local(finalizeTransaction(tx))));

  if (results.some((r: any) => "failure" === r.result.status)) {
    throw new Error("Preflight failed");
  }

  // TODO: Handle warnings
  // results.forEach((r) => {});

  return 1 === transactions.length ? results[0]! : results;
}

/**
 * Submits signed transactions using the Chainweb client.
 * Optionally performs a preflight check before submission.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param signedTxs - A single signed PactTransaction or an array of signed PactTransactions.
 * @param preflight - Whether to perform a preflight check before submission.
 * @returns The transaction descriptor or an array of transaction descriptors.
 * @throws Error if any transaction is not signed.
 */
export async function submit(
  client: Client,
  signedTxs: Transaction | Transaction[],
  preflightCheck: boolean = false,
): Promise<PactTransactionDescriptor | PactTransactionDescriptor[]> {
  const transactions = Array.isArray(signedTxs) ? signedTxs : [signedTxs];
  if (!transactions.every(isFullySignedTransaction)) {
    throw new Error("Not all transactions are signed");
  }

  if (preflightCheck) {
    await preflight(client, transactions);
  }

  const sendResult = await getClient(client)
    .send(transactions.map((tx) => finalizeTransaction(tx) as SignedTransaction))
    .catch((e: any) => {
      if (e instanceof AggregateError) {
        for (const err of e.errors) {
          console.log(err.message);
        }
      }
      console.log("submit failed", e);
      throw e;
    });

  // Convert SendResult to PactTransactionDescriptor format
  const descriptors = sendResult.requestKeys.map((requestKey: string, index: number) => ({
    requestKey,
    chainId: transactions[index]!.cmd ? JSON.parse(transactions[index]!.cmd).meta.chainId : "0",
    networkId: transactions[index]!.cmd ? JSON.parse(transactions[index]!.cmd).networkId : "development",
  }));

  return transactions.length === 1 ? descriptors[0]! : descriptors;
}

/**
 * Listens for transaction results using the Chainweb client.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param requests - A single transaction descriptor or an array of transaction descriptors.
 * @returns The transaction data or an array of transaction data.
 */
export async function listen<T>(
  client: Client,
  requests: PactTransactionDescriptor | PactTransactionDescriptor[],
): Promise<T | T[]> {
  const descriptors = Array.isArray(requests) ? requests : [requests];
  const results = await Promise.all(
    descriptors.map(async (req) => {
      const listenResult = await getClient(client).listen(req.requestKey);
      return listenResult.result;
    }),
  );
  return descriptors.length === 1 ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Submits signed transactions and listens for their results.
 * Optionally performs a preflight check before submission.
 * @param client - The Chainweb client or a factory function returning a Chainweb client.
 * @param signedTxs - A single signed PactTransaction or an array of signed PactTransactions.
 * @param preflight - Whether to perform a preflight check before submission.
 * @returns The transaction data or an array of transaction data.
 * @throws Error if any transaction is not signed.
 */
export async function submitAndListen<T>(
  client: Client,
  signedTxs: Transaction | Transaction[],
  preflight: boolean = false,
): Promise<T | T[]> {
  const transactions = Array.isArray(signedTxs) ? signedTxs : [signedTxs];

  if (!transactions.every(isFullySignedTransaction)) {
    throw new Error("Not all transactions are signed");
  }

  if (preflight) {
    await Promise.all(transactions.map((tx) => getClient(client).local(finalizeTransaction(tx))));
  }

  // For single transaction, use submitAndWait for simplicity
  if (transactions.length === 1) {
    const result = await getClient(client).submitAndWait(finalizeTransaction(transactions[0]!) as SignedTransaction);
    return getTxDataOrFail<T>(result);
  }

  // For multiple transactions, use batch processing
  const results = await getClient(client).submitBatch(
    transactions.map((tx) => finalizeTransaction(tx) as SignedTransaction),
  );

  if (results.failures.length > 0) {
    throw new Error(`Some transactions failed: ${results.failures.map((f) => f.error.message).join(", ")}`);
  }

  return results.successes.map(getTxDataOrFail) as T[];
}

/**
 * Create a client for mainnet
 */
export function createMainnetClient(config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "mainnet01",
    chainId: "0",
    rpcUrl: (networkId, chainId) => `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

/**
 * Create a client for testnet
 */
export function createTestnetClient(config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "testnet04",
    chainId: "0",
    rpcUrl: (networkId, chainId) =>
      `https://api.testnet.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

/**
 * Create a client for development/local network
 */
export function createDevnetClient(port: number, config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "development",
    chainId: "0",
    rpcUrl: (networkId, chainId) => `http://localhost:${port}/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

export function createPactServerClient(port: number, config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "development",
    chainId: "0",
    rpcUrl: () => `http://localhost:${port}/api/v1/local`,
    ...config,
  });
}
