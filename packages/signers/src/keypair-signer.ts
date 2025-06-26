import type { Address, ReadonlyUint8Array } from "@pact-toolbox/crypto";

import {
  fromHex,
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  generateKeyPair,
  exportBase16Key,
  signBytes,
} from "@pact-toolbox/crypto";

import type { PactCommandSigner } from "./command-signer";
import type { MessageSigner } from "./message-signer";
import { isPactCommandSigner, partiallySignPactCommand } from "./command-signer";
import { isMessageSigner } from "./message-signer";

/** Defines a signer capable of signing messages and transactions using a CryptoKeyPair. */
export type KeyPairSigner<TAddress extends string = string> = MessageSigner<TAddress> &
  PactCommandSigner<TAddress> & { keyPair: CryptoKeyPair };

/** Checks whether the provided value implements the {@link KeyPairSigner} interface. */
export function isKeyPairSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): value is KeyPairSigner<TAddress> {
  return (
    "keyPair" in value && typeof value["keyPair"] === "object" && isMessageSigner(value) && isPactCommandSigner(value)
  );
}

/** Asserts that the provided value implements the {@link KeyPairSigner} interface. */
export function assertIsKeyPairSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): asserts value is KeyPairSigner<TAddress> {
  if (!isKeyPairSigner(value)) {
    throw new Error("Value is not a KeyPairSigner");
  }
}

/** Creates a KeyPairSigner from the provided Crypto KeyPair. */
export async function createSignerFromKeyPair(keyPair: CryptoKeyPair): Promise<KeyPairSigner> {
  const address = (await exportBase16Key(keyPair.publicKey)) as Address;

  const out: KeyPairSigner = {
    address,
    keyPair,
    signMessages: (messages) => {
      return Promise.all(
        messages.map(async (message) =>
          Object.freeze({
            [address]: await signBytes(keyPair.privateKey, message.content),
          }),
        ),
      );
    },
    signPactCommands: (commands) => {
      return Promise.all(commands.map((cmd) => partiallySignPactCommand([keyPair], cmd)));
    },
  };

  return Object.freeze(out);
}

/** Securely generates a signer capable of signing messages and transactions using a Crypto KeyPair. */
export async function generateKeyPairSigner(): Promise<KeyPairSigner> {
  return createSignerFromKeyPair(await generateKeyPair());
}

/** Creates a signer capable of signing messages and transactions using the 64 bytes of a KeyPair. */
export async function createKeyPairSignerFromBytes(
  bytes: ReadonlyUint8Array,
  extractable?: boolean,
): Promise<KeyPairSigner> {
  return createSignerFromKeyPair(await createKeyPairFromBytes(bytes, extractable));
}

/** Creates a signer capable of signing messages and transactions using the 32 bytes of a private key. */
export async function createKeyPairSignerFromPrivateKeyBytes(
  bytes: ReadonlyUint8Array,
  extractable?: boolean,
): Promise<KeyPairSigner> {
  return createSignerFromKeyPair(await createKeyPairFromPrivateKeyBytes(bytes, extractable));
}

export async function createKeyPairSignerFromBase16PrivateKey(
  privateKey: string,
  extractable?: boolean,
): Promise<KeyPairSigner> {
  return createKeyPairSignerFromPrivateKeyBytes(fromHex(privateKey), extractable);
}
