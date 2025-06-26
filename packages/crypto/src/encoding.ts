/**
 * @fileoverview Simple Cross-Platform Encoding Utilities
 * 
 * This module provides straightforward encoding/decoding functions that work
 * consistently across Node.js, browsers, and React Native. No complex codec
 * system - just simple, reliable utility functions.
 * 
 * @example
 * ```typescript
 * import { toHex, fromHex, toBase64, fromBase64, toUtf8, fromUtf8 } from '@pact-toolbox/crypto';
 * 
 * // Hex encoding
 * const bytes = new Uint8Array([255, 0, 128]);
 * const hex = toHex(bytes); // "ff0080"
 * const decoded = fromHex(hex); // Uint8Array([255, 0, 128])
 * 
 * // Base64 encoding
 * const b64 = toBase64(bytes); // "/wCA"
 * const decoded2 = fromBase64(b64); // Uint8Array([255, 0, 128])
 * ```
 */

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Asserts that a value is a Uint8Array.
 * 
 * @param value - The value to check
 * @param operation - The operation name for error messages
 * @throws {Error} When the value is not a Uint8Array
 */
function assertUint8Array(value: unknown, operation: string): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new Error(`${operation}: Expected Uint8Array, got ${typeof value}`);
  }
}

/**
 * Asserts that a value is a string.
 * 
 * @param value - The value to check
 * @param operation - The operation name for error messages
 * @throws {Error} When the value is not a string
 */
function assertString(value: unknown, operation: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${operation}: Expected string, got ${typeof value}`);
  }
}

// ============================================================================
// Hexadecimal (Base16) Encoding
// ============================================================================

const HEX_CHARS = '0123456789abcdef';
const HEX_REGEX = /^[0-9a-fA-F]*$/;

/**
 * Convert bytes to hexadecimal string.
 * 
 * @param bytes - The bytes to encode
 * @returns Lowercase hexadecimal string
 * 
 * @example
 * ```typescript
 * const bytes = new Uint8Array([255, 128, 0]);
 * const hex = toHex(bytes); // "ff8000"
 * ```
 */
export function toHex(bytes: Uint8Array): string {
  assertUint8Array(bytes, 'toHex');
  
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    result += HEX_CHARS[byte >> 4]! + HEX_CHARS[byte & 0x0f]!;
  }
  return result;
}

/**
 * Convert hexadecimal string to bytes.
 * 
 * @param hex - Hexadecimal string (case insensitive)
 * @returns The decoded bytes
 * @throws {Error} If the hex string is invalid
 * 
 * @example
 * ```typescript
 * const bytes = fromHex("ff8000"); // Uint8Array([255, 128, 0])
 * const bytes2 = fromHex("FF8000"); // Also works (case insensitive)
 * ```
 */
export function fromHex(hex: string): Uint8Array {
  assertString(hex, 'fromHex');
  
  if (!HEX_REGEX.test(hex)) {
    throw new Error('fromHex: Invalid hex characters');
  }
  
  if (hex.length % 2 !== 0) {
    throw new Error('fromHex: Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Check if a string is valid hexadecimal.
 * 
 * @param value - String to validate
 * @returns True if valid hex string
 * 
 * @example
 * ```typescript
 * isValidHex("ff8000"); // true
 * isValidHex("xyz"); // false
 * isValidHex("ff800"); // false (odd length)
 * ```
 */
export function isValidHex(value: string): boolean {
  return typeof value === 'string' && 
         value.length % 2 === 0 && 
         HEX_REGEX.test(value);
}

// ============================================================================
// Base64 Encoding (Standard)
// ============================================================================

/**
 * Convert bytes to base64 string.
 * Uses the standard Base64 alphabet with padding.
 * 
 * @param bytes - The bytes to encode
 * @returns Base64 encoded string
 * 
 * @example
 * ```typescript
 * const bytes = new Uint8Array([72, 101, 108, 108, 111]);
 * const b64 = toBase64(bytes); // "SGVsbG8="
 * ```
 */
export function toBase64(bytes: Uint8Array): string {
  assertUint8Array(bytes, 'toBase64');
  
  // Use browser btoa or Node.js Buffer
  if (typeof btoa !== 'undefined') {
    // Browser environment
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  } else {
    // Node.js environment
    return Buffer.from(bytes).toString('base64');
  }
}

/**
 * Convert base64 string to bytes.
 * 
 * @param b64 - Base64 encoded string
 * @returns The decoded bytes
 * @throws {Error} If the base64 string is invalid
 * 
 * @example
 * ```typescript
 * const bytes = fromBase64("SGVsbG8="); // Uint8Array([72, 101, 108, 108, 111])
 * ```
 */
export function fromBase64(b64: string): Uint8Array {
  assertString(b64, 'fromBase64');
  
  try {
    if (typeof atob !== 'undefined') {
      // Browser environment
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      // Node.js environment
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
  } catch (error) {
    throw new Error(`fromBase64: Invalid base64 string - ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Check if a string is valid base64.
 * 
 * @param value - String to validate
 * @returns True if valid base64 string
 * 
 * @example
 * ```typescript
 * isValidBase64("SGVsbG8="); // true
 * isValidBase64("invalid@"); // false
 * ```
 */
export function isValidBase64(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length % 4 !== 0) return false;
  
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(value);
}

// ============================================================================
// Base64URL Encoding (URL-safe)
// ============================================================================

/**
 * Convert bytes to base64url string (URL-safe base64).
 * Uses URL-safe characters and no padding.
 * 
 * @param bytes - The bytes to encode
 * @returns Base64URL encoded string
 * 
 * @example
 * ```typescript
 * const bytes = new Uint8Array([255, 255, 255]);
 * const b64url = toBase64Url(bytes); // "____"
 * ```
 */
export function toBase64Url(bytes: Uint8Array): string {
  assertUint8Array(bytes, 'toBase64Url');
  
  const b64 = toBase64(bytes);
  return b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert base64url string to bytes.
 * 
 * @param b64url - Base64URL encoded string
 * @returns The decoded bytes
 * @throws {Error} If the base64url string is invalid
 * 
 * @example
 * ```typescript
 * const bytes = fromBase64Url("____"); // Uint8Array([255, 255, 255])
 * ```
 */
export function fromBase64Url(b64url: string): Uint8Array {
  assertString(b64url, 'fromBase64Url');
  
  if (!isValidBase64Url(b64url)) {
    throw new Error('fromBase64Url: Invalid base64url string');
  }
  
  try {
    // Convert back to standard base64
    let b64 = b64url
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    const padding = 4 - (b64.length % 4);
    if (padding !== 4) {
      b64 += '='.repeat(padding);
    }
    
    return fromBase64(b64);
  } catch (error) {
    throw new Error(`fromBase64Url: Invalid base64url string - ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Check if a string is valid base64url.
 * 
 * @param value - String to validate
 * @returns True if valid base64url string
 * 
 * @example
 * ```typescript
 * isValidBase64Url("abc-_123"); // true
 * isValidBase64Url("abc+/123"); // false (contains +/)
 * ```
 */
export function isValidBase64Url(value: string): boolean {
  if (typeof value !== 'string') return false;
  
  const base64UrlRegex = /^[A-Za-z0-9_-]*$/;
  return base64UrlRegex.test(value);
}

// ============================================================================
// UTF-8 Text Encoding
// ============================================================================

/**
 * Convert string to UTF-8 bytes.
 * 
 * @param text - The text to encode
 * @returns UTF-8 encoded bytes
 * 
 * @example
 * ```typescript
 * const bytes = toUtf8("Hello, 世界!"); // Uint8Array with UTF-8 bytes
 * ```
 */
export function toUtf8(text: string): Uint8Array {
  assertString(text, 'toUtf8');
  
  if (typeof TextEncoder !== 'undefined') {
    // Modern browsers and Node.js 18+
    return new TextEncoder().encode(text);
  } else {
    // Node.js fallback
    return new Uint8Array(Buffer.from(text, 'utf8'));
  }
}

/**
 * Convert UTF-8 bytes to string.
 * 
 * @param bytes - UTF-8 encoded bytes
 * @returns The decoded text
 * @throws {Error} If the bytes are not valid UTF-8
 * 
 * @example
 * ```typescript
 * const text = fromUtf8(bytes); // "Hello, 世界!"
 * ```
 */
export function fromUtf8(bytes: Uint8Array): string {
  assertUint8Array(bytes, 'fromUtf8');
  
  try {
    if (typeof TextDecoder !== 'undefined') {
      // Modern browsers and Node.js 18+
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } else {
      // Node.js fallback
      return Buffer.from(bytes).toString('utf8');
    }
  } catch (error) {
    throw new Error(`fromUtf8: Invalid UTF-8 bytes - ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

// ============================================================================
// Convenience Collections
// ============================================================================

/**
 * Collection of hex utilities.
 */
export const hex: {
  readonly encode: (bytes: Uint8Array) => string;
  readonly decode: (hex: string) => Uint8Array;
  readonly isValid: (value: string) => boolean;
} = {
  encode: toHex,
  decode: fromHex,
  isValid: isValidHex
} as const;

/**
 * Collection of base64 utilities.
 */
export const base64: {
  readonly encode: (bytes: Uint8Array) => string;
  readonly decode: (b64: string) => Uint8Array;
  readonly isValid: (value: string) => boolean;
} = {
  encode: toBase64,
  decode: fromBase64,
  isValid: isValidBase64
} as const;

/**
 * Collection of base64url utilities.
 */
export const base64url: {
  readonly encode: (bytes: Uint8Array) => string;
  readonly decode: (b64url: string) => Uint8Array;
  readonly isValid: (value: string) => boolean;
} = {
  encode: toBase64Url,
  decode: fromBase64Url,
  isValid: isValidBase64Url
} as const;

/**
 * Collection of UTF-8 utilities.
 */
export const utf8: {
  readonly encode: (text: string) => Uint8Array;
  readonly decode: (bytes: Uint8Array) => string;
} = {
  encode: toUtf8,
  decode: fromUtf8
} as const;

/**
 * All encoding utilities in one object.
 * 
 * @example
 * ```typescript
 * import { encodings } from '@pact-toolbox/crypto';
 * 
 * const data = new Uint8Array([1, 2, 3]);
 * const hex = encodings.hex.encode(data);
 * const b64 = encodings.base64.encode(data);
 * ```
 */
export const encodings: {
  readonly hex: typeof hex;
  readonly base64: typeof base64;
  readonly base64url: typeof base64url;
  readonly utf8: typeof utf8;
} = {
  hex,
  base64,
  base64url,
  utf8
} as const;

// ============================================================================
// Type Guards for Runtime Safety
// ============================================================================

/**
 * Type guard to check if a value is a Uint8Array.
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/**
 * Type guard to check if a value is a valid encoding format name.
 */
export function isEncodingFormat(value: string): value is keyof typeof encodings {
  return value in encodings;
}