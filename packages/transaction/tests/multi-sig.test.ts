import { describe, it, expect } from "vitest";
import { collectSignatures, mergeSignatures } from "../src/multi-sig";
import type { PartiallySignedTransaction, TransactionSig } from "@pact-toolbox/types";
import { isFullySignedTransaction as isFullySigned } from "@pact-toolbox/signers";
import { createMockSigner } from "./test-helpers";


describe("Multi-Signature Transaction Support", () => {
  describe("collectSignatures", () => {
    it("should collect signatures from all signers", async () => {
      const aliceWallet = createMockSigner("alice-key");
      const bobWallet = createMockSigner("bob-key");

      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      const signedTx = await collectSignatures(tx, [aliceWallet, bobWallet]);

      expect(signedTx.sigs).toHaveLength(2);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-key-signature-0", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "bob-key-signature-1", pubKey: "bob-key" });
    });

    it("should work with signers in any order", async () => {
      const aliceWallet = createMockSigner("alice-key");
      const bobWallet = createMockSigner("bob-key");

      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      // Test with reversed signer order
      const signedTx = await collectSignatures(tx, [bobWallet, aliceWallet]);

      expect(signedTx.sigs).toHaveLength(2);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-key-signature-0", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "bob-key-signature-1", pubKey: "bob-key" });
    });

    it("should throw error if required signatures are missing", async () => {
      const aliceWallet = createMockSigner("alice-key");
      // Bob signer is missing

      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      await expect(collectSignatures(tx, [aliceWallet])).rejects.toThrow(
        "Missing signatures from signers at indices: 1",
      );
    });

    it("should handle multiple signers with same signer", async () => {
      const aliceWallet = createMockSigner("alice-key");

      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [{ pubKey: "alice-key" }, { pubKey: "alice-key" }],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "alice-key", sig: undefined },
        ],
      };

      const signedTx = await collectSignatures(tx, [aliceWallet]);

      expect(signedTx.sigs).toHaveLength(2);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-key-signature-0", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "alice-key-signature-1", pubKey: "alice-key" });
    });
  });

  describe("mergeSignatures", () => {
    it("should merge signatures from multiple transactions", () => {
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({ signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }] }),
        hash: "test-hash",
        sigs: [],
      };

      const aliceSignedTx: PartiallySignedTransaction = {
        ...tx,
        sigs: [
          { pubKey: "alice-key", sig: "alice-signature" },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      const bobSignedTx: PartiallySignedTransaction = {
        ...tx,
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: "bob-signature" },
        ],
      };

      const mergedTx = mergeSignatures(aliceSignedTx, bobSignedTx);

      expect(mergedTx.sigs).toHaveLength(2);
      expect(mergedTx.sigs[0]).toEqual({ pubKey: "alice-key", sig: "alice-signature" });
      expect(mergedTx.sigs[1]).toEqual({ pubKey: "bob-key", sig: "bob-signature" });
    });

    it("should throw error when merging transactions with different hashes", () => {
      const tx1: PartiallySignedTransaction = {
        cmd: '{"payload": "test1"}',
        hash: "hash1",
        sigs: [{ sig: "sig1" }],
      };

      const tx2: PartiallySignedTransaction = {
        cmd: '{"payload": "test2"}',
        hash: "hash2",
        sigs: [{ sig: "sig2" }],
      };

      expect(() => mergeSignatures(tx1, tx2)).toThrow("Cannot merge transactions with different hashes");
    });

    it("should throw error when no transactions provided", () => {
      expect(() => mergeSignatures()).toThrow("No transactions to merge");
    });

    it("should handle overlapping signatures", () => {
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({ signers: [{ pubKey: "alice-key" }, { pubKey: "bob-key" }] }),
        hash: "test-hash",
        sigs: [],
      };

      const tx1: PartiallySignedTransaction = {
        ...tx,
        sigs: [
          { pubKey: "alice-key", sig: "alice-signature-1" },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      const tx2: PartiallySignedTransaction = {
        ...tx,
        sigs: [
          { pubKey: "alice-key", sig: "alice-signature-2" }, // Different signature for same index
          { pubKey: "bob-key", sig: "bob-signature" },
        ],
      };

      const mergedTx = mergeSignatures(tx1, tx2);

      // First valid signature wins
      expect(mergedTx.sigs[0]).toEqual({ pubKey: "alice-key", sig: "alice-signature-1" });
      expect(mergedTx.sigs[1]).toEqual({ pubKey: "bob-key", sig: "bob-signature" });
    });
  });

  describe("isFullySigned", () => {
    it("should return true for fully signed transaction", () => {
      const tx: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [{ sig: "sig1" }, { sig: "sig2" }],
      };

      expect(isFullySigned(tx)).toBe(true);
    });

    it("should return false for partially signed transaction", () => {
      const tx: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [
          { pubKey: "key1", sig: "sig1" },
          { pubKey: "key2", sig: undefined },
        ],
      };

      expect(isFullySigned(tx)).toBe(false);
    });

    it("should return true for empty sigs array", () => {
      const tx: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [],
      };

      expect(isFullySigned(tx)).toBe(true);
    });

    it("should handle transactions with pubKey but no sig", () => {
      const tx: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [{ pubKey: "alice-key" } as TransactionSig, { sig: "sig2" }],
      };

      expect(isFullySigned(tx)).toBe(false);
    });
  });
});
