import type { ITransactionDescriptor } from "@kadena/client";
import type { ChainId, PactCmdPayload, Transaction } from "@pact-toolbox/types";
import type { PactTransactionBuilder } from "./builder";
import { ALL_CHAINS } from "./constant";
import type { ToolboxNetworkContext } from "./network";
import { createToolboxNetworkContext } from "./network";
import { dirtyReadOrFail, localOrFail, submit, submitAndListen, type KdaClient } from "./utils";

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

  submit(chainId?: ChainId, preflight?: boolean, client?: KdaClient): Promise<ITransactionDescriptor>;
  submit(chainId?: ChainId[], preflight?: boolean, client?: KdaClient): Promise<ITransactionDescriptor[]>;
  submit(
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

  dirtyRead(chainId?: ChainId, client?: KdaClient): Promise<Result>;
  dirtyRead(chainId?: ChainId[], client?: KdaClient): Promise<Result[]>;
  dirtyRead(chainId?: ChainId | ChainId[], client?: KdaClient): Promise<Result | Result[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "dirtyRead", false, false, chainId);
  }

  local(chainId?: ChainId, client?: KdaClient): Promise<Result>;
  local(chainId?: ChainId[], client?: KdaClient): Promise<Result[]>;
  local(chainId?: ChainId | ChainId[], client?: KdaClient): Promise<Result | Result[]> {
    client = client || this.#context.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "local", false, false, chainId);
  }

  submitAndListen(chainId?: ChainId, preflight?: boolean, sequence?: boolean, client?: KdaClient): Promise<Result>;
  submitAndListen(chainId?: ChainId[], preflight?: boolean, sequence?: boolean, client?: KdaClient): Promise<Result[]>;
  submitAndListen(
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
  dirtyReadAll(client?: KdaClient): Promise<Result[]> {
    return this.dirtyRead(ALL_CHAINS, client);
  }

  localAll(client?: KdaClient): Promise<Result[]> {
    return this.local(ALL_CHAINS, client);
  }

  submitAll(client?: KdaClient, preflight?: boolean): Promise<ITransactionDescriptor[]> {
    return this.submit(ALL_CHAINS, preflight, client);
  }

  submitAndListenAll(client?: KdaClient, preflight?: boolean, sequence?: boolean): Promise<Result[]> {
    return this.submitAndListen(ALL_CHAINS, preflight, sequence, client);
  }

  getSignedTransaction(): Promise<Transaction> {
    return this.builder.getPartialTransaction();
  }
}
