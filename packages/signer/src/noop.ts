import type { Address } from "@pact-toolbox/crypto";

import type { PactCommandSigner } from "./command-signer";
import type { MessageSigner } from "./message-signer";

/** Defines a no-operation signer that pretends to partially sign messages and transactions. */
export type NoopSigner<TAddress extends string = string> = MessageSigner<TAddress> & PactCommandSigner<TAddress>;

/** Creates a NoopSigner from the provided Address. */
export function createNoopSigner(address: Address): NoopSigner {
  const out: NoopSigner = {
    address,
    signMessages: (messages) => Promise.resolve(messages.map(() => Object.freeze({}))),
    signPactCommands: (commands) => Promise.resolve(commands.map(() => Object.freeze({}) as any)),
  };

  return Object.freeze(out);
}
