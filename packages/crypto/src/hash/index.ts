/**
 * @fileoverview Blake2b Cryptographic Hashing
 * 
 * This module provides Blake2b hashing functionality, which is used extensively
 * in Kadena's blockchain for content addressing and cryptographic operations.
 * 
 * Blake2b is a cryptographically secure hash function that's faster than SHA-3
 * while providing equivalent security. It produces 256-bit (32-byte) hashes by default.
 * 
 * The module includes both raw Blake2b hashing and base64url-encoded variants
 * commonly used in Kadena applications.
 */

export * from "./base64-url-blake2b";
export * from "./blake2b";
