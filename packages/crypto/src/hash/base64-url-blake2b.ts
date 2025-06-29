/**
 * @fileoverview Blake2b Hashing with Base64URL Encoding
 *
 * This module provides a convenient function that combines Blake2b hashing
 * with base64url encoding, which is the standard format used in Kadena
 * for content addressing and hash representations.
 *
 * Base64URL encoding is URL-safe and doesn't require padding, making it
 * ideal for use in web applications and APIs.
 */

import { toBase64Url } from "../encoding";
import { blake2b } from "./blake2b";

/**
 * Computes Blake2b hash and encodes the result as base64url.
 *
 * This is a convenience function that combines Blake2b hashing with base64url
 * encoding in a single operation. It's commonly used in Kadena applications
 * for creating content addresses and hash identifiers.
 *
 * The function produces a 32-byte (256-bit) Blake2b hash and encodes it
 * as a base64url string, which is URL-safe and doesn't require padding.
 *
 * @param input - The data to hash (string or byte array)
 * @returns Base64url-encoded Blake2b hash
 *
 * @example
 * ```typescript
 * // Hash string data
 * const hash1 = blake2bBase64Url("hello world");
 * console.log(hash1); // "qjR8FbrGvqMG_SBT7nM3UjIcbOQ6MqIHrOdPMf8QTYM"
 *
 * // Hash binary data
 * const data = new TextEncoder().encode("hello world");
 * const hash2 = blake2bBase64Url(data);
 * // hash1 and hash2 are identical
 *
 * // Use for content addressing
 * const content = JSON.stringify({ message: "Hello, Kadena!" });
 * const contentHash = blake2bBase64Url(content);
 * ```
 */
export function blake2bBase64Url(input: string | Uint8Array): string {
  return toBase64Url(blake2b(input, undefined, 32));
}
