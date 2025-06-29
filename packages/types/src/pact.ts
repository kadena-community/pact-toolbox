import type { PactValue } from "@kadena/types";

export type { PactValue } from "@kadena/types";

export type Serializable =
  | string
  | number
  | boolean
  | null
  | PactKeyset
  | Serializable[]
  | { [key: string]: Serializable };

export declare type ChainId =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19";

export interface PactKeyPair {
  publicKey: string;
  secretKey: string;
}

export type PactBuiltInPredicate = "keys-all" | "keys-any" | "keys-2";

export interface PactKeyset {
  keys: string[];
  pred: PactBuiltInPredicate | (string & {});
}

export type PactEnvData = Record<string, Serializable>;
export interface PactCapability {
  name: string;
  args: PactValue[];
}
export interface PactExec {
  code: string;
  data: PactEnvData;
}
export interface PactExecPayload {
  // executable pact code
  exec: PactExec;
}

export interface PactCont {
  pactId: string;
  step: number;
  rollback: boolean;
  data: PactEnvData;
  // for none cross-chain tx, proof is null
  proof?: string | null;
}

export interface PactContPayload {
  cont: PactCont;
}

export type PactCmdPayload = PactExecPayload | PactContPayload;

export type SignerScheme = "ED25519" | "ETH" | "WebAuthn";

export interface PactMetadata {
  chainId: ChainId;
  sender?: string;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
  creationTime?: number;
}

export interface PactSigner {
  pubKey: string;
  address?: string;
  scheme?: SignerScheme;
  clist?: PactCapability[];
}

export interface PactVerifier {
  name: string;
  proof: PactValue;
  clist?: PactCapability[];
}

export interface PactCommand<Payload extends PactCmdPayload = PactExecPayload> {
  payload: Payload;
  meta: PactMetadata;
  signers: PactSigner[];
  verifiers?: PactVerifier[];
  networkId: string;
  nonce: string;
}

export interface TransactionFullSig {
  sig: string;
  pubKey?: string;
}
export interface TransactionPartialSig {
  pubKey: string;
  sig?: string;
}

export type TransactionSig = TransactionFullSig | TransactionPartialSig;
export interface PartiallySignedTransaction {
  cmd: string;
  hash: Uint8Array | string;
  sigs: TransactionSig[];
}

export declare interface SignedTransaction {
  cmd: string;
  hash: string;
  sigs: TransactionFullSig[];
}

export type Transaction = PartiallySignedTransaction | SignedTransaction;

export interface PactTransactionResultSuccess {
  status: "success";
  data: PactValue;
}

export interface PactTransactionResultError {
  status: "failure";
  error: object;
}

/**
 * Describes result of a defpact execution.
 *
 */
export interface PactContinuationResult {
  /**
   * Identifies this defpact execution. Generated after the first step and matches the request key of the transaction.
   */
  pactId: string;
  /**
   *  Identifies which step executed in defpact.
   */
  step: number;
  /**
   *  Total number of steps in pact.
   */
  stepCount: number;
  /**
   *  Optional value for private pacts, indicates if step was skipped.
   */
  executed: boolean | null;
  /**
   *  Indicates if pact step has rollback.
   */
  stepHasRollback: boolean;
  /**
   *  Closure describing executed pact.
   */
  continuation: {
    /**
     *  Fully-qualified defpact name.
     */
    def: string;
    /**
     *  Arguments used with defpact.
     */
    args: PactValue;
  };
  /**
   *  Value yielded during pact step, optionally indicating cross-chain execution.
   * @alpha
   */
  yield: {
    /**
     *  Pact value object containing yielded data.
     */
    data: Array<[string, PactValue]>;
    /**
     *  yield.provenance
     */
    provenance: {
      /**
       * Chain ID of target chain for next step.
       */
      targetChainId: ChainId;
      /**
       * Hash of module executing defpact.
       */
      moduleHash: string;
    } | null;
  } | null;
}

/**
 * Events emitted during Pact execution.
 *
 * @param name - Event defcap name.
 * @param module - Qualified module name of event defcap.
 * @param params - defcap arguments.
 * @param moduleHash - Hash of emitting module.
 *
 * @alpha
 */
export declare interface PactEvent {
  name: string;
  module: {
    name: string;
    namespace: string | null;
  };
  params: Array<PactValue>;
  moduleHash: string;
}

/**
 * Platform-specific information on the block that executed a transaction.
 *
 * @param blockHash - Block hash of the block containing the transaction.
 * @param blockTime - POSIX time when the block was mined.
 * @param blockHeight - Block height of the block.
 * @param prevBlockHash - Parent Block hash of the containing block.
 * @param publicMeta - Platform-specific data provided by the request.
 *
 *
 */
declare interface ChainwebResponseMetaData {
  blockHash: string;
  blockTime: number;
  blockHeight: number;
  prevBlockHash: string;
  publicMeta?: PactMetadata;
}

export interface PactTransactionResult {
  reqKey: string;
  txId: number | null;
  result: PactTransactionResultSuccess | PactTransactionResultError;
  gas: number;
  logs: string | null;
  continuation: PactContinuationResult | null;
  metaData: ChainwebResponseMetaData | null;
  events?: PactEvent[];
}
export interface PactTransactionDescriptor {
  requestKey: string;
  chainId: ChainId;
  networkId: string;
}
export interface LocalPactTransactionResult extends PactTransactionResult {
  preflightWarnings?: string[];
}

/**
 * Interface to use when writing a signing function that accepts a single transaction
 */
export interface SignFunction {
  (tx: PartiallySignedTransaction): Promise<Transaction>;
}
/**
 * Interface to use when writing a signing function that accepts multiple transactions
 */
export interface QuickSignFunction {
  (tx: PartiallySignedTransaction): Promise<Transaction>;
  (txs: PartiallySignedTransaction[]): Promise<Transaction[]>;
}

export interface WalletApiLike {
  sign: SignFunction;
  quickSign?: QuickSignFunction;
  getSigner: (networkId?: string) => Promise<{
    publicKey: string;
    address: string;
  }>;
}

export type PactSignerLike = string | PactSigner;
export type PactCapabilityLike = (
  withCapability: (name: string, ...args: PactValue[]) => PactCapability,
) => PactCapability[];
