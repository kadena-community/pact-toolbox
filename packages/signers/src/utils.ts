import type { PactCommand, PartiallySignedTransaction, SignedTransaction, TransactionFullSig, TransactionSig } from "@pact-toolbox/types";
import { toHex, toBase64Url, blake2b, exportBase16Key, signBytes, toUtf8 } from "@pact-toolbox/crypto";
import type { SignerConfig } from "./types";

// Core Kadena transaction signing functionality - preserved exactly as needed by ecosystem
export async function partiallySignPactCommand(
  keyPairs: CryptoKeyPair[],
  command: PactCommand,
  config?: SignerConfig,
): Promise<PartiallySignedTransaction> {
  if (config?.abortSignal?.aborted) {
    throw new Error("Operation aborted");
  }

  // Step 1: JSON.stringify the command
  const cmd = JSON.stringify(command);

  // Step 2: Hash the stringified command with blake2b
  const cmdBytes = toUtf8(cmd);
  const hash = blake2b(cmdBytes, undefined, 32); // 32-byte hash

  // Step 3: Sign the hash with keypairs found in signers field from the PactCommand
  // Map public keys to keyPairs for quick lookup
  const keyPairMap = new Map<string, CryptoKeyPair>();
  for (const keyPair of keyPairs) {
    const pubKeyHex = await exportBase16Key(keyPair.publicKey);
    keyPairMap.set(pubKeyHex, keyPair);
  }

  // Prepare the sigs array
  const sigs: TransactionSig[] = [];

  for (const signer of command.signers) {
    if (config?.abortSignal?.aborted) {
      throw new Error("Operation aborted");
    }

    const pubKey = signer.pubKey;
    const keyPair = keyPairMap.get(pubKey);

    if (!keyPair) {
      // If we don't have the keyPair for this pubKey, add an empty signature
      sigs.push({ pubKey });
      continue;
    }

    // Sign the hash bytes
    const signatureBytes = await signBytes(keyPair.privateKey, hash);
    const signatureHex = toHex(signatureBytes);

    sigs.push({ pubKey, sig: signatureHex });
  }

  // Step 4: Build the PartiallySignedTransaction object with the signatures
  return {
    cmd,
    hash,
    sigs,
  };
}

// Transaction validation and finalization utilities
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
        ? toBase64Url(transaction.hash)
        : transaction.hash,
    sigs: transaction.sigs.filter((sig) => "sig" in sig) as TransactionFullSig[],
  });
}