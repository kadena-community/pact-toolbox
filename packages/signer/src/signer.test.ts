import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createKeyPairSignerFromBase16PrivateKey,
  createNoopSigner,
  createSignableMessage,
  finalizeTransaction,
  isMessageSigner,
  isPactCommandSigner,
  isKeyPairSigner,
  KeyPairSigner,
  MessageSigner,
  PactCommandSigner,
  SignableMessage,
  PactCommand,
  PartiallySignedPactCommand
} from './index';
import { base16 } from '@pact-toolbox/crypto';

// Mock crypto for deterministic tests
vi.mock('@pact-toolbox/crypto', async () => {
  const actual = await vi.importActual('@pact-toolbox/crypto');
  return {
    ...actual,
    generateKeyPair: vi.fn(),
    createKeyPairFromPrivateKeyBytes: vi.fn(),
    signBytes: vi.fn(),
    blake2b256: vi.fn()
  };
});

describe('@pact-toolbox/signer', () => {
  const mockPublicKey = 'a'.repeat(64);
  const mockPrivateKey = 'b'.repeat(64);
  const mockSignature = 'c'.repeat(128);
  const mockKeyPair = {
    publicKey: { type: 'public' },
    privateKey: { type: 'private' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('KeyPairSigner', () => {
    describe('generateKeyPairSigner', () => {
      test('generates new keypair signer', async () => {
        vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
        vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);

        const signer = await generateKeyPairSigner();

        expect(signer).toBeDefined();
        expect(signer.address).toBe(mockPublicKey);
        expect(generateKeyPair).toHaveBeenCalled();
      });

      test('provides access to keypair', async () => {
        vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
        
        const signer = await generateKeyPairSigner();
        const keyPair = signer.getKeyPair();

        expect(keyPair).toBe(mockKeyPair);
      });
    });

    describe('createKeyPairSignerFromBytes', () => {
      test('creates signer from 64-byte keypair', async () => {
        const keypairBytes = new Uint8Array(64);
        keypairBytes.fill(1, 0, 32);  // Private key
        keypairBytes.fill(2, 32, 64); // Public key

        vi.mocked(createKeyPairFromBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(base16.encode).mockReturnValue(mockPublicKey);

        const signer = await createKeyPairSignerFromBytes(keypairBytes);

        expect(signer.address).toBe(mockPublicKey);
        expect(createKeyPairFromBytes).toHaveBeenCalledWith(keypairBytes);
      });

      test('throws on invalid byte length', async () => {
        const invalidBytes = new Uint8Array(32);

        await expect(createKeyPairSignerFromBytes(invalidBytes))
          .rejects.toThrow('Expected 64 bytes');
      });
    });

    describe('createKeyPairSignerFromPrivateKeyBytes', () => {
      test('creates signer from 32-byte private key', async () => {
        const privateKeyBytes = new Uint8Array(32);
        privateKeyBytes.fill(1);

        vi.mocked(createKeyPairFromPrivateKeyBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(getPublicKeyFromPrivateKey).mockResolvedValue(new Uint8Array(32));
        vi.mocked(base16.encode).mockReturnValue(mockPublicKey);

        const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);

        expect(signer.address).toBe(mockPublicKey);
        expect(createKeyPairFromPrivateKeyBytes).toHaveBeenCalledWith(privateKeyBytes);
      });

      test('throws on invalid byte length', async () => {
        const invalidBytes = new Uint8Array(64);

        await expect(createKeyPairSignerFromPrivateKeyBytes(invalidBytes))
          .rejects.toThrow('Expected 32 bytes');
      });
    });

    describe('createKeyPairSignerFromBase16PrivateKey', () => {
      test('creates signer from hex private key', async () => {
        const privateKeyHex = '1'.repeat(64);
        const privateKeyBytes = new Uint8Array(32);

        vi.mocked(base16.decode).mockReturnValue(privateKeyBytes);
        vi.mocked(createKeyPairFromPrivateKeyBytes).mockResolvedValue(mockKeyPair);
        vi.mocked(getPublicKeyFromPrivateKey).mockResolvedValue(new Uint8Array(32));
        vi.mocked(base16.encode).mockReturnValue(mockPublicKey);

        const signer = await createKeyPairSignerFromBase16PrivateKey(privateKeyHex);

        expect(signer.address).toBe(mockPublicKey);
        expect(base16.decode).toHaveBeenCalledWith(privateKeyHex);
      });

      test('throws on invalid hex format', async () => {
        const invalidHex = 'xyz';

        vi.mocked(base16.decode).mockImplementation(() => {
          throw new Error('Invalid hex');
        });

        await expect(createKeyPairSignerFromBase16PrivateKey(invalidHex))
          .rejects.toThrow('Invalid hex');
      });
    });
  });

  describe('Message Signing', () => {
    let signer: KeyPairSigner;

    beforeEach(async () => {
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      signer = await generateKeyPairSigner();
    });

    test('signs single message', async () => {
      const message = createSignableMessage('Hello, Kadena!');
      
      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const [signatures] = await signer.signMessages([message]);

      expect(signatures).toHaveProperty(mockPublicKey);
      expect(signatures[mockPublicKey]).toBe(mockSignature);
      expect(signBytes).toHaveBeenCalledWith(
        mockKeyPair.privateKey,
        message.message
      );
    });

    test('signs multiple messages', async () => {
      const messages = [
        createSignableMessage('Message 1'),
        createSignableMessage('Message 2'),
        createSignableMessage('Message 3')
      ];

      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
      signatures.forEach(sig => {
        expect(sig[mockPublicKey]).toBe(mockSignature);
      });
    });

    test('handles different message encodings', async () => {
      const messages = [
        createSignableMessage('UTF-8 Text'),
        createSignableMessage('ASCII Text', 'ascii'),
        createSignableMessage(new Uint8Array([1, 2, 3]))
      ];

      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
    });
  });

  describe('Pact Command Signing', () => {
    let signer: KeyPairSigner;
    const mockCommand: PactCommand = {
      payload: {
        exec: {
          code: '(coin.transfer "alice" "bob" 10.0)',
          data: {}
        }
      },
      meta: {
        chainId: '0',
        sender: 'alice',
        gasLimit: 1000,
        gasPrice: 0.00001,
        ttl: 600,
        creationTime: 1234567890
      },
      signers: [{
        pubKey: mockPublicKey,
        scheme: 'ED25519'
      }],
      networkId: 'development',
      nonce: 'test-nonce'
    };

    beforeEach(async () => {
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      signer = await generateKeyPairSigner();
    });

    test('signs single Pact command', async () => {
      const mockHash = new Uint8Array(32);
      mockHash.fill(5);

      vi.mocked(blake2b256).mockReturnValue(mockHash);
      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const [signedCommand] = await signer.signPactCommands([mockCommand]);

      expect(signedCommand.sigs).toHaveLength(1);
      expect(signedCommand.sigs[0]).toEqual({ sig: mockSignature });
      expect(blake2b256).toHaveBeenCalled();
      expect(signBytes).toHaveBeenCalledWith(mockKeyPair.privateKey, mockHash);
    });

    test('signs multiple Pact commands', async () => {
      const commands = [mockCommand, mockCommand, mockCommand];

      vi.mocked(blake2b256).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const signedCommands = await signer.signPactCommands(commands);

      expect(signedCommands).toHaveLength(3);
      expect(blake2b256).toHaveBeenCalledTimes(3);
      expect(signBytes).toHaveBeenCalledTimes(3);
      signedCommands.forEach(cmd => {
        expect(cmd.sigs).toHaveLength(1);
        expect(cmd.sigs[0].sig).toBe(mockSignature);
      });
    });

    test('preserves command structure', async () => {
      vi.mocked(blake2b256).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      const [signedCommand] = await signer.signPactCommands([mockCommand]);

      expect(signedCommand.payload).toEqual(mockCommand.payload);
      expect(signedCommand.meta).toEqual(mockCommand.meta);
      expect(signedCommand.signers).toEqual(mockCommand.signers);
      expect(signedCommand.networkId).toEqual(mockCommand.networkId);
      expect(signedCommand.nonce).toEqual(mockCommand.nonce);
    });
  });

  describe('NoopSigner', () => {
    test('creates noop signer', () => {
      const signer = createNoopSigner();

      expect(signer).toBeDefined();
      expect(isMessageSigner(signer)).toBe(true);
      expect(isPactCommandSigner(signer)).toBe(true);
    });

    test('returns empty signatures for messages', async () => {
      const signer = createNoopSigner();
      const messages = [
        createSignableMessage('Test 1'),
        createSignableMessage('Test 2')
      ];

      const signatures = await signer.signMessages(messages);

      expect(signatures).toHaveLength(2);
      signatures.forEach(sig => {
        expect(Object.keys(sig)).toHaveLength(1);
        expect(Object.values(sig)[0]).toBe('');
      });
    });

    test('returns empty signatures for Pact commands', async () => {
      const signer = createNoopSigner();
      const commands = [mockCommand];

      const signedCommands = await signer.signPactCommands(commands);

      expect(signedCommands).toHaveLength(1);
      expect(signedCommands[0].sigs).toHaveLength(1);
      expect(signedCommands[0].sigs[0]).toEqual({ sig: '' });
    });
  });

  describe('Utility Functions', () => {
    describe('createSignableMessage', () => {
      test('creates message from string', () => {
        const msg = createSignableMessage('Hello');

        expect(msg.message).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(msg.message)).toBe('Hello');
      });

      test('creates message from bytes', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const msg = createSignableMessage(bytes);

        expect(msg.message).toBe(bytes);
      });

      test('handles different encodings', () => {
        const msg1 = createSignableMessage('Test', 'utf8');
        const msg2 = createSignableMessage('Test', 'ascii');

        expect(msg1.message).toBeInstanceOf(Uint8Array);
        expect(msg2.message).toBeInstanceOf(Uint8Array);
      });
    });

    describe('finalizeTransaction', () => {
      test('finalizes partially signed command', () => {
        const partiallySignedCommand: PartiallySignedPactCommand = {
          ...mockCommand,
          sigs: [{ sig: mockSignature }]
        };

        const transaction = finalizeTransaction(partiallySignedCommand);

        expect(transaction.cmd).toBeDefined();
        expect(transaction.hash).toBeDefined();
        expect(transaction.sigs).toEqual(partiallySignedCommand.sigs);
      });

      test('creates proper command string', () => {
        const partiallySignedCommand: PartiallySignedPactCommand = {
          ...mockCommand,
          sigs: [{ sig: mockSignature }]
        };

        const transaction = finalizeTransaction(partiallySignedCommand);
        const cmd = JSON.parse(transaction.cmd);

        expect(cmd.payload).toEqual(mockCommand.payload);
        expect(cmd.meta).toEqual(mockCommand.meta);
        expect(cmd.signers).toEqual(mockCommand.signers);
      });
    });
  });

  describe('Type Guards', () => {
    test('isMessageSigner identifies message signers', () => {
      const messageSigner: MessageSigner = {
        signMessages: async () => []
      };

      const notMessageSigner = {
        signPactCommands: async () => []
      };

      expect(isMessageSigner(messageSigner)).toBe(true);
      expect(isMessageSigner(notMessageSigner)).toBe(false);
      expect(isMessageSigner(null)).toBe(false);
      expect(isMessageSigner(undefined)).toBe(false);
    });

    test('isPactCommandSigner identifies Pact command signers', () => {
      const pactSigner: PactCommandSigner = {
        signPactCommands: async () => []
      };

      const notPactSigner = {
        signMessages: async () => []
      };

      expect(isPactCommandSigner(pactSigner)).toBe(true);
      expect(isPactCommandSigner(notPactSigner)).toBe(false);
      expect(isPactCommandSigner(null)).toBe(false);
      expect(isPactCommandSigner(undefined)).toBe(false);
    });

    test('isKeyPairSigner identifies keypair signers', async () => {
      const keyPairSigner = await generateKeyPairSigner();
      const noopSigner = createNoopSigner();
      const partialSigner = {
        signMessages: async () => []
      };

      expect(isKeyPairSigner(keyPairSigner)).toBe(true);
      expect(isKeyPairSigner(noopSigner)).toBe(false);
      expect(isKeyPairSigner(partialSigner)).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    test('complete signing flow', async () => {
      // Setup
      vi.mocked(generateKeyPair).mockResolvedValue(mockKeyPair);
      vi.mocked(exportBase16Key).mockResolvedValue(mockPublicKey);
      vi.mocked(blake2b256).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes).mockResolvedValue(base16.decode(mockSignature));

      // Create signer
      const signer = await generateKeyPairSigner();

      // Create and sign command
      const command: PactCommand = {
        payload: {
          exec: {
            code: '(my-module.transfer "alice" "bob" 10.0)',
            data: { metadata: { note: 'Test transfer' } }
          }
        },
        meta: {
          chainId: '0',
          sender: 'gas-payer',
          gasLimit: 10000,
          gasPrice: 0.00001,
          ttl: 600,
          creationTime: Date.now()
        },
        signers: [{
          pubKey: signer.address,
          scheme: 'ED25519',
          clist: [
            { name: 'my-module.TRANSFER', args: ['alice', 'bob', 10.0] }
          ]
        }],
        networkId: 'testnet04',
        nonce: Date.now().toString()
      };

      const [signedCommand] = await signer.signPactCommands([command]);
      const transaction = finalizeTransaction(signedCommand);

      // Verify result
      expect(transaction.cmd).toBeDefined();
      expect(transaction.hash).toBeDefined();
      expect(transaction.sigs).toHaveLength(1);
      expect(transaction.sigs[0].sig).toBe(mockSignature);
    });

    test('multi-signature scenario', async () => {
      // Create multiple signers
      const signer1 = await generateKeyPairSigner();
      const signer2 = await generateKeyPairSigner();

      vi.mocked(exportBase16Key)
        .mockResolvedValueOnce('pubkey1')
        .mockResolvedValueOnce('pubkey2');

      // Create command requiring multiple signatures
      const command: PactCommand = {
        payload: {
          exec: {
            code: '(my-module.multi-sig-op)',
            data: {}
          }
        },
        meta: {
          chainId: '0',
          sender: 'multi-sig'
        },
        signers: [
          { pubKey: 'pubkey1', scheme: 'ED25519' },
          { pubKey: 'pubkey2', scheme: 'ED25519' }
        ],
        networkId: 'development'
      };

      // Sign with both signers
      vi.mocked(blake2b256).mockReturnValue(new Uint8Array(32));
      vi.mocked(signBytes)
        .mockResolvedValueOnce(base16.decode('sig1'))
        .mockResolvedValueOnce(base16.decode('sig2'));

      const [partial1] = await signer1.signPactCommands([command]);
      const [partial2] = await signer2.signPactCommands([command]);

      // Combine signatures
      const combined: PartiallySignedPactCommand = {
        ...command,
        sigs: [...partial1.sigs, ...partial2.sigs]
      };

      const transaction = finalizeTransaction(combined);

      expect(transaction.sigs).toHaveLength(2);
      expect(transaction.sigs[0].sig).toBe('sig1');
      expect(transaction.sigs[1].sig).toBe('sig2');
    });
  });
});