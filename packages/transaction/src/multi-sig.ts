import type {
  PartiallySignedTransaction,
  SignedTransaction,
  TransactionSig,
  TransactionFullSig,
  Wallet,
} from "@pact-toolbox/types";
import { isFullySignedTransaction } from "@pact-toolbox/signers";
import { toBase64Url } from "@pact-toolbox/crypto";

/**
 * Collect signatures from multiple wallets for a transaction
 *
 * @example
 * ```typescript
 * const tx = await execution('(coin.transfer "alice" "bob" 10.0)')
 *   .withSigner("alice-key", (signFor) => [
 *     signFor("coin.TRANSFER", "alice", "bob", 10.0)
 *   ])
 *   .withSigner("gas-payer-key", (signFor) => [
 *     signFor("coin.GAS")
 *   ])
 *   .build()
 *   .getPartialTransaction();
 *
 * const signedTx = await collectSignatures(tx, [aliceWallet, gasPayerWallet]);
 * ```
 */
export async function collectSignatures(
  transaction: PartiallySignedTransaction,
  signers: Wallet[],
): Promise<SignedTransaction> {
  const cmd = JSON.parse(transaction.cmd);
  const cmdSigners = cmd.signers || [];

  // Initialize signatures array with partial sigs
  const signatures: TransactionSig[] = cmdSigners.map((signer: any) => ({
    pubKey: signer.pubKey,
    sig: undefined,
  }));

  // Collect signatures from each signer
  for (const signer of signers) {
    const account = await signer.getAccount();

    // Find which signers this wallet controls
    const controlledIndices = cmdSigners
      .map((cmdSigner: any, index: number) => ({ cmdSigner, index }))
      .filter(({ cmdSigner }: any) => cmdSigner.pubKey === account.publicKey)
      .map(({ index }: any) => index);

    if (controlledIndices.length > 0) {
      // Sign the transaction
      const signed = await signer.sign(transaction);

      // Extract signatures for controlled signers
      controlledIndices.forEach((index: number) => {
        if (signed.sigs?.[index]?.sig) {
          signatures[index] = signed.sigs[index];
        }
      });
    }
  }

  // Check if all signatures were collected
  const missingIndices = signatures
    .map((sig, index) => ({ sig, index }))
    .filter(({ sig }) => !sig?.sig)
    .map(({ index }) => index);

  if (missingIndices.length > 0) {
    throw new Error(`Missing signatures from signers at indices: ${missingIndices.join(", ")}`);
  }

  // Convert hash to string if needed and ensure all sigs are complete
  const hashStr = typeof transaction.hash === "string" ? transaction.hash : toBase64Url(transaction.hash);

  // Ensure all signatures are complete (have sig property)
  const fullSigs = signatures.map((sig): TransactionFullSig => {
    if (!sig.sig) {
      throw new Error("Internal error: signature missing");
    }
    // Return as TransactionFullSig (sig is required, pubKey is optional)
    if ("pubKey" in sig && sig.pubKey) {
      return { sig: sig.sig, pubKey: sig.pubKey };
    }
    return { sig: sig.sig };
  });

  return {
    cmd: transaction.cmd,
    hash: hashStr,
    sigs: fullSigs,
  };
}

/**
 * Merge signatures from multiple partially signed transactions
 *
 * @example
 * ```typescript
 * // Alice signs
 * const aliceSignedTx = await aliceWallet.sign(unsignedTx);
 *
 * // Bob signs separately
 * const bobSignedTx = await bobWallet.sign(unsignedTx);
 *
 * // Merge both signatures
 * const fullySignedTx = mergeSignatures(aliceSignedTx, bobSignedTx);
 * ```
 */
export function mergeSignatures(...transactions: PartiallySignedTransaction[]): PartiallySignedTransaction {
  if (transactions.length === 0) {
    throw new Error("No transactions to merge");
  }

  const firstTx = transactions[0]!;

  // Verify all transactions are for the same command
  if (!transactions.every((tx) => tx.hash === firstTx.hash)) {
    throw new Error("Cannot merge transactions with different hashes");
  }

  const cmd = JSON.parse(firstTx.cmd);
  const signers = cmd.signers || [];

  // Collect all signatures with pubKeys from signers
  const mergedSigs: TransactionSig[] = signers.map((signer: any) => ({
    pubKey: signer.pubKey,
    sig: undefined,
  }));

  transactions.forEach((tx) => {
    tx.sigs?.forEach((sig, index) => {
      if (sig?.sig && !mergedSigs[index]?.sig) {
        mergedSigs[index] = sig;
      }
    });
  });

  return {
    cmd: firstTx.cmd,
    hash: firstTx.hash,
    sigs: mergedSigs,
  };
}
