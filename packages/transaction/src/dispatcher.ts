import type { ChainId, PactCmdPayload, Transaction, PactTransactionDescriptor } from "@pact-toolbox/types";
import type { PactTransactionBuilder } from "./builder";
import type { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { ChainwebClient } from "@pact-toolbox/chainweb-client";
import { ALL_CHAINS } from "./constant";
import { dirtyReadOrFail, localOrFail, submit, submitAndListen, type Client } from "@pact-toolbox/chainweb-client";

type PactTransactionDispatcherType = "dirtyRead" | "local" | "submitAndListen" | "submit";
async function dispatchTransaction<
  Payload extends PactCmdPayload,
  Result = unknown,
  Type extends PactTransactionDispatcherType = "submitAndListen",
>(
  builder: PactTransactionBuilder<Payload, Result>,
  client: Client,
  type: Type,
  preflight?: boolean,
  chainId?: ChainId | ChainId[],
): Promise<Type extends "submit" ? PactTransactionDescriptor : Result> {
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
        ? submitAndListen<Result[]>(client, txs, preflight)
        : submitAndListen<Result>(client, txs, preflight);
      break;
    case "submit":
      result = Array.isArray(txs) ? submit(client, txs, preflight) : submit(client, txs, preflight);
      break;
    default:
      throw new Error("Unknown transaction type");
  }
  return result as Type extends "submit" ? PactTransactionDescriptor : Result;
}

export class PactTransactionDispatcher<Payload extends PactCmdPayload, Result = unknown> {
  #networkProvider: NetworkConfigProvider;
  #client?: Client;

  constructor(
    private builder: PactTransactionBuilder<Payload, Result>,
    networkProvider: NetworkConfigProvider,
  ) {
    this.#networkProvider = networkProvider;
  }

  private getClient(): Client {
    if (!this.#client) {
      const network = this.#networkProvider.getCurrentNetwork();
      this.#client = new ChainwebClient({
        networkId: network.networkId,
        rpcUrl: network.rpcUrl,
      });
    }
    return this.#client;
  }

  submit(chainId?: ChainId, preflight?: boolean, client?: Client): Promise<PactTransactionDescriptor>;
  submit(chainId?: ChainId[], preflight?: boolean, client?: Client): Promise<PactTransactionDescriptor[]>;
  submit(
    chainId?: ChainId | ChainId[],
    preflight?: boolean,
    client?: Client,
  ): Promise<PactTransactionDescriptor | PactTransactionDescriptor[]> {
    client = client || this.getClient();
    return dispatchTransaction(this.builder, client, "submit", preflight, chainId);
  }

  dirtyRead(chainId?: ChainId, client?: Client): Promise<Result>;
  dirtyRead(chainId?: ChainId[], client?: Client): Promise<Result[]>;
  dirtyRead(chainId?: ChainId | ChainId[], client?: Client): Promise<Result | Result[]> {
    client = client || this.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "dirtyRead", false, chainId);
  }

  local(chainId?: ChainId, client?: Client): Promise<Result>;
  local(chainId?: ChainId[], client?: Client): Promise<Result[]>;
  local(chainId?: ChainId | ChainId[], client?: Client): Promise<Result | Result[]> {
    client = client || this.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "local", false, chainId);
  }

  submitAndListen(chainId?: ChainId, preflight?: boolean, client?: Client): Promise<Result>;
  submitAndListen(chainId?: ChainId[], preflight?: boolean, client?: Client): Promise<Result[]>;
  submitAndListen(chainId?: ChainId | ChainId[], preflight?: boolean, client?: Client): Promise<Result | Result[]> {
    client = client || this.getClient();
    if (!client) {
      throw new Error("No client provided");
    }
    return dispatchTransaction(this.builder, client, "submitAndListen", preflight, chainId);
  }

  // all chains functions
  dirtyReadAll(client?: Client): Promise<Result[]> {
    return this.dirtyRead(ALL_CHAINS, client);
  }

  localAll(client?: Client): Promise<Result[]> {
    return this.local(ALL_CHAINS, client);
  }

  submitAll(client?: Client, preflight?: boolean): Promise<PactTransactionDescriptor[]> {
    return this.submit(ALL_CHAINS, preflight, client);
  }

  submitAndListenAll(client?: Client, preflight?: boolean): Promise<Result[]> {
    return this.submitAndListen(ALL_CHAINS, preflight, client);
  }

  getSignedTransaction(): Promise<Transaction> {
    return this.builder.getPartialTransaction();
  }
}
