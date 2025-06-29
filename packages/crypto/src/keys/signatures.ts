/**
 * @fileoverview Ed25519 Digital Signature Operations
 *
 * This module provides Ed25519 digital signature creation and verification functionality.
 * It includes branded types for type-safe signature handling and utilities for
 * converting between different signature representations.
 *
 * Ed25519 signatures are exactly 64 bytes and provide strong security guarantees
 * with excellent performance characteristics.
 */

import type { ReadonlyUint8Array } from "../assertions";
import { assertSigningCapabilityIsAvailable, assertVerificationCapabilityIsAvailable } from "../assertions";
import { fromHex } from "../encoding";

/**
 * A branded type representing a valid Ed25519 signature in hexadecimal format.
 *
 * Ed25519 signatures are exactly 64 bytes (128 hex characters) and provide
 * strong cryptographic guarantees. The brand ensures type safety by preventing
 * regular strings from being used as signatures without proper validation.
 *
 * @example
 * ```typescript
 * const sig: Signature = signature("a1b2c3..."); // 128 hex chars
 * ```
 */
export type Signature = string & { readonly __brand: unique symbol };

/**
 * A branded type representing Ed25519 signature bytes.
 *
 * This type represents the raw 64-byte signature data returned from
 * cryptographic operations. It provides type safety for signature bytes.
 *
 * @example
 * ```typescript
 * const sigBytes: SignatureBytes = await signBytes(privateKey, data);
 * ```
 */
export type SignatureBytes = Uint8Array & { readonly __brand: unique symbol };

/**
 * Assertion function to validate that a string is a valid Ed25519 signature.
 *
 * Validates that the string represents a valid 64-byte Ed25519 signature
 * when decoded from hexadecimal. Performs both length checks and actual
 * decoding validation.
 *
 * @param putativeSignature - The string to validate as a signature
 * @throws {Error} When the signature format is invalid or has incorrect byte length
 *
 * @example
 * ```typescript
 * try {
 *   assertIsSignature("a1b2c3..."); // Must be 128 hex chars
 *   // Safe to use as Signature type
 * } catch (error) {
 *   console.error("Invalid signature:", error.message);
 * }
 * ```
 */
export function assertIsSignature(putativeSignature: string): asserts putativeSignature is Signature {
  // Fast-path; see if the input string is of an acceptable length.
  if (putativeSignature.length !== 128) {
    throw new Error(`Invalid signature length: ${putativeSignature.length} characters (expected 128)`);
  }
  // Slow-path; actually attempt to decode the input string.
  try {
    const bytes = fromHex(putativeSignature);
    const numBytes = bytes.byteLength;
    if (numBytes !== 64) {
      throw new Error(`Invalid signature length: ${numBytes} bytes (expected 64)`);
    }
  } catch (error) {
    throw new Error(`Invalid signature format: ${error instanceof Error ? error.message : "invalid hex"}`);
  }
}

/**
 * Type predicate to check if a string is a valid Ed25519 signature.
 *
 * Performs the same validation as `assertIsSignature` but returns a boolean
 * instead of throwing. Validates both string length and hex decoding to
 * ensure the signature is exactly 64 bytes.
 *
 * @param putativeSignature - The string to validate as a signature
 * @returns True if the string is a valid signature, false otherwise
 *
 * @example
 * ```typescript
 * if (isSignature("a1b2c3...")) {
 *   // putativeSignature is now typed as Signature
 *   console.log("Valid signature!");
 * }
 * ```
 */
export function isSignature(putativeSignature: string): putativeSignature is Signature {
  // Fast-path; see if the input string is of an acceptable length.
  if (
    // Lowest value (64 bytes of zeroes)
    putativeSignature.length !== 128
  ) {
    return false;
  }
  // Slow-path; actually attempt to decode the input string.
  try {
    const bytes = fromHex(putativeSignature);
    const numBytes = bytes.byteLength;
    if (numBytes !== 64) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates an Ed25519 digital signature for the provided data.
 *
 * Signs arbitrary byte data using an Ed25519 private key. The signature
 * is deterministic for the same key and data, providing strong authenticity
 * and integrity guarantees.
 *
 * **Security Note**: Ensure the private key is properly secured and the
 * data being signed is the intended content. Signatures provide proof
 * that the key holder authorized the specific data.
 *
 * @param key - The Ed25519 private key for signing (must have "sign" usage)
 * @param data - The byte data to sign
 * @returns A promise that resolves to the 64-byte signature
 * @throws {Error} When signing capability is not available
 * @throws {Error} When the key is invalid or cannot be used for signing
 *
 * @example
 * ```typescript
 * const keyPair = await generateKeyPair();
 * const data = new TextEncoder().encode("Hello, world!");
 * const signature = await signBytes(keyPair.privateKey, data);
 * // signature is a 64-byte Ed25519 signature
 * ```
 */
export async function signBytes(key: CryptoKey, data: ReadonlyUint8Array): Promise<SignatureBytes> {
  assertSigningCapabilityIsAvailable();
  const signedData = await crypto.subtle.sign("Ed25519", key, data);
  return new Uint8Array(signedData) as SignatureBytes;
}

/**
 * Creates a validated Signature from a string.
 *
 * This is the primary way to create Signature instances with full type safety.
 * The function validates the input and returns a branded Signature type.
 *
 * @param putativeSignature - The hex string to validate and convert to a Signature
 * @returns A validated Signature instance
 * @throws {Error} When the signature format is invalid
 *
 * @example
 * ```typescript
 * const sig = signature("a1b2c3d4e5f6..."); // Must be valid 64-byte hex
 * // sig is now of type Signature and guaranteed to be valid
 * ```
 */
export function signature(putativeSignature: string): Signature {
  assertIsSignature(putativeSignature);
  return putativeSignature;
}

/**
 * Verifies an Ed25519 digital signature against the provided data.
 *
 * Cryptographically verifies that the signature was created by the holder
 * of the private key corresponding to the provided public key, and that
 * the signature is valid for the specific data.
 *
 * **Security Note**: Always check the return value. A `false` result means
 * the signature is invalid, the data has been tampered with, or the wrong
 * public key was used.
 *
 * @param key - The Ed25519 public key for verification (must have "verify" usage)
 * @param signature - The 64-byte signature to verify
 * @param data - The original data that was signed
 * @returns A promise that resolves to true if the signature is valid, false otherwise
 * @throws {Error} When verification capability is not available
 * @throws {Error} When the key is invalid or cannot be used for verification
 *
 * @example
 * ```typescript
 * const keyPair = await generateKeyPair();
 * const data = new TextEncoder().encode("Hello, world!");
 * const signature = await signBytes(keyPair.privateKey, data);
 *
 * const isValid = await verifySignature(keyPair.publicKey, signature, data);
 * if (isValid) {
 *   console.log("Signature is valid!");
 * } else {
 *   console.log("Signature verification failed!");
 * }
 * ```
 */
export async function verifySignature(
  key: CryptoKey,
  signature: SignatureBytes,
  data: ReadonlyUint8Array | Uint8Array,
): Promise<boolean> {
  assertVerificationCapabilityIsAvailable();
  return await crypto.subtle.verify("Ed25519", key, signature, data);
}
