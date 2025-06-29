import type { Address, ReadonlyUint8Array } from "@pact-toolbox/crypto";
import type { PartiallySignedTransaction } from "@pact-toolbox/types";
import {
  fromHex,
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  generateKeyPair,
  exportBase16Key,
  signBytes,
  toUtf8,
} from "@pact-toolbox/crypto";

import type { Signer, SignableMessage, SignerConfig, SignatureDictionary } from "./types";
import { partiallySignPactCommand } from "./utils";

// KeyPair-based signer implementation
export class KeyPairSigner implements Signer {
  readonly address: Address;
  readonly keyPair: CryptoKeyPair;

  private constructor(address: Address, keyPair: CryptoKeyPair) {
    this.address = address;
    this.keyPair = keyPair;
  }

  static async fromKeyPair(keyPair: CryptoKeyPair): Promise<KeyPairSigner> {
    const address = (await exportBase16Key(keyPair.publicKey)) as Address;
    return new KeyPairSigner(address, keyPair);
  }

  static async generate(): Promise<KeyPairSigner> {
    const keyPair = await generateKeyPair();
    return KeyPairSigner.fromKeyPair(keyPair);
  }

  static async fromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<KeyPairSigner> {
    const keyPair = await createKeyPairFromBytes(bytes, extractable);
    return KeyPairSigner.fromKeyPair(keyPair);
  }

  static async fromPrivateKeyBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<KeyPairSigner> {
    const keyPair = await createKeyPairFromPrivateKeyBytes(bytes, extractable);
    return KeyPairSigner.fromKeyPair(keyPair);
  }

  static async fromPrivateKeyHex(privateKey: string, extractable?: boolean): Promise<KeyPairSigner> {
    return KeyPairSigner.fromPrivateKeyBytes(fromHex(privateKey), extractable);
  }

  async signPactCommands(
    commands: Parameters<Signer["signPactCommands"]>[0],
    config?: SignerConfig,
  ): Promise<PartiallySignedTransaction[]> {
    return Promise.all(commands.map((cmd) => partiallySignPactCommand([this.keyPair], cmd, config)));
  }

  async signMessages(
    messages: readonly SignableMessage[],
    config?: SignerConfig,
  ): Promise<readonly SignatureDictionary[]> {
    return Promise.all(
      messages.map(async (message) => {
        if (config?.abortSignal?.aborted) {
          throw new Error("Operation aborted");
        }

        return Object.freeze({
          [this.address]: await signBytes(this.keyPair.privateKey, message.content),
        } as SignatureDictionary);
      }),
    );
  }
}

// No-op signer for testing and development
export class NoopSigner implements Signer {
  readonly address: Address;

  constructor(address: Address) {
    this.address = address;
  }

  async signPactCommands(commands: Parameters<Signer["signPactCommands"]>[0]): Promise<PartiallySignedTransaction[]> {
    return commands.map(() => Object.freeze({}) as any);
  }

  async signMessages(messages: readonly SignableMessage[]): Promise<readonly SignatureDictionary[]> {
    return messages.map(() => Object.freeze({}));
  }
}

// Helper function to create signable messages
export function createSignableMessage(
  content: Uint8Array | string,
  signatures: SignatureDictionary = {},
): SignableMessage {
  return Object.freeze({
    content: typeof content === "string" ? toUtf8(content) : content,
    signatures: Object.freeze({ ...signatures }),
  });
}

// Type guards
export const isSigner = (value: unknown): value is Signer => {
  return (
    typeof value === "object" &&
    value !== null &&
    "address" in value &&
    "signPactCommands" in value &&
    typeof (value as any).signPactCommands === "function"
  );
};

export const isKeyPairSigner = (value: unknown): value is KeyPairSigner => {
  return value instanceof KeyPairSigner;
};
