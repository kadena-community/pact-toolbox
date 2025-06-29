/**
 * @fileoverview Blake2b Hash Function Export
 *
 * Re-exports the Blake2b hash function from the blakejs library.
 * Blake2b is a cryptographically secure hash function optimized for speed
 * and security, providing excellent performance compared to SHA-2 and SHA-3.
 *
 * This function is used throughout the Kadena ecosystem for:
 * - Content addressing and integrity verification
 * - Merkle tree construction
 * - Key derivation functions
 * - Digital signature message hashing
 *
 * @example
 * ```typescript
 * import { blake2b } from '@pact-toolbox/crypto';
 *
 * // Hash string data
 * const hash = blake2b("hello world", undefined, 32);
 *
 * // Hash binary data
 * const data = new Uint8Array([1, 2, 3, 4]);
 * const hash2 = blake2b(data, undefined, 32);
 * ```
 */

export { blake2b } from "blakejs";
