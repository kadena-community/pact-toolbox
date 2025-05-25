import type { Address } from "@pact-toolbox/crypto";
import type {
  PactCommand,
  PartiallySignedTransaction,
  SignedTransaction,
  TransactionFullSig,
  TransactionSig,
} from "@pact-toolbox/types";

import { base16, base64Url, blake2b, exportBase16Key, signBytes, utf8 } from "@pact-toolbox/crypto";

import type { BaseTransactionSignerConfig } from "./types";

export type PactCommandSignerConfig = BaseTransactionSignerConfig;

/** Defines a signer capable of signing transactions. */
export type PactCommandSigner<TAddress extends string = string> = Readonly<{
  address: Address<TAddress>;
  signPactCommands(commands: PactCommand[]): Promise<PartiallySignedTransaction[]>;
}>;

/** Checks whether the provided value implements the {@link PactCommandSigner} interface. */
export function isPactCommandSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): value is PactCommandSigner<TAddress> {
  return "signPactCommands" in value && typeof value.signPactCommands === "function";
}

/** Asserts that the provided value implements the {@link PactCommandSigner} interface. */
export function assertIsPactCommandSigner<TAddress extends string>(value: {
  [key: string]: unknown;
  address: Address<TAddress>;
}): asserts value is PactCommandSigner<TAddress> {
  if (!isPactCommandSigner(value)) {
    throw new Error("Value is not a PactCommandSigner");
  }
}

// Function to sign a PactCommand
export async function partiallySignPactCommand(
  keyPairs: CryptoKeyPair[],
  command: PactCommand,
): Promise<PartiallySignedTransaction> {
  // Step 1: JSON.stringify the command
  const cmd = JSON.stringify(command);

  // Step 2: Hash the stringified command with blake2b from blakejs
  const cmdBytes = utf8.encode(cmd);
  const hash = blake2b(cmdBytes as Uint8Array, undefined, 32); // 32-byte hash

  // Step 4: Sign the hash with keypairs found in signers field from the PactCommand
  // Map public keys to keyPairs for quick lookup
  const keyPairMap = new Map<string, CryptoKeyPair>();
  for (const keyPair of keyPairs) {
    const pubKeyHex = await exportBase16Key(keyPair.publicKey);
    keyPairMap.set(pubKeyHex, keyPair);
  }

  // Prepare the sigs array
  const sigs: TransactionSig[] = [];

  for (const signer of command.signers) {
    const pubKey = signer.pubKey;
    const keyPair = keyPairMap.get(pubKey);

    if (!keyPair) {
      // If we don't have the keyPair for this pubKey, add an empty signature
      sigs.push({ pubKey });
      continue;
    }

    // Sign the hash bytes
    const signatureBytes = await signBytes(keyPair.privateKey, hash);
    const signatureHex = base16.decode(signatureBytes);

    sigs.push({ pubKey, sig: signatureHex });
  }

  // Step 5: Build the SignedTransaction object with the signatures
  return {
    cmd,
    hash,
    sigs,
  };
}

export function isTransactionFullSig(sig: TransactionSig): sig is TransactionFullSig {
  return "sig" in sig && sig.sig !== undefined;
}

export function isFullySignedTransaction(transaction: unknown): transaction is SignedTransaction {
  return (
    typeof transaction === "object" &&
    transaction !== null &&
    "cmd" in transaction &&
    "hash" in transaction &&
    "sigs" in transaction &&
    Array.isArray(transaction.sigs) &&
    transaction.sigs.every(isTransactionFullSig)
  );
}

export function finalizeTransaction(transaction: PartiallySignedTransaction): SignedTransaction {
  return Object.freeze({
    cmd: transaction.cmd,
    hash:
      typeof transaction.hash !== "string" && transaction.hash instanceof Uint8Array
        ? base64Url.decode(transaction.hash)
        : transaction.hash,
    sigs: transaction.sigs.filter((sig) => "sig" in sig) as TransactionFullSig[],
  });
}
