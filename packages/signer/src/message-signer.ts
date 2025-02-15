import type { Address } from "@pact-toolbox/crypto";

import type { SignableMessage } from "./signable-message";
import type { BaseSignerConfig, SignatureDictionary } from "./types";

export type MessageSignerConfig = BaseSignerConfig;

/** Defines a signer capable of signing messages. */
export type MessageSigner<TAddress extends string = string> = Readonly<{
  address: Address<TAddress>;
  signMessages(
    messages: readonly SignableMessage[],
    config?: MessageSignerConfig,
  ): Promise<readonly SignatureDictionary[]>;
}>;

/** Checks whether the provided value implements the {@link MessageSigner} interface. */
export function isMessageSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): value is MessageSigner<TAddress> {
  return "signMessages" in value && typeof value.signMessages === "function";
}

/** Asserts that the provided value implements the {@link MessageSigner} interface. */
export function assertIsMessageSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): asserts value is MessageSigner<TAddress> {
  if (!isMessageSigner(value)) {
    throw new Error("Value is not a MessageSigner");
  }
}
