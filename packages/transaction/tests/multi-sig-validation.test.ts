import { describe, it, expect } from "vitest";
import { collectSignatures, mergeSignatures } from "../src/multi-sig";
import type { PartiallySignedTransaction, TransactionSig, TransactionFullSig } from "@pact-toolbox/types";
import { isFullySignedTransaction as isFullySigned } from "@pact-toolbox/signers";
import { createMockSigner } from "./test-helpers";

describe("Multi-Signature Validation Tests", () => {
  describe("collectSignatures validation", () => {
    it("should correctly map signatures to their corresponding signers", async () => {
      // Create a transaction with 3 signers
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [
            { pubKey: "alice-key", clist: [{ name: "coin.TRANSFER", args: ["alice", "bob", 10.0] }] },
            { pubKey: "bob-key", clist: [{ name: "coin.GAS" }] },
            { pubKey: "charlie-key", clist: [{ name: "coin.TRANSFER", args: ["charlie", "dave", 5.0] }] },
          ],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: undefined },
          { pubKey: "charlie-key", sig: undefined },
        ],
      };

      // Create signers that return specific signatures
      const alicesigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "alice-key", address: "k:alice-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: "alice-sig-12345" },
            { pubKey: "bob-key", sig: undefined },
            { pubKey: "charlie-key", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const bobsigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "bob-key", address: "k:bob-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: undefined },
            { pubKey: "bob-key", sig: "bob-sig-67890" },
            { pubKey: "charlie-key", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const charliesigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "charlie-key", address: "k:charlie-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: undefined },
            { pubKey: "bob-key", sig: undefined },
            { pubKey: "charlie-key", sig: "charlie-sig-11111" },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const signedTx = await collectSignatures(tx, [alicesigner, bobsigner, charliesigner]);

      // Verify all signatures are collected
      expect(signedTx.sigs).toHaveLength(3);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-sig-12345", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "bob-sig-67890", pubKey: "bob-key" });
      expect(signedTx.sigs[2]).toEqual({ sig: "charlie-sig-11111", pubKey: "charlie-key" });

      // Verify hash is preserved
      expect(signedTx.hash).toBe("test-hash");
      expect(signedTx.cmd).toBe(tx.cmd);
    });

    it("should handle signers that sign multiple indices", async () => {
      // Transaction where one signer controls multiple signers
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [
            { pubKey: "alice-key", clist: [{ name: "coin.TRANSFER", args: ["alice", "bob", 10.0] }] },
            { pubKey: "alice-key", clist: [{ name: "coin.GAS" }] }, // Same key, different capabilities
            { pubKey: "bob-key", clist: [{ name: "coin.TRANSFER", args: ["bob", "charlie", 5.0] }] },
          ],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "alice-key", sig: undefined },
          { pubKey: "bob-key", sig: undefined },
        ],
      };

      const alicesigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "alice-key", address: "k:alice-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: "alice-sig-for-transfer" },
            { pubKey: "alice-key", sig: "alice-sig-for-gas" },
            { pubKey: "bob-key", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const bobsigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "bob-key", address: "k:bob-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: undefined },
            { pubKey: "alice-key", sig: undefined },
            { pubKey: "bob-key", sig: "bob-sig-for-transfer" },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const signedTx = await collectSignatures(tx, [alicesigner, bobsigner]);

      // Verify all signatures are correctly placed
      expect(signedTx.sigs).toHaveLength(3);
      expect(signedTx.sigs[0]).toEqual({ sig: "alice-sig-for-transfer", pubKey: "alice-key" });
      expect(signedTx.sigs[1]).toEqual({ sig: "alice-sig-for-gas", pubKey: "alice-key" });
      expect(signedTx.sigs[2]).toEqual({ sig: "bob-sig-for-transfer", pubKey: "bob-key" });
    });

    it("should validate missing signatures correctly", async () => {
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

      // Only provide alice signer
      const alicesigner: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "alice-key", address: "k:alice-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "alice-key", sig: "alice-sig" },
            { pubKey: "bob-key", sig: undefined },
            { pubKey: "charlie-key", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      await expect(collectSignatures(tx, [alicesigner])).rejects.toThrow(
        "Missing signatures from signers at indices: 1, 2",
      );
    });
  });

  describe("mergeSignatures validation", () => {
    it("should correctly merge non-overlapping signatures", () => {
      const baseTx = {
        cmd: JSON.stringify({ signers: [{ pubKey: "alice" }, { pubKey: "bob" }, { pubKey: "charlie" }] }),
        hash: "same-hash",
      };

      const tx1: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: "alice-sig" },
          { pubKey: "bob", sig: undefined },
          { pubKey: "charlie", sig: undefined },
        ],
      };

      const tx2: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: undefined },
          { pubKey: "bob", sig: "bob-sig" },
          { pubKey: "charlie", sig: undefined },
        ],
      };

      const tx3: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: undefined },
          { pubKey: "bob", sig: undefined },
          { pubKey: "charlie", sig: "charlie-sig" },
        ],
      };

      const merged = mergeSignatures(tx1, tx2, tx3);

      expect(merged.sigs).toHaveLength(3);
      expect(merged.sigs[0]).toEqual({ pubKey: "alice", sig: "alice-sig" });
      expect(merged.sigs[1]).toEqual({ pubKey: "bob", sig: "bob-sig" });
      expect(merged.sigs[2]).toEqual({ pubKey: "charlie", sig: "charlie-sig" });
    });

    it("should preserve first valid signature when overlapping", () => {
      const baseTx = {
        cmd: JSON.stringify({ signers: [{ pubKey: "alice" }, { pubKey: "bob" }] }),
        hash: "same-hash",
      };

      const tx1: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: "alice-sig-1" },
          { pubKey: "bob", sig: "bob-sig-1" },
        ],
      };

      const tx2: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: "alice-sig-2" }, // Different sig
          { pubKey: "bob", sig: "bob-sig-2" }, // Different sig
        ],
      };

      const merged = mergeSignatures(tx1, tx2);

      // First signatures should win
      expect(merged.sigs[0]).toEqual({ pubKey: "alice", sig: "alice-sig-1" });
      expect(merged.sigs[1]).toEqual({ pubKey: "bob", sig: "bob-sig-1" });
    });

    it("should handle partial signatures correctly", () => {
      const baseTx = {
        cmd: JSON.stringify({ signers: [{ pubKey: "alice" }, { pubKey: "bob" }] }),
        hash: "same-hash",
      };

      // Transaction with partial signatures (pubKey but no sig)
      const tx1: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice", sig: "alice-sig" },
          { pubKey: "bob" } as TransactionSig, // Partial sig
        ],
      };

      const tx2: PartiallySignedTransaction = {
        ...baseTx,
        sigs: [
          { pubKey: "alice" } as TransactionSig, // Partial sig
          { pubKey: "bob", sig: "bob-sig" },
        ],
      };

      const merged = mergeSignatures(tx1, tx2);

      expect(merged.sigs[0]).toEqual({ pubKey: "alice", sig: "alice-sig" });
      expect(merged.sigs[1]).toEqual({ pubKey: "bob", sig: "bob-sig" });
    });
  });

  describe("isFullySigned validation", () => {
    it("should correctly identify fully signed transactions", () => {
      const fullySigned: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [
          { sig: "sig1" } as TransactionFullSig,
          { sig: "sig2" } as TransactionFullSig,
          { sig: "sig3" } as TransactionFullSig,
        ],
      };

      expect(isFullySigned(fullySigned)).toBe(true);
    });

    it("should correctly identify partially signed transactions", () => {
      const partiallySigned: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [
          { sig: "sig1" } as TransactionFullSig,
          { pubKey: "key2" } as TransactionSig, // No sig
          { sig: "sig3" } as TransactionFullSig,
        ],
      };

      expect(isFullySigned(partiallySigned)).toBe(false);
    });

    it("should handle mixed signature types", () => {
      const mixedSigs: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [
          { sig: "sig1", pubKey: "key1" }, // Full sig with pubKey
          { pubKey: "key2" }, // Partial sig
          { sig: "sig3" }, // Full sig without pubKey
        ] as TransactionSig[],
      };

      expect(isFullySigned(mixedSigs)).toBe(false);
    });

    it("should handle empty signature array", () => {
      const noSigs: PartiallySignedTransaction = {
        cmd: "{}",
        hash: "hash",
        sigs: [],
      };

      // Empty array is considered fully signed
      expect(isFullySigned(noSigs)).toBe(true);
    });
  });

  describe("signature array integrity", () => {
    it("should maintain correct signature order", async () => {
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [
            { pubKey: "key-1" },
            { pubKey: "key-2" },
            { pubKey: "key-3" },
            { pubKey: "key-4" },
            { pubKey: "key-5" },
          ],
        }),
        hash: "test-hash",
        sigs: [
          { pubKey: "key-1", sig: undefined },
          { pubKey: "key-2", sig: undefined },
          { pubKey: "key-3", sig: undefined },
          { pubKey: "key-4", sig: undefined },
          { pubKey: "key-5", sig: undefined },
        ],
      };

      // Create signers for keys 2 and 4 only
      const signer2: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "key-2", address: "k:key-2" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "key-1", sig: undefined },
            { pubKey: "key-2", sig: "sig-2" },
            { pubKey: "key-3", sig: undefined },
            { pubKey: "key-4", sig: undefined },
            { pubKey: "key-5", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const signer4: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "key-4", address: "k:key-4" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [
            { pubKey: "key-1", sig: undefined },
            { pubKey: "key-2", sig: undefined },
            { pubKey: "key-3", sig: undefined },
            { pubKey: "key-4", sig: "sig-4" },
            { pubKey: "key-5", sig: undefined },
          ],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      // This should fail because not all signatures are collected
      await expect(collectSignatures(tx, [signer2, signer4])).rejects.toThrow(
        "Missing signatures from signers at indices: 0, 2, 4",
      );
    });

    it("should convert hash to string if needed", async () => {
      const tx: PartiallySignedTransaction = {
        cmd: JSON.stringify({
          signers: [{ pubKey: "alice-key" }],
        }),
        hash: new Uint8Array([1, 2, 3, 4, 5]), // Uint8Array hash
        sigs: [{ pubKey: "alice-key", sig: undefined }],
      };

      const signer: signer = {
        isInstalled: vi.fn().mockReturnValue(true),
        getAccount: vi.fn().mockResolvedValue({ publicKey: "alice-key", address: "k:alice-key" }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ id: "test", networkId: "development", name: "Test", url: "http://localhost" }),
        sign: vi.fn().mockResolvedValue({
          ...tx,
          sigs: [{ pubKey: "alice-key", sig: "alice-sig" }],
        }),
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockResolvedValue(true),
      };

      const signedTx = await collectSignatures(tx, [signer]);

      // Hash should be converted to base64url string
      expect(typeof signedTx.hash).toBe("string");
      expect(signedTx.hash).toMatch(/^[A-Za-z0-9_-]+$/); // base64url pattern
    });
  });
});
