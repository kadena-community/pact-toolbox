/**
 * @fileoverview Encryption utilities for secure key storage
 *
 * Provides simple functions for encrypting and decrypting sensitive data
 * using Web Crypto API with AES-GCM and PBKDF2 key derivation.
 */

import { assertWebCrypto } from "./assertions";

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  iterations: number;
  keyDerivation: "PBKDF2";
  cipher: "AES-GCM";
}

/**
 * Default encryption parameters
 */
const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  assertWebCrypto();
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();

  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt data with a password using AES-GCM
 *
 * @param data - The data to encrypt
 * @param password - The password for encryption
 * @returns Encrypted data with metadata
 *
 * @example
 * ```typescript
 * const privateKey = "0x1234...";
 * const encrypted = await encrypt(privateKey, "mySecurePassword");
 * console.log(encrypted.ciphertext); // Base64 encoded ciphertext
 * ```
 */
export async function encrypt(data: string, password: string): Promise<EncryptedData> {
  assertWebCrypto();
  const crypto = globalThis.crypto;

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive encryption key from password
  const key = await deriveKey(password, salt);

  // Encrypt the data
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(data),
  );

  // Convert to base64 for storage
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    iterations: ITERATIONS,
    keyDerivation: "PBKDF2",
    cipher: "AES-GCM",
  };
}

/**
 * Decrypt data with a password
 *
 * @param encryptedData - The encrypted data structure
 * @param password - The password for decryption
 * @returns Decrypted string
 * @throws Error if decryption fails (wrong password or corrupted data)
 *
 * @example
 * ```typescript
 * const decrypted = await decrypt(encrypted, "mySecurePassword");
 * console.log(decrypted); // Original private key
 * ```
 */
export async function decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
  assertWebCrypto();
  const crypto = globalThis.crypto;

  // Convert from base64
  const ciphertext = Uint8Array.from(atob(encryptedData.ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedData.iv), (c) => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(encryptedData.salt), (c) => c.charCodeAt(0));

  // Derive decryption key from password
  const key = await deriveKey(password, salt);

  try {
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Failed to decrypt - incorrect password or corrupted data");
  }
}

/**
 * Hash a password for verification (not for encryption)
 *
 * @param password - Password to hash
 * @returns Base64 encoded hash
 *
 * @example
 * ```typescript
 * const hash = await hashPassword("myPassword");
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  assertWebCrypto();
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Generate a cryptographically secure random password
 *
 * @param length - Password length (default: 32)
 * @returns Random password string
 *
 * @example
 * ```typescript
 * const password = generateSecurePassword(24);
 * console.log(password); // e.g., "aB3$xY9@mN5#pQ2&rS7*tU1!"
 * ```
 */
export function generateSecurePassword(length = 32): string {
  assertWebCrypto();
  const crypto = globalThis.crypto;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues)
    .map((byte) => charset[byte % charset.length])
    .join("");
}

/**
 * Generate a cryptographically secure random string (URL-safe)
 *
 * @param length - String length in bytes (default: 32)
 * @returns URL-safe random string
 *
 * @example
 * ```typescript
 * const token = generateRandomString(16);
 * console.log(token); // e.g., "a1B2c3D4e5F6g7H8"
 * ```
 */
export function generateRandomString(length = 32): string {
  assertWebCrypto();
  const crypto = globalThis.crypto;
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...randomValues))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Check if an object is encrypted data
 *
 * @param data - Data to check
 * @returns True if data matches EncryptedData structure
 */
export function isEncryptedData(data: unknown): data is EncryptedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "ciphertext" in data &&
    "iv" in data &&
    "salt" in data &&
    "iterations" in data &&
    "keyDerivation" in data &&
    "cipher" in data
  );
}
