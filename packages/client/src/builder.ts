import type {
  ChainId,
  PactCapabilityLike,
  PactCmdPayload,
  PactCommand,
  PactCont,
  PactContPayload,
  PactExecPayload,
  PactKeyset,
  PactMetadata,
  PactSignerLike,
  PactVerifier,
  PartiallySignedTransaction,
  Serializable,
  Transaction,
  WalletLike,
} from "@pact-toolbox/types";

import type { ToolboxNetworkContext } from "./network";
import { createToolboxNetworkContext } from "./network";
import { PactTransactionDispatcher } from "./dispatcher";
import {
  createPactCommandWithDefaults,
  createTransaction,
  isPactExecPayload,
  signPactCommandWithWalletLike,
  updatePactCommandSigners,
} from "./utils";

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

  withDataMap(data: { [key: string]: Serializable }): this {
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

  withKeysetMap(keysets: { [key: string]: PactKeyset }): this {
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
    return JSON.stringify(this.build(), undefined, 2);
  }

  getPartialTransaction(): Promise<PartiallySignedTransaction> {
    return this.#builder(this.#cmd);
  }

  getCommand(): PactCommand<Payload> {
    return this.#cmd;
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
        ...cont,
      },
    } as PactContPayload,
    context,
  );
}
