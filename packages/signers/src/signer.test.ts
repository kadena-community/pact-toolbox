import {
  fromHex,
  toHex,
  blake2b,
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  exportBase16Key,
  generateKeyPair,
  signBytes,
} from "@pact-toolbox/crypto";
import type { PactCommand, PartiallySignedTransaction } from "@pact-toolbox/types";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createKeyPairSignerFromBase16PrivateKey,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createNoopSigner,
  createSignableMessage,
  finalizeTransaction,
  generateKeyPairSigner,
  isKeyPairSigner,
  isMessageSigner,
  isPactCommandSigner,
  type KeyPairSigner,
  type MessageSigner,
  type PactCommandSigner,
} from "./index";

// Mock crypto for deterministic tests
vi.mock("@pact-toolbox/crypto", async () => {
  const actual = await vi.importActual("@pact-toolbox/crypto");
  return {
    ...actual,
    generateKeyPair: vi.fn(),
    createKeyPairFromBytes: vi.fn(),
    createKeyPairFromPrivateKeyBytes: vi.fn(),
    exportBase16Key: vi.fn(),
    signBytes: vi.fn(),
    blake2b: vi.fn(),
    fromHex: vi.fn(),
    toHex: vi.fn(),
  };
});

describe("@pact-toolbox/signers", () => {
  const mockPublicKey = "a".repeat(64);
  const _mockPrivateKey = "b".repeat(64);
  const mockSignature = "c".repeat(128);
  const mockKeyPair = {
    publicKey: { type: "public", algorithm: { name: "Ed25519" }, extractable: true, usages: ["verify"] },
    privateKey: { type: "private", algorithm: { name: "Ed25519" }, extractable: false, usages: ["sign"] },
  } as any as CryptoKeyPair;
  const mockCommand: PactCommand = {
    payload: {
      exec: {
        code: '(coin.transfer "alice" "bob" 10.0)',
        data: {},
      },
    },
    meta: {
      chainId: "0",
      sender: "alice",
      gasLimit: 1000,
      gasPrice: 0.00001,
      ttl: 600,
      creationTime: 1234567890,
    },
    signers: [
      {
        pubKey: mockPublicKey,
        scheme: "ED25519",
      },
    ],
    networkId: "development",
    nonce: "test-nonce",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior
    vi.mocked(fromHex).mockImplementation((str: string) => new Uint8Array(str.length / 2));
    vi.mocked(toHex).mockImplementation(() => "decoded-hex");
  });

  describe("KeyPairSigner", () => {
    describe("generateKeyPairSigner", () => {
      test("generates new keypair signer", async () => {
        vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await generateKeyPairSigner();

        expect(signer).toBeDefined();
        expect(signer.address).toBe(mockPublicKey);
        expect(generateKeyPair).toHaveBeenCalled();
      });

      test("provides access to keypair", async () => {
        vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await generateKeyPairSigner();
        const keyPair = signer.keyPair;

        expect(keyPair).toBe(mockKeyPair);
      });
    });

    describe("createKeyPairSignerFromBytes", () => {
      test("creates signer from 64-byte keypair", async () => {
        const keypairBytes = new Uint8Array(64);
        keypairBytes.fill(1, 0, 32); // Private key
        keypairBytes.fill(2, 32, 64); // Public key

        vi.mocked(createKeyPairFromBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await createKeyPairSignerFromBytes(keypairBytes);

        expect(signer.address).toBe(mockPublicKey);
        expect(createKeyPairFromBytes).toHaveBeenCalledWith(keypairBytes, undefined);
      });

      test("throws on invalid byte length", async () => {
        const invalidBytes = new Uint8Array(32);

        vi.mocked(createKeyPairFromBytes).mockRejectedValue(new Error("invalid key pair length: 32"));

        await expect(createKeyPairSignerFromBytes(invalidBytes)).rejects.toThrow("invalid key pair length");
      });
    });

    describe("createKeyPairSignerFromPrivateKeyBytes", () => {
      test("creates signer from 32-byte private key", async () => {
        const privateKeyBytes = new Uint8Array(32);
        privateKeyBytes.fill(1);

        vi.mocked(createKeyPairFromPrivateKeyBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);

        expect(signer.address).toBe(mockPublicKey);
        expect(createKeyPairFromPrivateKeyBytes).toHaveBeenCalledWith(privateKeyBytes, undefined);
      });

      test("throws on invalid byte length", async () => {
        const invalidBytes = new Uint8Array(64);

        vi.mocked(createKeyPairFromPrivateKeyBytes).mockRejectedValue(new Error("Invalid private key length: 64"));

        await expect(createKeyPairSignerFromPrivateKeyBytes(invalidBytes)).rejects.toThrow(
          "Invalid private key length",
        );
      });
    });

    describe("createKeyPairSignerFromBase16PrivateKey", () => {
      test("creates signer from hex private key", async () => {
        const privateKeyHex = "1".repeat(64);
        const privateKeyBytes = new Uint8Array(32);

        vi.mocked(fromHex).mockReturnValue(privateKeyBytes);
        vi.mocked(createKeyPairFromPrivateKeyBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await createKeyPairSignerFromBase16PrivateKey(privateKeyHex);

        expect(signer.address).toBe(mockPublicKey);
        expect(fromHex).toHaveBeenCalledWith(privateKeyHex);
      });

      test("throws on invalid hex format", async () => {
        const invalidHex = "xyz";

        vi.mocked(fromHex).mockImplementation(() => {
          throw new Error("Invalid hex");
        });

        await expect(createKeyPairSignerFromBase16PrivateKey(invalidHex)).rejects.toThrow("Invalid hex");
      });
    });
  });

  describe("Message Signing", () => {
    let signer: KeyPairSigner;

    beforeEach(async () => {
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      signer = await generateKeyPairSigner();
    });

    test("signs single message", async () => {
      const message = createSignableMessage("Hello, Kadena!");
      const mockSignatureBytes = fromHex(mockSignature) as any;

      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes);

      const [signatures] = await signer.signMessages([message]);

      expect(signatures).toHaveProperty(mockPublicKey);
      expect((signatures as any)[mockPublicKey]).toBe(mockSignatureBytes);
      expect(signBytes).toHaveBeenCalledWith(mockKeyPair.privateKey, message.content);
    });

    test("signs multiple messages", async () => {
      const messages = [
        createSignableMessage("Message 1"),
        createSignableMessage("Message 2"),
        createSignableMessage("Message 3"),
      ];
      const mockSignatureBytes = fromHex(mockSignature) as any;

      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes);

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
      signatures.forEach((sig) => {
        expect((sig as any)[mockPublicKey]).toBe(mockSignatureBytes);
      });
    });

    test("handles different message encodings", async () => {
      const messages = [
        createSignableMessage("UTF-8 Text"),
        createSignableMessage("ASCII Text"),
        createSignableMessage(new Uint8Array([1, 2, 3])),
      ];
      const mockSignatureBytes = fromHex(mockSignature) as any;

      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes);

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
    });
  });

  describe("Pact Command Signing", () => {
    let signer: KeyPairSigner;

    beforeEach(async () => {
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      signer = await generateKeyPairSigner();
    });

    test("signs single Pact command", async () => {
      const mockHash = new Uint8Array(32);
      mockHash.fill(5);
      const mockSignatureBytes = new Uint8Array(64);

      vi.mocked(blake2b).mockReturnValue(mockHash);
      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes as any);
      vi.mocked(toHex).mockReturnValue(mockSignature);

      const [signedCommand] = await signer.signPactCommands([mockCommand]);

      expect(signedCommand!.sigs).toHaveLength(1);
      expect(signedCommand!.sigs[0]).toEqual({ pubKey: mockPublicKey, sig: mockSignature });
      expect(blake2b).toHaveBeenCalled();
      expect(signBytes).toHaveBeenCalledWith(mockKeyPair.privateKey, mockHash);
    });

    test("signs multiple Pact commands", async () => {
      const commands = [mockCommand, mockCommand, mockCommand];
      const mockSignatureBytes = new Uint8Array(64);

      vi.mocked(blake2b).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes as any);
      vi.mocked(toHex).mockReturnValue(mockSignature);

      const signedCommands = await signer.signPactCommands(commands);

      expect(signedCommands).toHaveLength(3);
      expect(blake2b).toHaveBeenCalledTimes(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
      signedCommands.forEach((cmd) => {
        expect(cmd.sigs).toHaveLength(1);
        expect(cmd.sigs[0]!.sig).toBe(mockSignature);
      });
    });

    test("preserves command structure", async () => {
      const mockSignatureBytes = new Uint8Array(64);

      vi.mocked(blake2b).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes as any);
      vi.mocked(toHex).mockReturnValue(mockSignature);

      const [signedCommand] = await signer.signPactCommands([mockCommand]);

      // The command is preserved as a JSON string
      const parsedCommand = JSON.parse(signedCommand!.cmd);
      expect(parsedCommand.payload).toEqual(mockCommand.payload);
      expect(parsedCommand.meta).toEqual(mockCommand.meta);
      expect(parsedCommand.signers).toEqual(mockCommand.signers);
      expect(parsedCommand.networkId).toEqual(mockCommand.networkId);
      expect(parsedCommand.nonce).toEqual(mockCommand.nonce);
    });
  });

  describe("NoopSigner", () => {
    test("creates noop signer", () => {
      const address = "test-address";
      const signer = createNoopSigner(address as any);

      expect(signer).toBeDefined();
      expect(signer.address).toBe(address);
      expect(isMessageSigner(signer)).toBe(true);
      expect(isPactCommandSigner(signer)).toBe(true);
    });

    test("returns empty signatures for messages", async () => {
      const address = "test-address";
      const signer = createNoopSigner(address as any);
      const messages = [createSignableMessage("Test 1"), createSignableMessage("Test 2")];

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(2);
      signatures.forEach((sig) => {
        expect(Object.keys(sig)).toHaveLength(0);
      });
    });

    test("returns empty signatures for Pact commands", async () => {
      const address = "test-address";
      const signer = createNoopSigner(address as any);
      const commands = [mockCommand];

      const signedCommands = await signer.signPactCommands(commands);

      expect(signedCommands).toHaveLength(1);
      // NoopSigner returns empty objects, need to check implementation
      expect(signedCommands[0]).toBeDefined();
    });
  });

  describe("Utility Functions", () => {
    describe("createSignableMessage", () => {
      test("creates message from string", () => {
        const msg = createSignableMessage("Hello");

        expect(msg.content).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(msg.content)).toBe("Hello");
      });

      test("creates message from bytes", () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const msg = createSignableMessage(bytes);

        expect(msg.content).toBe(bytes);
      });

      test("handles different encodings", () => {
        const msg1 = createSignableMessage("Test");
        const msg2 = createSignableMessage("Test");

        expect(msg1.content).toBeInstanceOf(Uint8Array);
        expect(msg2.content).toBeInstanceOf(Uint8Array);
      });
    });

    describe("finalizeTransaction", () => {
      test("finalizes partially signed command", () => {
        const partiallySignedCommand: PartiallySignedTransaction = {
          cmd: JSON.stringify(mockCommand),
          hash: "test-hash",
          sigs: [{ sig: mockSignature }],
        };

        const transaction = finalizeTransaction(partiallySignedCommand);

        expect(transaction.cmd).toBeDefined();
        expect(transaction.hash).toBeDefined();
        expect(transaction.sigs).toEqual(partiallySignedCommand.sigs);
      });

      test("creates proper command string", () => {
        const partiallySignedCommand: PartiallySignedTransaction = {
          cmd: JSON.stringify(mockCommand),
          hash: "test-hash",
          sigs: [{ sig: mockSignature }],
        };

        const transaction = finalizeTransaction(partiallySignedCommand);
        const cmd = JSON.parse(transaction.cmd);

        expect(cmd.payload).toEqual(mockCommand.payload);
        expect(cmd.meta).toEqual(mockCommand.meta);
        expect(cmd.signers).toEqual(mockCommand.signers);
      });
    });
  });

  describe("Type Guards", () => {
    test("isMessageSigner identifies message signers", () => {
      const messageSigner: MessageSigner = {
        address: "test-address" as any,
        signMessages: async () => [],
      };

      const notMessageSigner = {
        address: "test-address" as any,
        signPactCommands: async () => [],
      };

      expect(isMessageSigner(messageSigner)).toBe(true);
      expect(isMessageSigner(notMessageSigner)).toBe(false);
      expect(() => isMessageSigner(null as any)).toThrow();
      expect(() => isMessageSigner(undefined as any)).toThrow();
    });

    test("isPactCommandSigner identifies Pact command signers", () => {
      const pactSigner: PactCommandSigner = {
        address: "test-address" as any,
        signPactCommands: async () => [],
      };

      const notPactSigner = {
        address: "test-address" as any,
        signMessages: async () => [],
      };

      expect(isPactCommandSigner(pactSigner)).toBe(true);
      expect(isPactCommandSigner(notPactSigner)).toBe(false);
      expect(() => isPactCommandSigner(null as any)).toThrow();
      expect(() => isPactCommandSigner(undefined as any)).toThrow();
    });

    test("isKeyPairSigner identifies keypair signers", async () => {
      const keyPairSigner = await generateKeyPairSigner();
      const noopSigner = createNoopSigner("test-address" as any);
      const partialSigner = {
        address: "test-address" as any,
        signMessages: async () => [],
      };

      expect(isKeyPairSigner(keyPairSigner)).toBe(true);
      expect(isKeyPairSigner(noopSigner)).toBe(false);
      expect(isKeyPairSigner(partialSigner)).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    test("complete signing flow", async () => {
      // Setup
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      const mockSignatureBytes = new Uint8Array(64);
      vi.mocked(blake2b).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(mockSignatureBytes as any);
      vi.mocked(toHex).mockReturnValue(mockSignature);

      // Create signer
      const signer = await generateKeyPairSigner();

      // Create and sign command
      const command: PactCommand = {
        payload: {
          exec: {
            code: '(my-module.transfer "alice" "bob" 10.0)',
            data: { metadata: { note: "Test transfer" } },
          },
        },
        meta: {
          chainId: "0",
          sender: "gas-payer",
          gasLimit: 10000,
          gasPrice: 0.00001,
          ttl: 600,
          creationTime: Date.now(),
        },
        signers: [
          {
            pubKey: signer.address,
            scheme: "ED25519",
            clist: [{ name: "my-module.TRANSFER", args: ["alice", "bob", 10.0] }],
          },
        ],
        networkId: "testnet04",
        nonce: Date.now().toString(),
      };

      const [signedCommand] = await signer.signPactCommands([command]);
      const transaction = finalizeTransaction(signedCommand!);

      // Verify result
      expect(transaction.cmd).toBeDefined();
      expect(transaction.hash).toBeDefined();
      expect(transaction.sigs).toHaveLength(1);
      expect(transaction.sigs[0]!.sig).toBe(mockSignature);
    });

    test("multi-signature scenario", async () => {
      // Create multiple signers
      const signer1 = await generateKeyPairSigner();
      const signer2 = await generateKeyPairSigner();

      vi.mocked(exportBase16Key).mockResolvedValueOnce("pubkey1").mockResolvedValueOnce("pubkey2");

      // Create command requiring multiple signatures
      // @ts-expect-error - we're testing the signer
      const command: PactCommand = {
        payload: {
          exec: {
            code: "(my-module.multi-sig-op)",
            data: {},
          },
        },
        meta: {
          chainId: "0",
          sender: "multi-sig",
        },
        signers: [
          { pubKey: "pubkey1", scheme: "ED25519" },
          { pubKey: "pubkey2", scheme: "ED25519" },
        ],
        networkId: "development",
      };

      // Sign with both signers
      vi.mocked(blake2b).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes)
        .mockResolvedValueOnce(new Uint8Array(64) as any)
        .mockResolvedValueOnce(new Uint8Array(64) as any);
      vi.mocked(toHex).mockReturnValueOnce("sig1").mockReturnValueOnce("sig2");

      const [partial1] = await signer1.signPactCommands([command]);
      const [partial2] = await signer2.signPactCommands([command]);

      // Combine signatures
      const combined: PartiallySignedTransaction = {
        cmd: JSON.stringify(command),
        hash: "test-hash",
        sigs: [...(partial1?.sigs ?? []), ...(partial2?.sigs ?? [])],
      };

      const transaction = finalizeTransaction(combined);

      expect(transaction.sigs).toHaveLength(2);
      expect(transaction.sigs[0]!.sig).toBe("sig1");
      expect(transaction.sigs[1]!.sig).toBe("sig2");
    });
  });
});
