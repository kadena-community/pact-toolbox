import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock uncrypto before importing anything else
vi.mock('uncrypto', () => {
  return {
    default: {
      subtle: {
        generateKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        exportKey: vi.fn(),
        importKey: vi.fn()
      },
      getRandomValues: vi.fn((arr) => {
        // Fill with deterministic values for testing
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256;
        }
        return arr;
      })
    }
  };
});

// Import uncrypto to get mocked instance
import crypto from 'uncrypto';

import {
  // Key generation
  generateKeyPair,
  generateExtractableKeyPair,
  genKeyPair,
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  getPublicKeyFromPrivateKey,
  exportBase16Key,
  
  // Signing and verification
  signBytes,
  verifySignature,
  type SignatureBytes,
  
  // Hashing
  blake2b,
  blake2bBase64Url,
  
  // Simple encodings
  hex,
  base64,
  base64url,
  utf8,
  
  // Kadena specific
  address,
  kAccount,
  isAddress,
  isKAccount,
  
  // Utilities
  fastStableStringify
} from './index';

// Get the mocked crypto for assertions
const mockCrypto = crypto as any;

// Also stub the global crypto for modules that use it directly
vi.stubGlobal('crypto', mockCrypto);

describe('@pact-toolbox/crypto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Key Generation', () => {
    const mockKeyPair = {
      publicKey: { type: 'public', algorithm: { name: 'Ed25519' } },
      privateKey: { type: 'private', algorithm: { name: 'Ed25519' } }
    };

    test('generateKeyPair creates non-extractable keypair', async () => {
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKeyPair);

      const keyPair = await generateKeyPair();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        'Ed25519',
        false, // non-extractable
        ['sign', 'verify']
      );
      expect(keyPair).toBe(mockKeyPair);
    });

    test('generateExtractableKeyPair creates extractable keypair', async () => {
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKeyPair);

      const keyPair = await generateExtractableKeyPair();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        'Ed25519',
        true, // extractable
        ['sign', 'verify']
      );
      expect(keyPair).toBe(mockKeyPair);
    });

    test('genKeyPair generates and exports keypair', async () => {
      const pubKeyBytes = new Uint8Array(32).fill(1);
      // PKCS#8 format for Ed25519: 16-byte header + 32-byte private key = 48 bytes total
      const privKeyBytesPkcs8 = new Uint8Array(48);
      privKeyBytesPkcs8.fill(0, 0, 16); // Header (simplified for test)
      privKeyBytesPkcs8.fill(2, 16, 48); // Private key bytes
      
      mockCrypto.subtle.generateKey.mockResolvedValue({
        publicKey: { type: 'public', algorithm: { name: 'Ed25519' }, extractable: true },
        privateKey: { type: 'private', algorithm: { name: 'Ed25519' }, extractable: true }
      });
      mockCrypto.subtle.exportKey
        .mockResolvedValueOnce(pubKeyBytes)
        .mockResolvedValueOnce(privKeyBytesPkcs8);

      const keyPair = await genKeyPair();

      // Keys should be strings
      expect(typeof keyPair.publicKey).toBe('string');
      expect(typeof keyPair.privateKey).toBe('string');
      expect(keyPair.publicKey.length).toBeGreaterThan(0);
      expect(keyPair.privateKey.length).toBeGreaterThan(0);
      expect(keyPair.publicKey).not.toBe(keyPair.privateKey);
    });

    test('createKeyPairFromBytes creates keypair from 64 bytes', async () => {
      const keypairBytes = new Uint8Array(64);
      keypairBytes.fill(1, 0, 32);  // Private key
      keypairBytes.fill(2, 32, 64); // Public key

      const mockPrivateKey = { type: 'private', algorithm: { name: 'Ed25519' } };
      const mockPublicKey = { type: 'public', algorithm: { name: 'Ed25519' } };
      
      mockCrypto.subtle.importKey
        .mockResolvedValueOnce(mockPublicKey)
        .mockResolvedValueOnce(mockPrivateKey);
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array(64));
      mockCrypto.subtle.verify.mockResolvedValue(true);

      const keyPair = await createKeyPairFromBytes(keypairBytes);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2);
      expect(keyPair.privateKey.type).toBe('private');
      expect(keyPair.publicKey.type).toBe('public');
    });

    test('createKeyPairFromPrivateKeyBytes derives keypair', async () => {
      const privateKeyBytes = new Uint8Array(32);
      privateKeyBytes.fill(1);

      const mockPrivateKey = { 
        type: 'private', 
        algorithm: { name: 'Ed25519' },
        extractable: true 
      };
      const mockPublicKey = { type: 'public', algorithm: { name: 'Ed25519' } };
      
      mockCrypto.subtle.importKey
        .mockResolvedValueOnce(mockPrivateKey)
        .mockResolvedValueOnce(mockPrivateKey) // For extractable key
        .mockResolvedValueOnce(mockPublicKey);
      mockCrypto.subtle.exportKey.mockResolvedValue({ x: 'test-public-key' });

      const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(keyPair.privateKey.type).toBe('private');
      expect(keyPair.publicKey.type).toBe('public');
    });

    test('getPublicKeyFromPrivateKey extracts public key', async () => {
      const mockPrivateKey = { type: 'private', extractable: true, algorithm: { name: 'Ed25519' } };
      const mockPublicKey = { type: 'public', algorithm: { name: 'Ed25519' } };
      
      mockCrypto.subtle.exportKey.mockResolvedValue({ x: 'test' });
      mockCrypto.subtle.importKey.mockResolvedValue(mockPublicKey);

      const publicKey = await getPublicKeyFromPrivateKey(mockPrivateKey as any);

      expect(publicKey).toBe(mockPublicKey);
    });

    test('exportBase16Key exports key as hex', async () => {
      const keyBytes = new Uint8Array(32).fill(1);
      mockCrypto.subtle.exportKey.mockResolvedValue(keyBytes);

      const key = { 
        type: 'public',
        algorithm: { name: 'Ed25519' },
        extractable: true
      };
      const result = await exportBase16Key(key as any);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Signing and Verification', () => {
    const mockPrivateKey = { type: 'private' };
    const mockPublicKey = { type: 'public' };
    const message = new Uint8Array([1, 2, 3, 4]);
    const signature = new Uint8Array(64);

    test('signBytes signs message', async () => {
      mockCrypto.subtle.sign.mockResolvedValue(signature);

      const sig = await signBytes(mockPrivateKey as any, message);

      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        'Ed25519',
        mockPrivateKey,
        message
      );
      expect(sig).toEqual(signature);
    });

    test('signBytes signs UTF-8 encoded string', async () => {
      mockCrypto.subtle.sign.mockResolvedValue(signature);
      const messageBytes = utf8.encode('Hello');

      const sig = await signBytes(mockPrivateKey as any, messageBytes);

      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        'Ed25519',
        mockPrivateKey,
        messageBytes
      );
      expect(sig).toEqual(signature);
    });

    test('verifySignature verifies valid signature', async () => {
      mockCrypto.subtle.verify.mockResolvedValue(true);

      const isValid = await verifySignature(
        mockPublicKey as any,
        signature as SignatureBytes,
        message
      );

      expect(mockCrypto.subtle.verify).toHaveBeenCalledWith(
        'Ed25519',
        mockPublicKey,
        signature,
        message
      );
      expect(isValid).toBe(true);
    });

    test('verifySignature rejects invalid signature', async () => {
      mockCrypto.subtle.verify.mockResolvedValue(false);

      const isValid = await verifySignature(
        mockPublicKey as any,
        signature as SignatureBytes,
        message
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Hashing', () => {
    test('blake2b hashes string to bytes', () => {
      const hash = blake2b('test data', undefined, 32);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash).toHaveLength(32);
    });

    test('blake2bBase64Url hashes and encodes', () => {
      const hash = blake2bBase64Url('test data');

      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('blake2b hashes bytes directly', () => {
      const input = new Uint8Array([1, 2, 3, 4]);
      const hash = blake2b(input, undefined, 32);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash).toHaveLength(32);
    });

    test('hashing is deterministic', () => {
      const data = 'consistent data';
      const hash1 = blake2b(data, undefined, 32);
      const hash2 = blake2b(data, undefined, 32);

      expect(hash1).toEqual(hash2);
    });
  });

  describe('Encoding/Decoding', () => {
    describe('hex', () => {
      test('encodes and decodes hex', () => {
        const bytes = new Uint8Array([255, 0, 128, 64]);
        const encoded = hex.encode(bytes);
        const decoded = hex.decode(encoded);

        expect(encoded).toBe('ff008040');
        expect(decoded).toEqual(bytes);
      });

      test('handles empty bytes', () => {
        const empty = new Uint8Array(0);
        expect(hex.encode(empty)).toBe('');
        expect(hex.decode('')).toEqual(empty);
      });
    });

    describe('base64', () => {
      test('encodes and decodes base64', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const encoded = base64.encode(bytes);
        const decoded = base64.decode(encoded);

        expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(decoded).toEqual(bytes);
      });
    });

    describe('base64url', () => {
      test('encodes and decodes base64url', () => {
        const bytes = new Uint8Array([255, 255, 255]);
        const encoded = base64url.encode(bytes);
        const decoded = base64url.decode(encoded);

        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(decoded).toEqual(bytes);
      });
    });


    describe('utf8', () => {
      test('encodes and decodes UTF-8', () => {
        const text = 'Hello, 世界!';
        const encoded = utf8.encode(text);
        const decoded = utf8.decode(encoded);

        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(decoded).toBe(text);
      });

      test('handles emojis', () => {
        const emoji = '🚀🎉';
        const encoded = utf8.encode(emoji);
        const decoded = utf8.decode(encoded);

        expect(decoded).toBe(emoji);
      });
    });
  });

  describe('Kadena Specific', () => {
    // Kadena addresses are 32-byte hex strings (64 characters)
    test('address validates and creates address', () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      const addr = address(validAddress);

      expect(addr).toBe(validAddress);
      expect(addr.length).toBe(64);
    });

    test('kAccount creates k:account', () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      const account = kAccount(`k:${validAddress}`);

      expect(account).toBe(`k:${validAddress}`);
    });

    test('isAddress validates addresses', () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      expect(isAddress(validAddress)).toBe(true);
      expect(isAddress('invalid')).toBe(false);
      expect(isAddress('0'.repeat(32))).toBe(false); // Too short
      expect(isAddress('0'.repeat(128))).toBe(false); // Too long
    });

    test('isKAccount validates k:accounts', () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      expect(isKAccount(`k:${validAddress}`)).toBe(true);
      expect(isKAccount(validAddress)).toBe(false); // Missing k:
      expect(isKAccount('k:invalid')).toBe(false);
    });

    test('kAccount extracts address from k:account', () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      const accountStr = `k:${validAddress}`;
      const account = kAccount(accountStr);
      // Extract address by removing the 'k:' prefix
      const extracted = account.slice(2);

      expect(extracted).toBe(validAddress);
    });
  });

  describe('Utilities', () => {
    test('fastStableStringify produces consistent output', () => {
      const obj1 = { b: 2, a: 1, c: { d: 3 } };
      const obj2 = { a: 1, c: { d: 3 }, b: 2 };

      const json1 = fastStableStringify(obj1);
      const json2 = fastStableStringify(obj2);

      expect(json1).toBe(json2);
      expect(json1).toBe('{"a":1,"b":2,"c":{"d":3}}');
    });
  });


  describe('Integration Tests', () => {
    test('complete key generation and signing flow', async () => {
      // Generate keypair
      const mockKeyPair = {
        publicKey: { 
          type: 'public', 
          algorithm: { name: 'Ed25519' },
          extractable: true 
        },
        privateKey: { 
          type: 'private', 
          algorithm: { name: 'Ed25519' },
          extractable: true
        }
      };
      
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKeyPair);
      const privKeyBytesPkcs8Integration = new Uint8Array(48);
      privKeyBytesPkcs8Integration.fill(0, 0, 16); // Header (simplified for test)
      privKeyBytesPkcs8Integration.fill(2, 16, 48); // Private key bytes
      
      mockCrypto.subtle.exportKey
        .mockResolvedValueOnce(new Uint8Array(32).fill(1)) // public key
        .mockResolvedValueOnce(privKeyBytesPkcs8Integration); // private key in PKCS#8 format
      
      const _keyPair = await genKeyPair();

      // Create message
      const message = 'Important message';
      const messageBytes = utf8.encode(message);

      // Sign message
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array(64));

      const signature = await signBytes(mockKeyPair.privateKey as any, messageBytes);

      expect(signature).toHaveLength(64);
    });

    test('address creation and validation', async () => {
      const validAddress = '0'.repeat(64); // 32 bytes = 64 hex characters
      
      const addr = address(validAddress);
      const account = kAccount(`k:${validAddress}`);

      expect(isAddress(addr)).toBe(true);
      expect(isKAccount(account)).toBe(true);
      expect(account.slice(2)).toBe(addr);
    });

    test('complex encoding roundtrip', () => {
      const data = { key: 'value', number: 42 };
      
      // Serialize and hash
      const json = fastStableStringify(data);
      const hash = blake2b(json, undefined, 32);
      
      // Encode in different formats
      const hexString = hex.encode(hash);
      const b64String = base64.encode(hash);
      const b64urlString = base64url.encode(hash);
      
      // Decode back
      const fromHex = hex.decode(hexString);
      const fromB64 = base64.decode(b64String);
      const fromB64url = base64url.decode(b64urlString);
      
      expect(fromHex).toEqual(hash);
      expect(fromB64).toEqual(hash);
      expect(fromB64url).toEqual(hash);
    });
  });
});