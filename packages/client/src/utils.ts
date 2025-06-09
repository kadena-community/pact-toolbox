import type {
  KeyPair,
  LocalPactTransactionResult,
  PactCapability,
  PactCapabilityLike,
  PactCmdPayload,
  PactCommand,
  PactContPayload,
  PactExecPayload,
  PactMetadata,
  PactSignerLike,
  PactTransactionDescriptor,
  PactTransactionResult,
  PactValue,
  PartiallySignedTransaction,
  SerializableNetworkConfig,
  Transaction,
  WalletLike,
} from "@pact-toolbox/types";

import {
  type KeyPairSigner,
  createKeyPairSignerFromBase16PrivateKey,
  finalizeTransaction,
  isFullySignedTransaction,
} from "@pact-toolbox/signers";

import { type IClient, createClient } from "@kadena/client";
import { blake2bBase64Url, fastStableStringify, genKeyPair } from "@pact-toolbox/crypto";

/**
 * Interface defining helper methods for the KDA client.
 */
interface KdaClientHelpers {
  dirtyReadOrFail<T>(tx: Transaction | Transaction[]): Promise<T | T[]>;
  localOrFail<T>(tx: Transaction | Transaction[]): Promise<T | T[]>;
  submitAndListen<T>(signedTx: Transaction | Transaction[]): Promise<T | T[]>;
}

/**
 * Internal preflight function to avoid naming conflicts.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param transactions - An array of PactTransactions.
 */
function preflightFunction(
  client: KdaClient,
  transactions: Transaction[],
): Promise<LocalPactTransactionResult | PactTransactionResult[]> {
  return preflight(client, transactions);
}

/**
 * Extracts transaction data or throws an error if the transaction failed.
 * @param response - The command result from the KDA client.
 * @returns The transaction data of type T.
 * @throws Error if the transaction status is "failure".
 */
export function getTxDataOrFail<T = PactValue>(response: PactTransactionResult | LocalPactTransactionResult): T {
  if (response.result.status === "failure") {
    throw new Error(`Transaction failed with error:\n${JSON.stringify(response.result.error, undefined, 2)}`);
  }
  return response.result.data as T;
}

export type KdaClient = IClient | (() => IClient);

/**
 * Retrieves the KDA client instance, resolving it if it's a factory function.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @returns The resolved KDA client instance.
 */
export function getKdaClient(client: KdaClient): IClient {
  return "function" === typeof client ? client() : client;
}

/**
 * Performs a dirty read operation using the KDA client and returns the transaction data.
 * Throws an error if any transaction fails.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The transaction data or an array of transaction data.
 */
export async function dirtyReadOrFail<T = PactValue>(
  client: KdaClient,
  txs: Transaction | Transaction[],
): Promise<T | T[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getKdaClient(client).dirtyRead(finalizeTransaction(tx))));
  return 1 === transactions.length ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Performs a local operation using the KDA client and returns the transaction data.
 * Throws an error if any transaction fails.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The transaction data or an array of transaction data.
 */
export async function localOrFail<T = PactValue>(
  client: KdaClient,
  txs: Transaction | Transaction[],
): Promise<T | T[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getKdaClient(client).local(finalizeTransaction(tx))));
  return 1 === transactions.length ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Performs a preflight check using the KDA client.
 * Throws an error if any preflight check fails.
 * Logs warnings if present.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param txs - A single PactTransaction or an array of PactTransactions.
 * @returns The preflight command result or an array of command results.
 */
export async function preflight(
  client: KdaClient,
  txs: Transaction | Transaction[],
): Promise<LocalPactTransactionResult | PactTransactionResult[]> {
  const transactions = Array.isArray(txs) ? txs : [txs];
  const results = await Promise.all(transactions.map((tx) => getKdaClient(client).preflight(finalizeTransaction(tx))));

  if (results.some((r) => "failure" === r.result.status)) {
    throw new Error("Preflight failed");
  }

  // results.forEach((r) => {});

  return 1 === transactions.length ? results[0]! : results;
}

/**
 * Submits signed transactions using the KDA client.
 * Optionally performs a preflight check before submission.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param signedTxs - A single signed PactTransaction or an array of signed PactTransactions.
 * @param preflight - Whether to perform a preflight check before submission.
 * @returns The transaction descriptor or an array of transaction descriptors.
 * @throws Error if any transaction is not signed.
 */
export async function submit(
  client: KdaClient,
  signedTxs: Transaction | Transaction[],
  preflight: boolean = false,
): Promise<PactTransactionDescriptor | PactTransactionDescriptor[]> {
  const transactions = Array.isArray(signedTxs) ? signedTxs : [signedTxs];
  if (!transactions.every(isFullySignedTransaction)) {
    throw new Error("Not all transactions are signed");
  }

  if (preflight) {
    await preflightFunction(client, transactions);
  }
  const descriptors = await getKdaClient(client)
    .submit(transactions)
    .catch((e) => {
      if (e instanceof AggregateError) {
        for (const err of e.errors) {
          console.log(err.message);
        }
      }
      console.log("submit failed", e);
      throw e;
    });
  return transactions.length === 1 ? descriptors[0]! : descriptors;
}

/**
 * Listens for transaction results using the KDA client.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param requests - A single transaction descriptor or an array of transaction descriptors.
 * @returns The transaction data or an array of transaction data.
 */
export async function listen<T>(
  client: KdaClient,
  requests: PactTransactionDescriptor | PactTransactionDescriptor[],
): Promise<T | T[]> {
  const descriptors = Array.isArray(requests) ? requests : [requests];
  const results = await Promise.all(descriptors.map((req) => getKdaClient(client).listen(req)));
  return descriptors.length === 1 ? getTxDataOrFail<T>(results[0]!) : (results.map(getTxDataOrFail) as T[]);
}

/**
 * Submits signed transactions and listens for their results.
 * Optionally performs a preflight check before submission.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @param signedTxs - A single signed PactTransaction or an array of signed PactTransactions.
 * @param preflight - Whether to perform a preflight check before submission.
 * @returns The transaction data or an array of transaction data.
 * @throws Error if any transaction is not signed.
 */
export async function submitAndListen<T>(
  client: KdaClient,
  signedTxs: Transaction | Transaction[],
  preflight: boolean = false,
  sequence: boolean = true,
): Promise<T | T[]> {
  if (sequence) {
    const txs = Array.isArray(signedTxs) ? signedTxs : [signedTxs];
    let result: T | T[] = [];
    for (const tx of txs) {
      const descriptor = await submit(client, tx, preflight);
      result = await listen(client, descriptor);
    }
    return result;
  }
  const descriptors = await submit(client, signedTxs, preflight);
  return listen(client, descriptors);
}

/**
 * Creates helper functions bound to a specific KDA client.
 * @param client - The KDA client or a factory function returning a KDA client.
 * @returns An object containing helper methods.
 */
export function createKdaClientHelpers(client: KdaClient): KdaClientHelpers {
  return {
    dirtyReadOrFail: (tx) => dirtyReadOrFail(client, tx),
    localOrFail: (tx) => localOrFail(client, tx),
    submitAndListen: (tx) => submitAndListen(client, tx),
  };
}

/**
 * Retrieves the account key from an account string.
 * @param account - The account string, possibly prefixed with "k:".
 * @returns The account key without the "k:" prefix.
 */
export function getKAccountKey(account: string): string {
  return account.startsWith("k:") ? account.slice(2) : account;
}

/**
 * Generates a new K-account with a key pair.
 * @returns An object containing the public key, secret key, and account string.
 */
export async function generateKAccount(): Promise<{
  publicKey: string;
  secretKey: string;
  account: string;
}> {
  const { publicKey, privateKey: secretKey } = await genKeyPair();
  return {
    publicKey,
    secretKey,
    account: `k:${publicKey}`,
  };
}

/**
 * Generates multiple K-accounts.
 * @param count - The number of K-accounts to generate (default is 10).
 * @returns An array of objects each containing the public key, secret key, and account string.
 */
export async function generateKAccounts(count: number = 10): Promise<
  {
    publicKey: string;
    secretKey: string;
    account: string;
  }[]
> {
  return Promise.all(Array.from({ length: count }, () => generateKAccount()));
}

/**
 * Creates a Pact decimal value.
 * @param amount - The amount as a string or number.
 * @returns An object containing the decimal string.
 */
export function pactDecimal(amount: string | number): {
  decimal: string;
} {
  return {
    decimal: "string" === typeof amount ? amount : amount.toFixed(12),
  };
}

/**
 * Checks if an object is WalletLike.
 * @param wallet - The object to check.
 * @returns True if the object is WalletLike, false otherwise.
 */
export function isWalletLike(wallet: unknown): wallet is WalletLike {
  if ("object" === typeof wallet && null !== wallet) {
    return "sign" in wallet || "quickSign" in wallet;
  }
  return "function" === typeof wallet;
}

export function isToolboxInstalled(): boolean {
  return !!(globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__;
}

export function getToolboxGlobalNetworkConfig(strict?: boolean): SerializableNetworkConfig {
  if (!isToolboxInstalled() && strict) {
    throw new Error("Make sure you are using the pact-toolbox bundler plugin, eg `@pact-toolbox/unplugin`");
  }
  const config = (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__;
  if ("string" === typeof config) {
    try {
      return JSON.parse(config);
    } catch {
      throw new Error("Found invalid network config in globalThis");
    }
  }
  return (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__;
}

export function getSignerKeys(network: SerializableNetworkConfig, signer?: string): KeyPair {
  signer = signer || network.senderAccount || "sender00";
  const signerAccount = network.keyPairs.find((s) => s.account === signer);
  if (!signerAccount) {
    throw new Error(`Signer ${signer} not found in network config`);
  }
  return signerAccount;
}

export interface PactTransactionBuilderLike {
  setMeta?(meta: Partial<PactMetadata>): this;
  setNetworkId?(networkId: string): this;
  withMeta?(meta: Partial<PactMetadata>): this;
  withNetworkId?(networkId: string): this;
}
export function addDefaultMeta<T extends PactTransactionBuilderLike>(
  network: SerializableNetworkConfig,
  builder: T,
): T {
  if (builder.withMeta) {
    builder.withMeta(network.meta) as T;
  }
  if (builder.withNetworkId) {
    return builder.withNetworkId(network.networkId) as T;
  }
  if (builder.setMeta) {
    builder.setMeta(network.meta) as T;
  }
  if (builder.setNetworkId) {
    return builder.setNetworkId(network.networkId) as T;
  }
  return builder;
}

export function createKadenaClient(netWorkConfig: SerializableNetworkConfig): IClient {
  return createClient(({ networkId = netWorkConfig.networkId, chainId = netWorkConfig.meta.chainId }) =>
    netWorkConfig.rpcUrl.replaceAll(/{networkId}|{chainId}/g, (match: string) =>
      "{networkId}" === match ? networkId : chainId,
    ),
  );
}

export function createKeyPairSigner(networkConfig: SerializableNetworkConfig, signer?: string): Promise<KeyPairSigner> {
  const signerAccount = getSignerKeys(networkConfig, signer);
  return createKeyPairSignerFromBase16PrivateKey(signerAccount.secretKey);
}

export function isPactExecPayload(payload: PactCmdPayload): payload is PactExecPayload {
  return "exec" in payload;
}

export function isPactContPayload(payload: PactCmdPayload): payload is PactContPayload {
  return "cont" in payload;
}

export function createPactCommandWithDefaults<Payload extends PactCmdPayload>(
  payload: Payload,
  networkConfig: SerializableNetworkConfig,
): PactCommand<Payload> {
  return {
    payload,
    meta: networkConfig.meta,
    signers: [],
    networkId: networkConfig.networkId,
    nonce: "",
  };
}

export function createTransaction<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
): PartiallySignedTransaction {
  const defaultMeta = {
    gasLimit: 150000,
    gasPrice: 1e-8,
    sender: "",
    ttl: 15 * 60, // 15 minutes,
    creationTime: Math.floor(Date.now() / 1000),
  };

  cmd.nonce = `pact-toolbox:nonce:${Date.now()}`;
  cmd.signers = cmd.signers ?? [];
  cmd.meta = { ...defaultMeta, ...cmd.meta };
  if (cmd.payload && "cont" in cmd.payload) {
    cmd.payload.cont.proof ??= null;
  }
  const cmdStr = fastStableStringify(cmd);
  const tx: PartiallySignedTransaction = {
    cmd: cmdStr,
    hash: blake2bBase64Url(cmdStr),
    sigs: Array.from({
      length: cmd.signers.length ?? 0,
    }),
  };
  return tx;
}

export function updatePactCommandSigners<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
  signer: PactSignerLike | PactSignerLike[],
  capability?: PactCapabilityLike,
): PactCommand<Payload> {
  const signers = Array.isArray(signer) ? signer : [signer];
  let clist: PactCapability[] | undefined;
  if ("function" === typeof capability) {
    clist = capability((name: string, ...args: PactValue[]) => ({
      name,
      args,
    }));
  }

  if (!cmd.signers) {
    cmd.signers = [];
  }

  for (const item of signers) {
    const newSigner = "object" === typeof item ? item : { pubKey: item };
    const existingSigner = cmd.signers.find((s) => s?.pubKey === newSigner?.pubKey);
    if (existingSigner) {
      existingSigner.clist = clist;
    } else {
      cmd.signers.push({
        clist,
        scheme: "ED25519",
        ...newSigner,
      });
    }
  }
  return cmd;
}
export async function signPactCommandWithWalletLike<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
  walletLike: WalletLike,
  quickSign?: boolean,
): Promise<Transaction> {
  if (cmd.signers.length === 0 && "object" === typeof walletLike && "function" === typeof walletLike.getSigner) {
    // console.warn("No signers provided using wallet default");
    const signer = await walletLike.getSigner();
    cmd = updatePactCommandSigners(cmd, signer.publicKey, (signFor) => [signFor("coin.GAS")]);
    cmd.meta.sender = signer.address;
  }
  const tx = createTransaction(cmd);
  if ("function" === typeof walletLike) {
    return walletLike(tx);
  }
  if ("function" === typeof walletLike.quickSign && quickSign) {
    return walletLike.quickSign(tx);
  }
  if ("function" === typeof walletLike.sign) {
    return walletLike.sign(tx);
  }
  throw new Error("WalletLike does not have a sign function");
}
