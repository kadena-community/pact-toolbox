import { describe, test, expect, beforeEach, vi } from 'vitest';
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
  signString,
  verifySignature,
  
  // Hashing
  hashBlake2b,
  hashBlake2bBase64Url,
  blake2b256,
  
  // Encodings
  base16,
  base64,
  base64url,
  base58,
  utf8,
  
  // Kadena specific
  createAddress,
  createKAccount,
  isValidAddress,
  isValidKAccount,
  getAddressFromKAccount,
  createSingleKeyGuard,
  createMultiKeyGuard,
  
  // Utilities
  fastStableStringify,
  mergeBytes,
  padBytes,
  fixBytes,
  bytesToBigInt,
  bigIntToBytes,
  
  // Codec system
  createCodec,
  createFixedCodec,
  transformCodec,
  bimap
} from './index';

// Mock Web Crypto API
const mockCrypto = {
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
};

global.crypto = mockCrypto as any;

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
        { name: 'Ed25519' },
        false, // non-extractable
        ['sign', 'verify']
      );
      expect(keyPair).toBe(mockKeyPair);
    });

    test('generateExtractableKeyPair creates extractable keypair', async () => {
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKeyPair);

      const keyPair = await generateExtractableKeyPair();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'Ed25519' },
        true, // extractable
        ['sign', 'verify']
      );
      expect(keyPair).toBe(mockKeyPair);
    });

    test('genKeyPair generates and exports keypair', () => {
      const { publicKey, secretKey } = genKeyPair();

      expect(publicKey).toMatch(/^[a-f0-9]{64}$/);
      expect(secretKey).toMatch(/^[a-f0-9]{64}$/);
      expect(publicKey).not.toBe(secretKey);
    });

    test('createKeyPairFromBytes creates keypair from 64 bytes', async () => {
      const keypairBytes = new Uint8Array(64);
      keypairBytes.fill(1, 0, 32);  // Private key
      keypairBytes.fill(2, 32, 64); // Public key

      mockCrypto.subtle.importKey.mockResolvedValueOnce({ type: 'private' });
      mockCrypto.subtle.importKey.mockResolvedValueOnce({ type: 'public' });

      const keyPair = await createKeyPairFromBytes(keypairBytes);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2);
      expect(keyPair.privateKey.type).toBe('private');
      expect(keyPair.publicKey.type).toBe('public');
    });

    test('createKeyPairFromPrivateKeyBytes derives keypair', async () => {
      const privateKeyBytes = new Uint8Array(32);
      privateKeyBytes.fill(1);

      mockCrypto.subtle.importKey.mockResolvedValue({ type: 'private' });

      const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(keyPair.privateKey.type).toBe('private');
    });

    test('getPublicKeyFromPrivateKey extracts public key', async () => {
      const privateKeyBytes = new Uint8Array(32);
      const expectedPublicKey = new Uint8Array(32);
      expectedPublicKey.fill(2);

      // Mock Ed25519 public key derivation
      const publicKey = await getPublicKeyFromPrivateKey(privateKeyBytes);

      expect(publicKey).toHaveLength(32);
    });

    test('exportBase16Key exports key as hex', async () => {
      const keyBytes = new Uint8Array([1, 2, 3, 4]);
      mockCrypto.subtle.exportKey.mockResolvedValue(keyBytes);

      const key = { type: 'public' };
      const hex = await exportBase16Key(key as any);

      expect(hex).toBe('01020304');
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
        { name: 'Ed25519' },
        mockPrivateKey,
        message
      );
      expect(sig).toBe(signature);
    });

    test('signString signs UTF-8 string', async () => {
      mockCrypto.subtle.sign.mockResolvedValue(signature);

      const sig = await signString(mockPrivateKey as any, 'Hello');

      expect(mockCrypto.subtle.sign).toHaveBeenCalled();
      const calledMessage = mockCrypto.subtle.sign.mock.calls[0][2];
      expect(new TextDecoder().decode(calledMessage)).toBe('Hello');
    });

    test('verifySignature verifies valid signature', async () => {
      mockCrypto.subtle.verify.mockResolvedValue(true);

      const isValid = await verifySignature(
        mockPublicKey as any,
        message,
        signature
      );

      expect(mockCrypto.subtle.verify).toHaveBeenCalledWith(
        { name: 'Ed25519' },
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
        message,
        signature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Hashing', () => {
    test('hashBlake2b hashes string to bytes', () => {
      const hash = hashBlake2b('test data');

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash).toHaveLength(32);
    });

    test('hashBlake2bBase64Url hashes and encodes', () => {
      const hash = hashBlake2bBase64Url('test data');

      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('blake2b256 hashes bytes directly', () => {
      const input = new Uint8Array([1, 2, 3, 4]);
      const hash = blake2b256(input);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash).toHaveLength(32);
    });

    test('hashing is deterministic', () => {
      const data = 'consistent data';
      const hash1 = hashBlake2b(data);
      const hash2 = hashBlake2b(data);

      expect(hash1).toEqual(hash2);
    });
  });

  describe('Encoding/Decoding', () => {
    describe('base16', () => {
      test('encodes and decodes hex', () => {
        const bytes = new Uint8Array([255, 0, 128, 64]);
        const encoded = base16.encode(bytes);
        const decoded = base16.decode(encoded);

        expect(encoded).toBe('ff008040');
        expect(decoded).toEqual(bytes);
      });

      test('handles empty bytes', () => {
        const empty = new Uint8Array(0);
        expect(base16.encode(empty)).toBe('');
        expect(base16.decode('')).toEqual(empty);
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

    describe('base58', () => {
      test('encodes and decodes base58', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const encoded = base58.encode(bytes);
        const decoded = base58.decode(encoded);

        expect(encoded).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
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
    const publicKey = 'a'.repeat(64);

    test('createAddress creates valid address', () => {
      const address = createAddress(publicKey);

      expect(address).toBe(publicKey);
      expect(address).toHaveLength(64);
    });

    test('createKAccount creates k:account', () => {
      const kAccount = createKAccount(publicKey);

      expect(kAccount).toBe(`k:${publicKey}`);
    });

    test('isValidAddress validates addresses', () => {
      expect(isValidAddress(publicKey)).toBe(true);
      expect(isValidAddress('invalid')).toBe(false);
      expect(isValidAddress('g'.repeat(64))).toBe(false); // Non-hex
      expect(isValidAddress(publicKey.slice(0, -1))).toBe(false); // Too short
    });

    test('isValidKAccount validates k:accounts', () => {
      expect(isValidKAccount(`k:${publicKey}`)).toBe(true);
      expect(isValidKAccount(publicKey)).toBe(false); // Missing k:
      expect(isValidKAccount('k:invalid')).toBe(false);
      expect(isValidKAccount('w:' + publicKey)).toBe(false); // Wrong prefix
    });

    test('getAddressFromKAccount extracts address', () => {
      const kAccount = `k:${publicKey}`;
      const extracted = getAddressFromKAccount(kAccount);

      expect(extracted).toBe(publicKey);
    });

    test('createSingleKeyGuard creates guard', () => {
      const guard = createSingleKeyGuard(publicKey);

      expect(guard).toEqual({
        keys: [publicKey],
        pred: 'keys-all'
      });
    });

    test('createMultiKeyGuard creates multi-key guard', () => {
      const keys = ['key1', 'key2', 'key3'];
      const guard = createMultiKeyGuard(keys, 'keys-any');

      expect(guard).toEqual({
        keys,
        pred: 'keys-any'
      });
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

    test('mergeBytes concatenates arrays', () => {
      const arr1 = new Uint8Array([1, 2]);
      const arr2 = new Uint8Array([3, 4]);
      const arr3 = new Uint8Array([5]);

      const merged = mergeBytes(arr1, arr2, arr3);

      expect(merged).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    test('padBytes pads to length', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const padded = padBytes(bytes, 8);

      expect(padded).toHaveLength(8);
      expect(padded.slice(0, 3)).toEqual(bytes);
      expect(padded.slice(3)).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    test('fixBytes truncates or pads', () => {
      const short = new Uint8Array([1, 2]);
      const long = new Uint8Array([1, 2, 3, 4, 5]);

      const fixed1 = fixBytes(short, 4);
      const fixed2 = fixBytes(long, 3);

      expect(fixed1).toEqual(new Uint8Array([1, 2, 0, 0]));
      expect(fixed2).toEqual(new Uint8Array([1, 2, 3]));
    });

    test('bytesToBigInt converts correctly', () => {
      const bytes = new Uint8Array([1, 0]); // 256 in big-endian
      const bigInt = bytesToBigInt(bytes);

      expect(bigInt).toBe(256n);
    });

    test('bigIntToBytes converts correctly', () => {
      const bytes = bigIntToBytes(256n);

      expect(bytes).toEqual(new Uint8Array([1, 0]));
    });
  });

  describe('Codec System', () => {
    test('createCodec creates variable-length codec', () => {
      const numberCodec = createCodec<number>({
        encode: (n) => utf8.encode(n.toString()),
        decode: (bytes) => parseInt(utf8.decode(bytes), 10)
      });

      const encoded = numberCodec.encode(42);
      const decoded = numberCodec.decode(encoded);

      expect(decoded).toBe(42);
    });

    test('createFixedCodec creates fixed-length codec', () => {
      const addressCodec = createFixedCodec<string>(32, {
        encode: (addr) => base16.decode(addr),
        decode: (bytes) => base16.encode(bytes)
      });

      const address = 'a'.repeat(64);
      const encoded = addressCodec.encode(address);
      const decoded = addressCodec.decode(encoded);

      expect(encoded).toHaveLength(32);
      expect(decoded).toBe(address);
    });

    test('transformCodec transforms values', () => {
      const dateCodec = transformCodec(utf8, {
        encode: (date: Date) => date.toISOString(),
        decode: (str: string) => new Date(str)
      });

      const date = new Date('2024-01-01');
      const encoded = dateCodec.encode(date);
      const decoded = dateCodec.decode(encoded);

      expect(decoded.getTime()).toBe(date.getTime());
    });

    test('bimap creates bidirectional mapping', () => {
      const boolCodec = bimap(utf8,
        (b: boolean) => b ? 'true' : 'false',
        (s: string) => s === 'true'
      );

      expect(boolCodec.decode(boolCodec.encode(true))).toBe(true);
      expect(boolCodec.decode(boolCodec.encode(false))).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('complete key generation and signing flow', async () => {
      // Generate keypair
      const { publicKey, secretKey } = genKeyPair();

      // Create message
      const message = 'Important message';
      const messageBytes = utf8.encode(message);

      // Sign message (mock implementation)
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array(64));
      mockCrypto.subtle.importKey.mockResolvedValue({ type: 'private' });

      const privateKeyBytes = base16.decode(secretKey);
      const privateKey = await mockCrypto.subtle.importKey(
        'raw',
        privateKeyBytes.slice(0, 32),
        { name: 'Ed25519' },
        false,
        ['sign']
      );

      const signature = await signBytes(privateKey as any, messageBytes);

      expect(signature).toHaveLength(64);
    });

    test('address creation and validation', () => {
      const { publicKey } = genKeyPair();
      const address = createAddress(publicKey);
      const kAccount = createKAccount(address);

      expect(isValidAddress(address)).toBe(true);
      expect(isValidKAccount(kAccount)).toBe(true);
      expect(getAddressFromKAccount(kAccount)).toBe(address);
    });

    test('complex encoding roundtrip', () => {
      const data = { key: 'value', number: 42 };
      
      // Serialize and hash
      const json = fastStableStringify(data);
      const hash = hashBlake2b(json);
      
      // Encode in different formats
      const hex = base16.encode(hash);
      const b64 = base64.encode(hash);
      const b64url = base64url.encode(hash);
      
      // Decode back
      const fromHex = base16.decode(hex);
      const fromB64 = base64.decode(b64);
      const fromB64url = base64url.decode(b64url);
      
      expect(fromHex).toEqual(hash);
      expect(fromB64).toEqual(hash);
      expect(fromB64url).toEqual(hash);
    });
  });
});