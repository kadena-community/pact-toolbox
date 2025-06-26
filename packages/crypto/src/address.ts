/**
 * @fileoverview Kadena Address Validation and K:Account Utilities
 * 
 * This module provides comprehensive address validation and k:account handling for the Kadena blockchain.
 * Addresses in Kadena are 32-byte hex-encoded strings representing public key hashes.
 * K:accounts are a special address format prefixed with "k:" followed by a valid address.
 */

import { assertKeyExporterIsAvailable } from "./assertions";
import { fromHex, toHex } from "./encoding";
import { generateExtractableKeyPair } from "./keys/keys";

/**
 * A branded type representing a valid Kadena address.
 * 
 * Kadena addresses are 32-byte hex-encoded strings representing cryptographic hashes.
 * The brand ensures type safety by preventing regular strings from being used as addresses
 * without proper validation.
 * 
 * @template TAddress - The specific string literal type of the address
 * 
 * @example
 * ```typescript
 * const addr: Address = address("a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890");
 * ```
 */
export type Address<TAddress extends string = string> = TAddress & {
  readonly __brand: unique symbol;
};

/**
 * Type predicate to check if a string is a valid Kadena address.
 * 
 * Performs both fast-path length validation and slow-path hex decoding validation.
 * A valid address must be exactly 32 bytes when decoded from hexadecimal.
 * 
 * @param putativeAddress - The string to validate as an address
 * @returns True if the string is a valid address, false otherwise
 * 
 * @example
 * ```typescript
 * if (isAddress("a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890")) {
 *   // putativeAddress is now typed as Address
 *   console.log("Valid address!");
 * }
 * ```
 */
export function isAddress(putativeAddress: string): putativeAddress is Address<typeof putativeAddress> {
  // Fast-path; see if the input string is of an acceptable length.
  // Kadena addresses are 32 bytes encoded as hex strings (64 characters)
  if (putativeAddress.length !== 64) {
    return false;
  }
  // Slow-path; actually attempt to decode the input string.
  try {
    const bytes = fromHex(putativeAddress);
    const numBytes = bytes.byteLength;
    if (numBytes !== 32) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Assertion function to validate that a string is a valid Kadena address.
 * 
 * Throws an error if the address is invalid, otherwise narrows the type to Address.
 * Performs the same validation as `isAddress` but throws instead of returning false.
 * 
 * @param putativeAddress - The string to validate as an address
 * @throws {Error} When the address format is invalid or has incorrect byte length
 * 
 * @example
 * ```typescript
 * try {
 *   assertIsAddress("invalid");
 * } catch (error) {
 *   console.error("Invalid address:", error.message);
 * }
 * ```
 */
export function assertIsAddress(putativeAddress: string): asserts putativeAddress is Address<typeof putativeAddress> {
  // Fast-path; see if the input string is of an acceptable length.
  // Kadena addresses are 32 bytes encoded as hex strings (64 characters)
  if (putativeAddress.length !== 64) {
    throw new Error(`Invalid address length: ${putativeAddress.length} characters (expected 64)`);
  }
  // Slow-path; actually attempt to decode the input string.
  try {
    const bytes = fromHex(putativeAddress);
    const numBytes = bytes.byteLength;
    if (numBytes !== 32) {
      throw new Error(`Invalid address length: ${numBytes} bytes (expected 32)`);
    }
  } catch (error) {
    throw new Error(`Invalid address format: ${error instanceof Error ? error.message : 'invalid hex'}`);  
  }
}

/**
 * Creates a validated Address from a string.
 * 
 * This is the primary way to create Address instances with full type safety.
 * The function validates the input and returns a branded Address type.
 * 
 * @template TAddress - The specific string literal type being validated
 * @param putativeAddress - The string to validate and convert to an Address
 * @returns A validated Address instance
 * @throws {Error} When the address format is invalid
 * 
 * @example
 * ```typescript
 * const addr = address("a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890");
 * // addr is now of type Address<"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890">
 * ```
 */
export function address<TAddress extends string = string>(putativeAddress: TAddress): Address<TAddress> {
  assertIsAddress(putativeAddress);
  return putativeAddress as Address<TAddress>;
}

/**
 * Converts an Address to its byte representation.
 * 
 * @param addr - The address to convert to bytes
 * @returns 32-byte array representing the address
 * @throws {Error} When the address is invalid
 * 
 * @example
 * ```typescript
 * const addr = address("a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890");
 * const bytes = addressToBytes(addr);
 * ```
 */
export function addressToBytes(addr: Address): Uint8Array {
  return fromHex(addr);
}

/**
 * Converts bytes to an Address.
 * 
 * @param bytes - 32-byte array to convert to address
 * @returns Validated Address instance
 * @throws {Error} When the bytes don't represent a valid address
 * 
 * @example
 * ```typescript
 * const bytes = new Uint8Array(32); // 32 bytes
 * const addr = bytesToAddress(bytes);
 * ```
 */
export function bytesToAddress(bytes: Uint8Array): Address {
  if (bytes.length !== 32) {
    throw new Error(`Invalid address bytes length: ${bytes.length} (expected 32)`);
  }
  const hexString = toHex(bytes);
  return address(hexString);
}

/**
 * Gets a consistent address comparator function.
 * 
 * Returns a function that can be used to sort addresses in a consistent,
 * deterministic order using internationalization-aware string comparison.
 * 
 * @returns A comparator function for sorting addresses
 * 
 * @example
 * ```typescript
 * const addresses = [addr1, addr2, addr3];
 * const comparator = getAddressComparator();
 * const sorted = addresses.sort(comparator);
 * ```
 */
export function getAddressComparator(): (x: string, y: string) => number {
  return new Intl.Collator("en", {
    caseFirst: "lower",
    ignorePunctuation: false,
    localeMatcher: "best fit",
    numeric: false,
    sensitivity: "variant",
    usage: "sort",
  }).compare;
}

/**
 * Exports a CryptoKey to a hexadecimal string representation.
 * 
 * This function extracts the raw bytes from an Ed25519 CryptoKey and converts
 * them to a hexadecimal string. The key must be extractable and use the Ed25519 algorithm.
 * 
 * **Security Note**: Only use this function when you need the raw key material.
 * Exported keys should be handled securely and never exposed in logs or transmitted
 * over insecure channels.
 * 
 * @param key - The CryptoKey to export (must be extractable and Ed25519)
 * @returns A promise that resolves to the hexadecimal representation of the key
 * @throws {Error} When the key is not extractable or not Ed25519
 * @throws {Error} When key export functionality is not available
 * 
 * @example
 * ```typescript
 * const keyPair = await generateExtractableKeyPair();
 * const hexKey = await exportBase16Key(keyPair.publicKey);
 * console.log(`Public key: ${hexKey}`);
 * ```
 */
export async function exportBase16Key(key: CryptoKey): Promise<string> {
  assertKeyExporterIsAvailable();
  if (!key.extractable) {
    throw new Error(`Key is not extractable`);
  }
  // Check for Ed25519 algorithm - handle both string and object forms
  const algorithmName = typeof key.algorithm === 'string' ? key.algorithm : key.algorithm.name;
  if (algorithmName !== "Ed25519") {
    throw new Error(`Key has an invalid algorithm: ${algorithmName}`);
  }
  const keyBytes = await crypto.subtle.exportKey("raw", key);
  const uint8Array = new Uint8Array(keyBytes);
  
  // Convert bytes to hex string using new encoding utilities
  return toHex(uint8Array);
}

/**
 * A branded type representing a valid Kadena k:account.
 * 
 * K:accounts are Kadena's standard account format consisting of the prefix "k:"
 * followed by a valid 32-byte address. They represent accounts derived from
 * public keys and are the most common account type in Kadena.
 * 
 * @example
 * ```typescript
 * const account: KAccount = kAccount("k:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890");
 * ```
 */
export type KAccount = `k:${Address<string>}` & {
  readonly __brand: unique symbol;
};

/**
 * Type predicate to check if a string is a valid k:account.
 * 
 * Validates that the string starts with "k:" and the remainder is a valid address.
 * 
 * @param putativeAccount - The string to validate as a k:account
 * @returns True if the string is a valid k:account, false otherwise
 * 
 * @example
 * ```typescript
 * if (isKAccount("k:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890")) {
 *   // putativeAccount is now typed as KAccount
 *   console.log("Valid k:account!");
 * }
 * ```
 */
export function isKAccount(putativeAccount: string): putativeAccount is KAccount {
  return putativeAccount.startsWith("k:") && isAddress(putativeAccount.slice(2));
}

/**
 * Assertion function to validate that a string is a valid k:account.
 * 
 * Throws an error if the k:account is invalid, otherwise narrows the type to KAccount.
 * 
 * @param putativeAccount - The string to validate as a k:account
 * @throws {Error} When the account format is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   assertIsKAccount("invalid");
 * } catch (error) {
 *   console.error("Invalid k:account:", error.message);
 * }
 * ```
 */
export function assertIsKAccount(putativeAccount: string): asserts putativeAccount is KAccount {
  if (!isKAccount(putativeAccount)) {
    throw new Error(`Invalid account: ${putativeAccount}`);
  }
}

/**
 * Creates a validated KAccount from a string.
 * 
 * This is the primary way to create KAccount instances with full type safety.
 * The function validates the input and returns a branded KAccount type.
 * 
 * @param putativeAccount - The string to validate and convert to a KAccount
 * @returns A validated KAccount instance
 * @throws {Error} When the account format is invalid
 * 
 * @example
 * ```typescript
 * const account = kAccount("k:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890");
 * ```
 */
export function kAccount(putativeAccount: string): KAccount {
  assertIsKAccount(putativeAccount);
  return putativeAccount as KAccount;
}

/**
 * Derives a k:account from a public key.
 * 
 * This function exports the public key as a hexadecimal address and creates
 * a k:account by prefixing it with "k:". This is the standard way to derive
 * account names from Ed25519 public keys in Kadena.
 * 
 * @param publicKey - The Ed25519 public key (must be extractable)
 * @returns A promise that resolves to the derived KAccount
 * @throws {Error} When the key cannot be exported or is invalid
 * 
 * @example
 * ```typescript
 * const keyPair = await generateExtractableKeyPair();
 * const account = await getKAccountFromPublicKey(keyPair.publicKey);
 * console.log(`Account: ${account}`);
 * ```
 */
export async function getKAccountFromPublicKey(publicKey: CryptoKey): Promise<KAccount> {
  const address = await exportBase16Key(publicKey);
  return kAccount(`k:${address}`);
}

/**
 * Represents a key pair with hexadecimal string representations.
 * 
 * This interface provides string-based access to key material, which is useful
 * for serialization, storage, or transmission. Both keys are represented as
 * hexadecimal strings.
 * 
 * **Security Warning**: Private keys in this format should be handled with
 * extreme care and never exposed in logs or transmitted over insecure channels.
 */
interface KeyPair {
  /** The public key as a hexadecimal string */
  publicKey: string;
  /** The private key as a hexadecimal string */
  privateKey: string;
}

/**
 * Generates a new Ed25519 key pair and exports both keys as hexadecimal strings.
 * 
 * This is a convenience function that combines key generation with export.
 * The generated keys are extractable and suitable for use in Kadena applications.
 * 
 * **Security Warning**: The returned private key is in plain text format.
 * Handle it securely and consider using non-extractable keys when possible.
 * 
 * @returns A promise that resolves to a KeyPair with hex-encoded keys
 * @throws {Error} When key generation or export fails
 * 
 * @example
 * ```typescript
 * const { publicKey, privateKey } = await genKeyPair();
 * console.log(`Public: ${publicKey}`);
 * // Store privateKey securely - never log it!
 * ```
 */
export async function genKeyPair(): Promise<KeyPair> {
  const keyPair = await generateExtractableKeyPair();
  return {
    publicKey: await exportBase16Key(keyPair.publicKey),
    privateKey: await exportBase16Key(keyPair.privateKey),
  };
}
