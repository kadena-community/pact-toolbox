import { describe, it, expect, vi } from "vitest";
import { collectSignatures, mergeSignatures, isFullySigned } from "../src/multi-sig";
import type { Wallet } from "@pact-toolbox/wallet-core";
import type { PartiallySignedTransaction, TransactionSig } from "@pact-toolbox/types";

// Mock wallet factory
function createMockWallet(publicKey: string, canSign = true): Wallet {
  return {
    isInstalled: vi.fn().mockReturnValue(true),
    getAccount: vi.fn().mockResolvedValue({
      publicKey,
      address: `k:${publicKey}`,
    }),
    getNetwork: vi.fn().mockResolvedValue({
      id: "test",
      networkId: "development",
      name: "Test Network",
      url: "http://localhost:8080",
    }),
    sign: vi.fn().mockImplementation(async (tx: PartiallySignedTransaction) => {
      if (!canSign) {
        throw new Error("Wallet cannot sign");
      }

      const cmd = JSON.parse(tx.cmd);
      const signers = cmd.signers || [];

      // Create signatures only for signers this wallet controls
      const sigs: TransactionSig[] = signers.map((signer: any, index: number) => {
        if (signer.pubKey === publicKey) {
          return { sig: `${publicKey}-signature-${index}`, pubKey: signer.pubKey };
        }
        return tx.sigs?.[index] || { pubKey: signer.pubKey, sig: undefined };
      });

      return {
        ...tx,
        sigs,
      };
    }),
    connect: vi.fn().mockResolvedValue({
      publicKey,
      address: `k:${publicKey}`,
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockResolvedValue(true),
  };
}

describe("Multi-Signature Transaction Support", () => {
  describe("collectSignatures", () => {
    it("should collect signatures from all wallets", async () => {
      const aliceWallet = createMockWallet("alice-key");
      const bobWallet = createMockWallet("bob-key");

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

    it("should work with wallets in any order", async () => {
      const aliceWallet = createMockWallet("alice-key");
      const bobWallet = createMockWallet("bob-key");

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

      // Test with reversed wallet order
      const signedTx = await collectSignatures(tx, [bobWallet, aliceWallet]);

      expect(signedTx.sigs).toHaveLength(2);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-key-signature-0", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "bob-key-signature-1", pubKey: "bob-key" });
    });

    it("should throw error if required signatures are missing", async () => {
      const aliceWallet = createMockWallet("alice-key");
      // Bob wallet is missing

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

    it("should handle multiple signers with same wallet", async () => {
      const aliceWallet = createMockWallet("alice-key");

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
