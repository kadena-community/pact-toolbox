import { describe, it, expect, vi } from "vitest";
import { collectSignatures, mergeSignatures } from "../src/multi-sig";
import type { PartiallySignedTransaction, TransactionSig, Wallet } from "@pact-toolbox/types";
import { createMockSigner } from "./test-helpers";

describe("Multi-Signature Edge Cases", () => {
  it("should handle empty signers array", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({ signers: [] }),
      hash: "test-hash",
      sigs: [],
    };

    const signedTx = await collectSignatures(tx, []);

    expect(signedTx.sigs).toHaveLength(0);
    expect(signedTx.hash).toBe("test-hash");
  });

  it("should handle signer that doesn't control any signers", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({
        signers: [{ pubKey: "alice-key" }],
      }),
      hash: "test-hash",
      sigs: [{ pubKey: "alice-key", sig: undefined }],
    };

    // Bob signer doesn't control any signers
    const bobWallet = createMockSigner("bob-key");
    vi.mocked(bobWallet.sign).mockResolvedValue({
      ...tx,
      sigs: [{ pubKey: "alice-key", sig: undefined }],
    } as any);

    await expect(collectSignatures(tx, [bobWallet])).rejects.toThrow("Missing signatures from signers at indices: 0");
  });

  it("should handle signer that returns extra signatures", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({
        signers: [{ pubKey: "alice-key" }],
      }),
      hash: "test-hash",
      sigs: [{ pubKey: "alice-key", sig: undefined }],
    };

    // Wallet returns more signatures than expected
    const signer = createMockSigner("alice-key");
    vi.mocked(signer.sign).mockResolvedValue({
      ...tx,
      sigs: [
        { pubKey: "alice-key", sig: "alice-sig" },
        { pubKey: "extra-key", sig: "extra-sig" }, // Extra signature
      ],
    } as any);

    const signedTx = await collectSignatures(tx, [signer]);

    // Should only include the expected signature
    expect(signedTx.sigs).toHaveLength(1);
    expect(signedTx.sigs[0]).toEqual({ sig: "alice-sig", pubKey: "alice-key" });
  });

  it("should handle signer that returns signatures in wrong order", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({
        signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }, { pubKey: "charlie-key" }],
      }),
      hash: "test-hash",
      sigs: [
        { pubKey: "alice-key", sig: undefined },
        { pubKey: "bob-key", sig: undefined },
        { pubKey: "charlie-key", sig: undefined },
      ],
    };

    // Wallet returns bob's signature in wrong position
    const bobWallet = createMockSigner("bob-key");
    vi.mocked(bobWallet.sign).mockResolvedValue({
      ...tx,
      sigs: [
        { pubKey: "alice-key", sig: undefined },
        { pubKey: "bob-key", sig: undefined },
        { pubKey: "charlie-key", sig: "bob-sig-wrong" }, // Wrong position!
      ],
    } as any);

    // Should still fail because bob didn't sign at index 1
    await expect(collectSignatures(tx, [bobWallet])).rejects.toThrow(
      "Missing signatures from signers at indices: 0, 1, 2",
    );
  });

  it("should merge signatures with different pubKey formats", () => {
    const baseTx = {
      cmd: JSON.stringify({ signers: [{ pubKey: "alice" }, { pubKey: "bob" }] }),
      hash: "same-hash",
    };

    const tx1: PartiallySignedTransaction = {
      ...baseTx,
      sigs: [
        { sig: "alice-sig" }, // No pubKey
        { pubKey: "bob", sig: undefined },
      ],
    };

    const tx2: PartiallySignedTransaction = {
      ...baseTx,
      sigs: [
        { pubKey: "alice", sig: undefined },
        { sig: "bob-sig", pubKey: "bob" }, // Has pubKey
      ],
    };

    const merged = mergeSignatures(tx1, tx2);

    // Should preserve the format from first occurrence
    expect(merged.sigs[0]).toEqual({ sig: "alice-sig" }); // No pubKey preserved
    expect(merged.sigs[1]).toEqual({ sig: "bob-sig", pubKey: "bob" }); // pubKey preserved
  });

  it("should handle null/undefined signatures gracefully", () => {
    const baseTx = {
      cmd: JSON.stringify({ signers: [{ pubKey: "alice" }] }),
      hash: "same-hash",
    };

    const tx1: PartiallySignedTransaction = {
      ...baseTx,
      sigs: [{ pubKey: "alice", sig: null as any }], // null sig
    };

    const tx2: PartiallySignedTransaction = {
      ...baseTx,
      sigs: [{ pubKey: "alice", sig: "alice-sig" }],
    };

    const merged = mergeSignatures(tx1, tx2);

    expect(merged.sigs[0]).toEqual({ pubKey: "alice", sig: "alice-sig" });
  });

  it("should validate hash is base64url after conversion", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({ signers: [{ pubKey: "alice-key" }] }),
      hash: new Uint8Array([255, 254, 253, 252, 251, 250]), // Binary hash
      sigs: [{ pubKey: "alice-key", sig: undefined }],
    };

    const signer = createMockSigner("alice-key");
    vi.mocked(signer.sign).mockResolvedValue({
      ...tx,
      sigs: [{ pubKey: "alice-key", sig: "alice-sig" }],
    } as any);

    const signedTx = await collectSignatures(tx, [signer]);

    // Check hash is valid base64url (no padding, uses - and _ instead of + and /)
    expect(signedTx.hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signedTx.hash).not.toContain("="); // No padding
    expect(signedTx.hash).not.toContain("+"); // base64url uses -
    expect(signedTx.hash).not.toContain("/"); // base64url uses _
  });

  it("should handle signatures array mutations", async () => {
    const tx: PartiallySignedTransaction = {
      cmd: JSON.stringify({
        signers: [{ pubKey: "alice-key" }],
      }),
      hash: "test-hash",
      sigs: [{ pubKey: "alice-key", sig: undefined }],
    };

    const signer = createMockSigner("alice-key");
    vi.mocked(signer.sign).mockImplementation((async (txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[]) => {
      const tx = Array.isArray(txOrTxs) ? txOrTxs[0]! : txOrTxs;
      // Mutate the input (bad signer behavior)
      const originalSigs = tx.sigs;
      tx.sigs = [];

      const result = {
        cmd: tx.cmd,
        hash: tx.hash,
        sigs: [{ pubKey: "alice-key", sig: "alice-sig" }],
      };

      return Array.isArray(txOrTxs) ? [result] : result;
    }) as any);

    // Should still work despite signer mutating input
    const signedTx = await collectSignatures(tx, [signer]);
    expect(signedTx.sigs).toHaveLength(1);
    expect(signedTx.sigs[0]).toEqual({ sig: "alice-sig", pubKey: "alice-key" });
  });
});
