import type { ITransactionDescriptor } from "@kadena/client";
import type {
  ChainId,
  PactCapability,
  PactCapabilityLike,
  PactCmdPayload,
  PactCommand,
  PactCont,
  PactContPayload,
  PactExecPayload,
  PactKeyset,
  PactMetadata,
  PactSignerLike,
  PactValue,
  PactVerifier,
  PartiallySignedTransaction,
  Serializable,
  SerializableNetworkConfig,
  Transaction,
  WalletLike,
} from "@pact-toolbox/types";

import { blake2bBase64Url } from "@pact-toolbox/crypto";

import type { KdaClient } from "./utils";
import { ALL_CHAINS } from "./constant";
import { createToolboxNetworkContext, ToolboxNetworkContext } from "./network";
import { dirtyReadOrFail, localOrFail, submit, submitAndListen } from "./utils";

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
    gasLimit: 2500,
    gasPrice: 1.0e-8,
    sender: "",
    ttl: 8 * 60 * 60, // 8 hours,
    creationTime: Math.floor(Date.now() / 1000),
  };
  const dateInMs = Date.now();
  cmd.nonce = cmd.nonce || `pact-toolbox:nonce:${dateInMs}`;
  cmd.signers = cmd.signers ?? [];
  cmd.meta = { ...defaultMeta, ...cmd.meta };
  const cmdStr = JSON.stringify(cmd);
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
  if (typeof capability === "function") {
    clist = capability((name: string, ...args: PactValue[]) => ({
      name,
      args,
    }));
  }

  if (!cmd.signers) {
    cmd.signers = [];
  }

  for (const item of signers) {
    const newSigner = typeof item === "object" ? item : { pubKey: item };
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
  if (cmd.signers.length === 0 && typeof walletLike === "object" && typeof walletLike.getSigner === "function") {
    // console.warn("No signers provided using wallet default");
    const signer = await walletLike.getSigner();
    cmd = updatePactCommandSigners(cmd, signer.publicKey, (signFor) => [signFor("coin.GAS")]);
    cmd.meta.sender = signer.address;
  }
  const tx = createTransaction(cmd);
  if (typeof walletLike === "function") {
    return walletLike(tx);
  }
  if (typeof walletLike.quickSign === "function" && quickSign) {
    return walletLike.quickSign(tx);
  }
  if (typeof walletLike.sign === "function") {
    return walletLike.sign(tx);
  }
  throw new Error("WalletLike does not have a sign function");
}
export class PactTransactionBuilder<Payload extends PactCmdPayload, Result = unknown> {
  #cmd: PactCommand<Payload>;
  #context: ToolboxNetworkContext;
  #builder: (cmd: PactCommand<Payload>) => Promise<Transaction> = async (cmd) => createTransaction(cmd);

  constructor(payload: Payload, context?: ToolboxNetworkContext) {
    this.#context = context ?? createToolboxNetworkContext();
    this.#cmd = createPactCommandWithDefaults(payload, this.#context.getNetworkConfig());
  }

  withData(key: string, value: Serializable): this {
    if (isPactExecPayload(this.#cmd.payload)) {
      this.#cmd.payload.exec.data[key] = value;
    } else {
      this.#cmd.payload.cont.data[key] = value;
    }
    return this;
  }

  withDataMap(data: Record<string, Serializable>): this {
    for (const [key, value] of Object.entries(data)) {
      this.withData(key, value);
    }
    return this;
  }

  withKeyset(name: string, keyset: PactKeyset): this {
    if (!this.#cmd.meta.sender) {
      throw new Error("Sender account is not set");
    }
    this.withData(name, keyset);
    return this;
  }

  withKeysetMap(keysets: Record<string, PactKeyset>): this {
    for (const [name, keyset] of Object.entries(keysets)) {
      this.withKeyset(name, keyset);
    }
    return this;
  }

  withChainId(chainId: ChainId): this {
    this.#cmd.meta.chainId = chainId;
    return this;
  }

  withMeta(meta: Partial<PactMetadata>): this {
    this.#cmd.meta = { ...this.#cmd.meta, ...meta };
    return this;
  }

  withSigner(signer: PactSignerLike | PactSignerLike[], capability?: PactCapabilityLike): this {
    this.#cmd = updatePactCommandSigners(this.#cmd, signer, capability);
    return this;
  }

  withVerifier(verifier: PactVerifier): this {
    if (!this.#cmd.verifiers) {
      this.#cmd.verifiers = [];
    }
    this.#cmd.verifiers.push(verifier);
    return this;
  }

  withNetworkId(networkId: string): this {
    this.#cmd.networkId = networkId;
    return this;
  }

  withNonce(nonce: string): this {
    this.#cmd.nonce = nonce;
    return this;
  }

  withContext(context?: ToolboxNetworkContext): this {
    if (context) {
      this.#context = context;
    }
    return this;
  }

  build(context?: ToolboxNetworkContext): PactTransactionDispatcher<Payload, Result> {
    if (context) {
      this.withContext(context);
    }
    this.#builder = (cmd) => Promise.resolve(createTransaction(cmd));
    return new PactTransactionDispatcher(this, this.#context);
  }

  sign(wallet?: WalletLike): PactTransactionDispatcher<Payload, Result> {
    wallet = wallet || this.#context.getWallet();
    if (!wallet) {
      throw new Error("No wallet provided");
    }
    this.#builder = (cmd) => signPactCommandWithWalletLike(cmd, wallet);
    return new PactTransactionDispatcher(this, this.#context);
  }

  quickSign(wallet?: WalletLike): PactTransactionDispatcher<Payload, Result> {
    wallet = wallet || this.#context.getWallet();
    if (!wallet) {
      throw new Error("No wallet provided");
    }
    this.#builder = (cmd) => signPactCommandWithWalletLike(cmd, wallet, true);
    return new PactTransactionDispatcher(this, this.#context);
  }

  toString(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  getPartialTransaction(): Promise<PartiallySignedTransaction> {
    return this.#builder(this.#cmd);
  }

  getCommand(): PactCommand<Payload> {
    return this.#cmd;
  }
}

type PactTransactionDispatcherType = "dirtyRead" | "local" | "submitAndListen" | "submit";
async function dispatchTransaction<
  Payload extends PactCmdPayload,
  Result = unknown,
  Type extends PactTransactionDispatcherType = "submitAndListen",
>(
  builder: PactTransactionBuilder<Payload, Result>,
  client: KdaClient,
  type: Type,
  preflight?: boolean,
  sequence?: boolean,
  chainId?: ChainId | ChainId[],
): Promise<Type extends "submit" ? ITransactionDescriptor : Result> {
  let txs: Transaction | Transaction[];
  if (chainId) {
    const chainIds = Array.isArray(chainId) ? chainId : [chainId];
    txs = await Promise.all(chainIds.map((chainId) => builder.withChainId(chainId).getPartialTransaction()));
  } else {
    txs = await builder.getPartialTransaction();
  }
  let result: unknown;
  switch (type) {
    case "dirtyRead":
      result = Array.isArray(txs) ? dirtyReadOrFail<Result[]>(client, txs) : dirtyReadOrFail<Result>(client, txs);
      break;
    case "local":
      result = Array.isArray(txs) ? localOrFail<Result[]>(client, txs) : localOrFail<Result>(client, txs);
      break;
    case "submitAndListen":
      result = Array.isArray(txs)
        ? submitAndListen<Result[]>(client, txs, preflight, sequence)
        : submitAndListen<Result>(client, txs, preflight, sequence);
      break;
    case "submit":
      result = Array.isArray(txs) ? submit(client, txs, preflight) : submit(client, txs, preflight);
      break;
    default:
      throw new Error("Unknown transaction type");
  }
  return result as Type extends "submit" ? ITransactionDescriptor : Result;
}

export class PactTransactionDispatcher<Payload extends PactCmdPayload, Result = unknown> {
  #context: ToolboxNetworkContext;

  constructor(
    private builder: PactTransactionBuilder<Payload, Result>,
    context?: ToolboxNetworkContext,
  ) {
    this.#context = context ?? createToolboxNetworkContext();
  }

  async submit(chainId?: ChainId, preflight?: boolean, client?: KdaClient): Promise<ITransactionDescriptor>;
  async submit(chainId?: ChainId[], preflight?: boolean, client?: KdaClient): Promise<ITransactionDescriptor[]>;
  async submit(
    chainId?: ChainId | ChainId[],
    preflight?: boolean,
    client?: KdaClient,
  ): Promise<ITransactionDescriptor | ITransactionDescriptor[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "submit", preflight, false, chainId);
  }

  async dirtyRead(chainId?: ChainId, client?: KdaClient): Promise<Result>;
  async dirtyRead(chainId?: ChainId[], client?: KdaClient): Promise<Result[]>;
  async dirtyRead(chainId?: ChainId | ChainId[], client?: KdaClient): Promise<Result | Result[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "dirtyRead", false, false, chainId);
  }

  async local(chainId?: ChainId, client?: KdaClient): Promise<Result>;
  async local(chainId?: ChainId[], client?: KdaClient): Promise<Result[]>;
  async local(chainId?: ChainId | ChainId[], client?: KdaClient): Promise<Result | Result[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "local", false, false, chainId);
  }

  async submitAndListen(
    chainId?: ChainId,
    preflight?: boolean,
    sequence?: boolean,
    client?: KdaClient,
  ): Promise<Result>;
  async submitAndListen(
    chainId?: ChainId[],
    preflight?: boolean,
    sequence?: boolean,
    client?: KdaClient,
  ): Promise<Result[]>;
  async submitAndListen(
    chainId?: ChainId | ChainId[],
    preflight?: boolean,
    sequence?: boolean,
    client?: KdaClient,
  ): Promise<Result | Result[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "submitAndListen", preflight, sequence, chainId);
  }

  // all chains functions
  async dirtyReadAll(client?: KdaClient): Promise<Result[]> {
    return this.dirtyRead(ALL_CHAINS, client);
  }

  async localAll(client?: KdaClient): Promise<Result[]> {
    return this.local(ALL_CHAINS, client);
  }

  async submitAll(client?: KdaClient, preflight?: boolean): Promise<ITransactionDescriptor[]> {
    return this.submit(ALL_CHAINS, preflight, client);
  }

  async submitAndListenAll(client?: KdaClient, preflight?: boolean, sequence?: boolean): Promise<Result[]> {
    return this.submitAndListen(ALL_CHAINS, preflight, sequence, client);
  }

  async getSignedTransaction(): Promise<Transaction> {
    return this.builder.getPartialTransaction();
  }
}

export function execution<Result>(
  code: string,
  context?: ToolboxNetworkContext,
): PactTransactionBuilder<PactExecPayload, Result> {
  return new PactTransactionBuilder(
    {
      exec: {
        code,
        data: {},
      },
    },
    context,
  );
}

export function continuation<Result>(
  cont: Partial<PactCont> = {},
  context?: ToolboxNetworkContext,
): PactTransactionBuilder<PactContPayload, Result> {
  return new PactTransactionBuilder(
    {
      cont: {
        pactId: "",
        step: 0,
        rollback: false,
        data: {},
        proof: null,
        ...cont,
      },
    } as PactContPayload,
    context,
  );
}
