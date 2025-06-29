/**
 * @fileoverview Pact Toolbox Crypto Library
 *
 * A comprehensive cryptographic utility library for Kadena/Pact development.
 * Provides secure Ed25519 key operations, Blake2b hashing, multiple encoding/decoding formats,
 * Kadena address validation, and deterministic JSON serialization.
 *
 * This library automatically installs polyfills for Ed25519 support in environments
 * where native implementation is not available.
 *
 * @example
 * ```typescript
 * import { generateKeyPair, blake2bBase64Url, address } from '@pact-toolbox/crypto';
 *
 * // Generate Ed25519 key pair
 * const keyPair = await generateKeyPair();
 *
 * // Hash data with Blake2b
 * const hash = blake2bBase64Url("hello world");
 *
 * // Validate Kadena address
 * const addr = address("a1b2c3d4e5f6..."); // throws if invalid
 * ```
 *
 * @author Pact Toolbox Team
 * @version 1.0.0
 */

// Install polyfill for Ed25519 support
import { install } from "./polyfill/install";
install();

export * from "./address";
export * from "./assertions";
export * from "./encoding";
export * from "./hash";
export * from "./keys";
export * from "./stringify";
