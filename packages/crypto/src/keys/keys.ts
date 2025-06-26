/**
 * @fileoverview Ed25519 Key Operations and PKCS#8 Handling
 * 
 * This module provides low-level Ed25519 key operations including:
 * - Key pair generation (extractable and non-extractable)
 * - PKCS#8 format encoding for private keys
 * - Key derivation and validation
 * - Raw byte import/export functionality
 * 
 * The module uses the Web Crypto API's Ed25519 implementation with proper
 * PKCS#8 formatting for compatibility across different cryptographic libraries.
 */

import crypto from "uncrypto";

import type { ReadonlyUint8Array } from "../assertions";
import { assertKeyExporterIsAvailable, assertKeyGenerationIsAvailable, assertPRNGIsAvailable } from "../assertions";
import { signBytes, verifySignature } from "./signatures";

/**
 * Adds PKCS#8 ASN.1 header to raw Ed25519 private key bytes.
 * 
 * PKCS#8 is the standard format for storing private key information.
 * This function wraps raw 32-byte Ed25519 private keys in the proper
 * ASN.1 structure required by the Web Crypto API.
 * 
 * The structure follows RFC 5958 and includes:
 * - Version number (0)
 * - Algorithm identifier (Ed25519 OID: 1.3.101.112)
 * - Private key octet string
 * 
 * @param bytes - Raw 32-byte Ed25519 private key
 * @returns PKCS#8 formatted private key bytes
 * 
 * @example
 * ```typescript
 * const rawKey = new Uint8Array(32); // 32 random bytes
 * const pkcs8Key = addPkcs8Header(rawKey);
 * // pkcs8Key can now be imported with crypto.subtle.importKey
 * ```
 */
function addPkcs8Header(bytes: ReadonlyUint8Array): ReadonlyUint8Array {
  // prettier-ignore
  return new Uint8Array([
        /**
         * PKCS#8 header
         */
        0x30, // ASN.1 sequence tag
        0x2e, // Length of sequence (46 more bytes)

            0x02, // ASN.1 integer tag
            0x01, // Length of integer
                0x00, // Version number

            0x30, // ASN.1 sequence tag
            0x05, // Length of sequence
                0x06, // ASN.1 object identifier tag
                0x03, // Length of object identifier
                    // Edwards curve algorithms identifier https://oid-rep.orange-labs.fr/get/1.3.101.112
                        0x2b, // iso(1) / identified-organization(3) (The first node is multiplied by the decimal 40 and the result is added to the value of the second node)
                        0x65, // thawte(101)
                    // Ed25519 identifier
                        0x70, // id-Ed25519(112)

        /**
         * Private key payload
         */
        0x04, // ASN.1 octet string tag
        0x22, // String length (34 more bytes)

            // Private key bytes as octet string
            0x04, // ASN.1 octet string tag
            0x20, // String length (32 bytes)

        ...bytes
    ]);
}

/**
 * Creates an Ed25519 private key from raw bytes.
 * 
 * Imports a 32-byte Ed25519 private key into the Web Crypto API format.
 * The raw bytes are wrapped in PKCS#8 format before import.
 * 
 * **Security Note**: Use extractable=false (default) when the private key
 * material doesn't need to be accessed directly. This prevents the key
 * bytes from being extracted after import.
 * 
 * @param bytes - Raw 32-byte Ed25519 private key
 * @param extractable - Whether the key can be exported later (default: false)
 * @returns A promise that resolves to the imported CryptoKey
 * @throws {Error} When the key length is not exactly 32 bytes
 * 
 * @example
 * ```typescript
 * const rawKey = new Uint8Array(32); // Should be cryptographically secure
 * crypto.getRandomValues(rawKey);
 * 
 * const privateKey = await createPrivateKeyFromBytes(rawKey, false);
 * // privateKey can be used for signing but cannot be re-exported
 * ```
 */
export async function createPrivateKeyFromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<CryptoKey> {
  const actualLength = bytes.byteLength;
  if (actualLength !== 32) {
    throw new Error(`Invalid private key length: ${actualLength}`);
  }
  const privateKeyBytesPkcs8 = addPkcs8Header(bytes);
  return crypto.subtle.importKey("pkcs8", privateKeyBytesPkcs8, "Ed25519", extractable ?? false, ["sign"]);
}

/**
 * Derives the public key from an Ed25519 private key.
 * 
 * This function extracts the public key component from an extractable private key
 * by exporting the private key as JWK format and re-importing only the public
 * key material. This is useful when you have a private key and need the
 * corresponding public key for verification operations.
 * 
 * @param privateKey - The extractable Ed25519 private key
 * @param extractable - Whether the derived public key should be extractable (default: false)
 * @returns A promise that resolves to the derived public key
 * @throws {Error} When the private key is not extractable
 * @throws {Error} When key export functionality is not available
 * 
 * @example
 * ```typescript
 * const keyPair = await generateExtractableKeyPair();
 * const publicKey = await getPublicKeyFromPrivateKey(keyPair.privateKey, true);
 * // publicKey can be used for verification and is extractable
 * ```
 */
export async function getPublicKeyFromPrivateKey(
  privateKey: CryptoKey,
  extractable: boolean = false,
): Promise<CryptoKey> {
  assertKeyExporterIsAvailable();

  if (privateKey.extractable === false) {
    throw new Error(`Private key ${privateKey} is not extractable`);
  }

  // Export private key to JWK format
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);

  // Import only the public key portion
  return await crypto.subtle.importKey(
    "jwk",
    {
      crv /* curve */: "Ed25519",
      ext /* extractable */: extractable,
      key_ops /* key operations */: ["verify"],
      kty /* key type */: "OKP" /* octet key pair */,
      x /* public key x-coordinate */: jwk.x,
    },
    "Ed25519",
    extractable,
    ["verify"],
  );
}

/**
 * Generates a new Ed25519 key pair with non-extractable private key.
 * 
 * Creates a cryptographically secure Ed25519 key pair using the Web Crypto API.
 * The private key is non-extractable for enhanced security, meaning the raw
 * key bytes cannot be accessed from JavaScript after generation.
 * 
 * **Security Recommendation**: Use this function unless you specifically need
 * to export the private key material. Non-extractable keys provide better
 * security by preventing accidental key material exposure.
 * 
 * @returns A promise that resolves to a new CryptoKeyPair
 * @throws {Error} When Ed25519 key generation is not available
 * @throws {Error} When not in a secure context (browser only)
 * 
 * @example
 * ```typescript
 * const keyPair = await generateKeyPair();
 * // keyPair.privateKey can sign but cannot be exported
 * // keyPair.publicKey can verify signatures
 * ```
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  await assertKeyGenerationIsAvailable();
  const keyPair = await crypto.subtle.generateKey(
    /* algorithm */ "Ed25519", // Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
    /* extractable */ false, // Prevents the bytes of the private key from being visible to JS.
    /* allowed uses */ ["sign", "verify"],
  );
  return keyPair as CryptoKeyPair;
}

/**
 * Generates a new Ed25519 key pair with extractable private key.
 * 
 * Creates a cryptographically secure Ed25519 key pair where both keys can be
 * exported. This is useful when you need to store, transmit, or serialize
 * the key material.
 * 
 * **Security Warning**: Extractable private keys expose cryptographic material
 * to JavaScript and should be handled with extreme care. Only use when necessary
 * and ensure proper key management practices.
 * 
 * @returns A promise that resolves to a new extractable CryptoKeyPair
 * @throws {Error} When Ed25519 key generation is not available
 * @throws {Error} When not in a secure context (browser only)
 * 
 * @example
 * ```typescript
 * const keyPair = await generateExtractableKeyPair();
 * // Both keys can be exported for storage or transmission
 * const privateKeyBytes = await crypto.subtle.exportKey("raw", keyPair.privateKey);
 * ```
 */
export async function generateExtractableKeyPair(): Promise<CryptoKeyPair> {
  await assertKeyGenerationIsAvailable();
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  return keyPair as CryptoKeyPair;
}

/**
 * Creates an Ed25519 key pair from concatenated key bytes.
 * 
 * Imports a key pair from 64 bytes where the first 32 bytes are the private key
 * and the last 32 bytes are the public key. The function validates that the
 * keys are mathematically related by performing a sign/verify test.
 * 
 * **Security Note**: This function requires PRNG for validation and will expose
 * the public key as extractable. The private key extractability is controlled
 * by the extractable parameter.
 * 
 * @param bytes - 64-byte array (32-byte private key + 32-byte public key)
 * @param extractable - Whether the private key should be extractable (default: false)
 * @returns A promise that resolves to the imported and validated CryptoKeyPair
 * @throws {Error} When the byte length is not exactly 64
 * @throws {Error} When the public and private keys don't match
 * @throws {Error} When PRNG is not available for validation
 * 
 * @example
 * ```typescript
 * const keyBytes = new Uint8Array(64); // Should contain valid key pair
 * const keyPair = await createKeyPairFromBytes(keyBytes, false);
 * // keyPair is validated and ready for use
 * ```
 */
export async function createKeyPairFromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<CryptoKeyPair> {
  assertPRNGIsAvailable();

  if (bytes.byteLength !== 64) {
    throw new Error(`invalid key pair length: ${bytes.byteLength}`);
  }
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.importKey("raw", bytes.slice(32), "Ed25519", /* extractable */ true, ["verify"]),
    createPrivateKeyFromBytes(bytes.slice(0, 32), extractable),
  ]);

  // Verify the key pair by signing and verifying random data
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const signedData = await signBytes(privateKey, randomBytes);
  const isValid = await verifySignature(publicKey, signedData, randomBytes);
  if (!isValid) {
    throw new Error("public key must match private key");
  }

  return { privateKey, publicKey } as CryptoKeyPair;
}

/**
 * Creates an Ed25519 key pair from private key bytes only.
 * 
 * Derives the corresponding public key from the provided private key bytes.
 * This is more efficient than `createKeyPairFromBytes` when you only have
 * the private key material.
 * 
 * The function optimizes for the common case where a non-extractable private
 * key is desired by creating a temporary extractable private key for public
 * key derivation, then creating the final non-extractable private key.
 * 
 * @param bytes - 32-byte Ed25519 private key
 * @param extractable - Whether the private key should be extractable (default: false)
 * @returns A promise that resolves to the derived CryptoKeyPair
 * @throws {Error} When the private key bytes are invalid
 * @throws {Error} When key operations fail
 * 
 * @example
 * ```typescript
 * const privateKeyBytes = new Uint8Array(32); // Should be cryptographically secure
 * crypto.getRandomValues(privateKeyBytes);
 * 
 * const keyPair = await createKeyPairFromPrivateKeyBytes(privateKeyBytes, false);
 * // keyPair.publicKey is derived from the private key
 * // keyPair.privateKey is non-extractable for security
 * ```
 */
export async function createKeyPairFromPrivateKeyBytes(
  bytes: ReadonlyUint8Array,
  extractable: boolean = false,
): Promise<CryptoKeyPair> {
  const privateKeyPromise = createPrivateKeyFromBytes(bytes, extractable);

  // Optimization: When creating a non-extractable private key, we need a temporary
  // extractable one to derive the public key. We create both in parallel.
  // If extractable=true, we reuse the same private key for derivation.
  const [publicKey, privateKey] = await Promise.all([
    // This nested promise creates the public key in parallel with the
    // final private key creation for optimal performance
    (extractable ? privateKeyPromise : createPrivateKeyFromBytes(bytes, true /* extractable */)).then(
      async (extractablePrivateKey) => await getPublicKeyFromPrivateKey(extractablePrivateKey, true /* extractable */),
    ),
    privateKeyPromise,
  ]);

  return { privateKey, publicKey };
}
