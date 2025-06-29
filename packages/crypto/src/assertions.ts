/**
 * @fileoverview Cryptographic Capability and Context Assertions
 *
 * This module provides assertion functions to verify that the current environment
 * supports the required cryptographic operations. It ensures secure contexts,
 * validates SubtleCrypto availability, and checks for Ed25519 curve support.
 *
 * These assertions are critical for security as they prevent cryptographic
 * operations from running in insecure contexts or unsupported environments.
 */

import crypto from "uncrypto";

/**
 * Represents a read-only view of a Uint8Array.
 * Used for function parameters that should not modify the input array.
 */
export interface ReadonlyUint8Array {
  readonly [index: number]: number;
  readonly length: number;
  readonly byteLength: number;
  readonly byteOffset: number;
  readonly buffer: ArrayBufferLike;
  [Symbol.iterator](): IterableIterator<number>;
  slice(start?: number, end?: number): Uint8Array;
}

/**
 * Asserts that the current context is secure for cryptographic operations.
 *
 * In browser environments, cryptographic operations require a secure context
 * (HTTPS, localhost, or file:// protocol). This function throws an error
 * if cryptographic operations would be unavailable due to insecure context.
 *
 * @throws {Error} When running in a browser without a secure context
 *
 * @example
 * ```typescript
 * try {
 *   assertIsSecureContext();
 *   // Safe to perform crypto operations
 * } catch (error) {
 *   console.error("Secure context required:", error.message);
 * }
 * ```
 */
function assertIsSecureContext() {
  if (!__NODEJS__ && __BROWSER__ && !globalThis.isSecureContext) {
    throw new Error("Must be in a secure context (HTTPS, localhost, file://)");
  }
}

// Cache for Ed25519 support detection to avoid repeated capability checks
let cachedEd25519Decision: PromiseLike<boolean> | boolean | undefined;

/**
 * Checks if the Ed25519 elliptic curve is supported by the SubtleCrypto implementation.
 *
 * Ed25519 support varies across browsers and Node.js versions. This function performs
 * a capability test by attempting to generate an Ed25519 key pair. The result is cached
 * to avoid repeated expensive operations.
 *
 * @param subtle - The SubtleCrypto instance to test
 * @returns A promise that resolves to true if Ed25519 is supported, false otherwise
 *
 * @example
 * ```typescript
 * const isSupported = await isEd25519CurveSupported(crypto.subtle);
 * if (isSupported) {
 *   console.log("Ed25519 is supported!");
 * } else {
 *   console.log("Ed25519 is not supported in this environment");
 * }
 * ```
 */
async function isEd25519CurveSupported(subtle: SubtleCrypto): Promise<boolean> {
  if (cachedEd25519Decision === undefined) {
    cachedEd25519Decision = new Promise((resolve) => {
      subtle
        .generateKey("Ed25519", /* extractable */ false, ["sign", "verify"])
        .catch(() => {
          resolve((cachedEd25519Decision = false));
        })
        .then(() => {
          resolve((cachedEd25519Decision = true));
        });
    });
  }
  if (typeof cachedEd25519Decision === "boolean") {
    return cachedEd25519Decision;
  } else {
    return await cachedEd25519Decision;
  }
}

/**
 * Asserts that cryptographic digest functionality is available.
 *
 * Verifies that the environment supports secure context and that
 * SubtleCrypto.digest is available for hashing operations.
 *
 * @throws {Error} When digest capability is not available
 * @throws {Error} When not in a secure context (browser only)
 *
 * @example
 * ```typescript
 * try {
 *   assertDigestCapabilityIsAvailable();
 *   // Safe to use crypto.subtle.digest
 * } catch (error) {
 *   console.error("Digest not available:", error.message);
 * }
 * ```
 */
export function assertDigestCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.digest !== "function") {
    throw new Error("SubtleCrypto.digest is not available");
  }
}

/**
 * Asserts that Ed25519 key generation is available.
 *
 * Performs comprehensive checks for key generation capability including:
 * - Secure context verification
 * - SubtleCrypto.generateKey availability
 * - Ed25519 curve support
 *
 * @throws {Error} When key generation capability is not available
 * @throws {Error} When Ed25519 curve is not supported
 * @throws {Error} When not in a secure context (browser only)
 *
 * @example
 * ```typescript
 * try {
 *   await assertKeyGenerationIsAvailable();
 *   // Safe to generate Ed25519 keys
 * } catch (error) {
 *   console.error("Key generation not available:", error.message);
 * }
 * ```
 */
export async function assertKeyGenerationIsAvailable(): Promise<void> {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.generateKey !== "function") {
    throw new Error("SubtleCrypto.generateKey is not available");
  }
  if (!(await isEd25519CurveSupported(crypto.subtle))) {
    throw new Error("Ed25519 curve is not supported");
  }
}

/**
 * Asserts that key export functionality is available.
 *
 * Verifies that the environment supports secure context and that
 * SubtleCrypto.exportKey is available for extracting key material.
 *
 * **Security Note**: Key export should only be used when necessary,
 * as it exposes cryptographic key material to JavaScript.
 *
 * @throws {Error} When key export capability is not available
 * @throws {Error} When not in a secure context (browser only)
 *
 * @example
 * ```typescript
 * try {
 *   assertKeyExporterIsAvailable();
 *   // Safe to export extractable keys
 * } catch (error) {
 *   console.error("Key export not available:", error.message);
 * }
 * ```
 */
export function assertKeyExporterIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.exportKey !== "function") {
    throw new Error("SubtleCrypto.exportKey is not available");
  }
}

/**
 * Asserts that digital signing functionality is available.
 *
 * Verifies that the environment supports secure context and that
 * SubtleCrypto.sign is available for creating digital signatures.
 *
 * @throws {Error} When signing capability is not available
 * @throws {Error} When not in a secure context (browser only)
 *
 * @example
 * ```typescript
 * try {
 *   assertSigningCapabilityIsAvailable();
 *   // Safe to create digital signatures
 * } catch (error) {
 *   console.error("Signing not available:", error.message);
 * }
 * ```
 */
export function assertSigningCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.sign !== "function") {
    throw new Error("SubtleCrypto.sign is not available");
  }
}

/**
 * Asserts that signature verification functionality is available.
 *
 * Verifies that the environment supports secure context and that
 * SubtleCrypto.verify is available for verifying digital signatures.
 *
 * @throws {Error} When verification capability is not available
 * @throws {Error} When not in a secure context (browser only)
 *
 * @example
 * ```typescript
 * try {
 *   assertVerificationCapabilityIsAvailable();
 *   // Safe to verify digital signatures
 * } catch (error) {
 *   console.error("Verification not available:", error.message);
 * }
 * ```
 */
export function assertVerificationCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.verify !== "function") {
    throw new Error("SubtleCrypto.verify is not available");
  }
}

/**
 * Asserts that cryptographically secure random number generation is available.
 *
 * Verifies that crypto.getRandomValues is available for generating
 * cryptographically secure random values. This is essential for key generation
 * and other security-critical operations.
 *
 * Note: This function does not require a secure context check as getRandomValues
 * is available in all contexts, unlike SubtleCrypto operations.
 *
 * @throws {Error} When secure random number generation is not available
 *
 * @example
 * ```typescript
 * try {
 *   assertPRNGIsAvailable();
 *   // Safe to generate secure random values
 * } catch (error) {
 *   console.error("PRNG not available:", error.message);
 * }
 * ```
 */
export function assertPRNGIsAvailable(): void {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Crypto.getRandomValues is not available");
  }
}

/**
 * Asserts that a byte array has data available for codec operations.
 *
 * This function checks that a byte array has at least one byte available
 * for decoding operations, taking into account the specified offset.
 *
 * @param codecDescription - Description of the codec for error messages
 * @param bytes - The byte array to check
 * @param offset - The starting offset in the byte array (default: 0)
 * @throws {Error} When the byte array is empty or offset exceeds array length
 *
 * @example
 * ```typescript
 * try {
 *   assertByteArrayIsNotEmptyForCodec("base64", new Uint8Array([1, 2, 3]), 0);
 *   // Safe to proceed with decoding
 * } catch (error) {
 *   console.error("Codec error:", error.message);
 * }
 * ```
 */
export function assertByteArrayIsNotEmptyForCodec(
  codecDescription: string,
  bytes: ReadonlyUint8Array | Uint8Array,
  offset = 0,
): void {
  if (bytes.length - offset <= 0) {
    throw new Error(`Empty byte array for ${codecDescription}`);
  }
}

/**
 * Asserts that a byte array has sufficient bytes for codec operations.
 *
 * This function validates that the byte array contains at least the expected
 * number of bytes for a codec operation, accounting for the specified offset.
 *
 * @param codecDescription - Description of the codec for error messages
 * @param expected - The minimum number of bytes required
 * @param bytes - The byte array to check
 * @param offset - The starting offset in the byte array (default: 0)
 * @throws {Error} When insufficient bytes are available
 *
 * @example
 * ```typescript
 * try {
 *   assertByteArrayHasEnoughBytesForCodec("fixed-32", 32, someBytes, 0);
 *   // Safe to decode 32 bytes
 * } catch (error) {
 *   console.error("Insufficient bytes:", error.message);
 * }
 * ```
 */
export function assertByteArrayHasEnoughBytesForCodec(
  codecDescription: string,
  expected: number,
  bytes: ReadonlyUint8Array | Uint8Array,
  offset = 0,
): void {
  const bytesLength = bytes.length - offset;
  if (bytesLength < expected) {
    throw new Error(`Not enough bytes to decode ${codecDescription}. Expected: ${expected}, Actual: ${bytesLength}`);
  }
}

/**
 * Asserts that an offset is within valid bounds for a byte array.
 *
 * Validates that the offset is between 0 and the byte array length (inclusive).
 * An offset equal to the byte array length is considered valid as it represents
 * the position after the last byte, which is useful for codec operations that
 * need to signal the end of data.
 *
 * @param codecDescription - Description of the codec for error messages
 * @param offset - The offset to validate
 * @param bytesLength - The length of the byte array
 * @throws {Error} When the offset is negative or exceeds the array length
 *
 * @example
 * ```typescript
 * try {
 *   assertByteArrayOffsetIsNotOutOfRange("base16", 5, 10);
 *   // Safe to use offset 5 in a 10-byte array
 * } catch (error) {
 *   console.error("Invalid offset:", error.message);
 * }
 * ```
 */
export function assertByteArrayOffsetIsNotOutOfRange(
  codecDescription: string,
  offset: number,
  bytesLength: number,
): void {
  if (offset < 0 || offset > bytesLength) {
    throw new Error(`Offset is out of range for ${codecDescription}: ${offset}`);
  }
}

/**
 * Asserts that a string contains only valid characters for a specific base encoding.
 *
 * Validates that all characters in the test string are present in the specified
 * alphabet. This is used to ensure that encoded strings are valid before
 * attempting to decode them.
 *
 * @param alphabet - The valid character set for the encoding
 * @param testValue - The string to validate
 * @param givenValue - The original value for error reporting (defaults to testValue)
 * @throws {Error} When the string contains invalid characters
 *
 * @example
 * ```typescript
 * try {
 *   assertValidBaseString("0123456789abcdef", "abc123"); // Valid hex
 *   assertValidBaseString("0123456789abcdef", "xyz"); // Throws error
 * } catch (error) {
 *   console.error("Invalid encoding:", error.message);
 * }
 * ```
 */
export function assertValidBaseString(alphabet: string, testValue: string, givenValue: string = testValue): void {
  if (!testValue.match(new RegExp(`^[${alphabet}]*$`))) {
    throw new Error(`Invalid base${alphabet.length} string: ${givenValue}`);
  }
}
