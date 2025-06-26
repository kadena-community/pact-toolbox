import { describe, test, expect } from 'vitest';
import { 
  toHex, fromHex, isValidHex,
  toBase64, fromBase64, isValidBase64,
  toBase64Url, fromBase64Url, isValidBase64Url,
  toUtf8, fromUtf8,
  hex, base64, base64url, utf8, encodings,
  isUint8Array, isEncodingFormat
} from './encoding';

describe('Simple Encoding Utilities', () => {
  describe('Hexadecimal encoding', () => {
    test('toHex converts bytes to hex string', () => {
      const bytes = new Uint8Array([255, 0, 128, 64]);
      const result = toHex(bytes);
      
      expect(result).toBe('ff008040');
      expect(typeof result).toBe('string');
    });

    test('fromHex converts hex string to bytes', () => {
      const hex = 'ff008040';
      const result = fromHex(hex);
      
      expect(result).toEqual(new Uint8Array([255, 0, 128, 64]));
      expect(result).toBeInstanceOf(Uint8Array);
    });

    test('handles empty data', () => {
      const empty = new Uint8Array(0);
      expect(toHex(empty)).toBe('');
      expect(fromHex('')).toEqual(empty);
    });

    test('handles case insensitive input', () => {
      const bytes = new Uint8Array([255, 170]);
      
      expect(fromHex('FFAA')).toEqual(bytes);
      expect(fromHex('ffaa')).toEqual(bytes);
      expect(fromHex('FfAa')).toEqual(bytes);
    });

    test('validates hex strings', () => {
      expect(isValidHex('ff008040')).toBe(true);
      expect(isValidHex('FFAA')).toBe(true);
      expect(isValidHex('')).toBe(true);
      
      expect(isValidHex('xyz')).toBe(false);
      expect(isValidHex('ff0')).toBe(false); // Odd length
      expect(isValidHex('gg')).toBe(false); // Invalid chars
    });

    test('throws on invalid input', () => {
      expect(() => toHex('not bytes' as any)).toThrow('toHex: Expected Uint8Array');
      expect(() => fromHex(123 as any)).toThrow('fromHex: Expected string');
      expect(() => fromHex('xyz')).toThrow('fromHex: Invalid hex characters');
      expect(() => fromHex('ff0')).toThrow('fromHex: Hex string must have even length');
    });

    test('round trip encoding', () => {
      const original = new Uint8Array([1, 2, 3, 255, 128, 0]);
      const encoded = toHex(original);
      const decoded = fromHex(encoded);
      
      expect(decoded).toEqual(original);
    });
  });

  describe('Base64 encoding', () => {
    test('toBase64 converts bytes to base64 string', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = toBase64(bytes);
      
      expect(result).toBe('SGVsbG8=');
      expect(typeof result).toBe('string');
    });

    test('fromBase64 converts base64 string to bytes', () => {
      const b64 = 'SGVsbG8=';
      const result = fromBase64(b64);
      
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(result).toBeInstanceOf(Uint8Array);
    });

    test('handles empty data', () => {
      const empty = new Uint8Array(0);
      expect(toBase64(empty)).toBe('');
      expect(fromBase64('')).toEqual(empty);
    });

    test('validates base64 strings', () => {
      expect(isValidBase64('SGVsbG8=')).toBe(true);
      expect(isValidBase64('AQID')).toBe(true);
      expect(isValidBase64('')).toBe(true);
      
      expect(isValidBase64('SGVsbG8')).toBe(false); // Missing padding
      expect(isValidBase64('SGVs@G8=')).toBe(false); // Invalid char
      expect(isValidBase64('SGVsb==')).toBe(false); // Wrong padding length
    });

    test('throws on invalid input', () => {
      expect(() => toBase64('not bytes' as any)).toThrow('toBase64: Expected Uint8Array');
      expect(() => fromBase64(123 as any)).toThrow('fromBase64: Expected string');
      expect(() => fromBase64('invalid@base64')).toThrow('fromBase64: Invalid base64 string');
    });

    test('round trip encoding', () => {
      const original = new Uint8Array([1, 2, 3, 4, 255, 128, 0]);
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      
      expect(decoded).toEqual(original);
    });
  });

  describe('Base64URL encoding', () => {
    test('toBase64Url converts bytes to base64url string', () => {
      const bytes = new Uint8Array([255, 255, 255]);
      const result = toBase64Url(bytes);
      
      expect(result).toBe('____');
      expect(typeof result).toBe('string');
    });

    test('fromBase64Url converts base64url string to bytes', () => {
      const b64url = '____';
      const result = fromBase64Url(b64url);
      
      expect(result).toEqual(new Uint8Array([255, 255, 255]));
      expect(result).toBeInstanceOf(Uint8Array);
    });

    test('uses URL-safe characters', () => {
      const bytes = new Uint8Array([62, 63, 64]); // Would be +/A in standard base64
      const encoded = toBase64Url(bytes);
      
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('='); // No padding
    });

    test('validates base64url strings', () => {
      expect(isValidBase64Url('abc-_123')).toBe(true);
      expect(isValidBase64Url('____')).toBe(true);
      expect(isValidBase64Url('')).toBe(true);
      
      expect(isValidBase64Url('abc+/123')).toBe(false); // Standard base64 chars
      expect(isValidBase64Url('abc=')).toBe(false); // Has padding
    });

    test('throws on invalid input', () => {
      expect(() => toBase64Url('not bytes' as any)).toThrow('toBase64Url: Expected Uint8Array');
      expect(() => fromBase64Url(123 as any)).toThrow('fromBase64Url: Expected string');
      expect(() => fromBase64Url('abc+def')).toThrow('fromBase64Url: Invalid base64url string');
    });

    test('round trip encoding', () => {
      const original = new Uint8Array([255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);
      
      expect(decoded).toEqual(original);
    });
  });

  describe('UTF-8 encoding', () => {
    test('toUtf8 converts text to UTF-8 bytes', () => {
      const text = 'Hello, World!';
      const result = toUtf8(text);
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33]));
    });

    test('fromUtf8 converts UTF-8 bytes to text', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33]);
      const result = fromUtf8(bytes);
      
      expect(result).toBe('Hello, World!');
      expect(typeof result).toBe('string');
    });

    test('handles Unicode characters', () => {
      const text = 'Hello, 世界! 🌍';
      const bytes = toUtf8(text);
      const decoded = fromUtf8(bytes);
      
      expect(decoded).toBe(text);
    });

    test('handles emojis', () => {
      const emoji = '🚀🎉🔥💯';
      const bytes = toUtf8(emoji);
      const decoded = fromUtf8(bytes);
      
      expect(decoded).toBe(emoji);
    });

    test('handles empty strings', () => {
      const empty = '';
      const bytes = toUtf8(empty);
      const decoded = fromUtf8(bytes);
      
      expect(bytes).toEqual(new Uint8Array(0));
      expect(decoded).toBe(empty);
    });

    test('throws on invalid input', () => {
      expect(() => toUtf8(123 as any)).toThrow('toUtf8: Expected string');
      expect(() => fromUtf8('not bytes' as any)).toThrow('fromUtf8: Expected Uint8Array');
    });

    test('round trip encoding', () => {
      const original = 'Mixed: ASCII, 中文, العربية, 🎭🎨🎪';
      const bytes = toUtf8(original);
      const decoded = fromUtf8(bytes);
      
      expect(decoded).toBe(original);
    });
  });

  describe('Convenience objects', () => {
    test('hex object provides clean API', () => {
      const bytes = new Uint8Array([255, 128, 0]);
      
      expect(hex.encode(bytes)).toBe('ff8000');
      expect(hex.decode('ff8000')).toEqual(bytes);
      expect(hex.isValid('ff8000')).toBe(true);
      expect(hex.isValid('xyz')).toBe(false);
    });

    test('base64 object provides clean API', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const encoded = base64.encode(bytes);
      
      expect(base64.decode(encoded)).toEqual(bytes);
      expect(base64.isValid(encoded)).toBe(true);
      expect(base64.isValid('invalid@')).toBe(false);
    });

    test('base64url object provides clean API', () => {
      const bytes = new Uint8Array([255, 255]);
      const encoded = base64url.encode(bytes);
      
      expect(base64url.decode(encoded)).toEqual(bytes);
      expect(base64url.isValid(encoded)).toBe(true);
      expect(base64url.isValid('abc+')).toBe(false);
    });

    test('utf8 object provides clean API', () => {
      const text = 'Hello, 世界!';
      const bytes = utf8.encode(text);
      
      expect(utf8.decode(bytes)).toBe(text);
    });

    test('encodings collection provides access to all utilities', () => {
      expect(encodings.hex).toBe(hex);
      expect(encodings.base64).toBe(base64);
      expect(encodings.base64url).toBe(base64url);
      expect(encodings.utf8).toBe(utf8);
    });
  });

  describe('Type guards', () => {
    test('isUint8Array correctly identifies Uint8Array', () => {
      expect(isUint8Array(new Uint8Array([1, 2, 3]))).toBe(true);
      expect(isUint8Array(new ArrayBuffer(10))).toBe(false);
      expect(isUint8Array([1, 2, 3])).toBe(false);
      expect(isUint8Array('string')).toBe(false);
      expect(isUint8Array(null)).toBe(false);
    });

    test('isEncodingFormat correctly identifies encoding names', () => {
      expect(isEncodingFormat('hex')).toBe(true);
      expect(isEncodingFormat('base64')).toBe(true);
      expect(isEncodingFormat('base64url')).toBe(true);
      expect(isEncodingFormat('utf8')).toBe(true);
      expect(isEncodingFormat('invalid')).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('provides clear error messages', () => {
      try {
        toHex('not bytes' as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('toHex: Expected Uint8Array');
      }
      
      try {
        fromBase64('invalid@base64');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('fromBase64: Invalid base64 string');
      }
    });

    test('handles edge cases gracefully', () => {
      // Very large data
      const largeData = new Uint8Array(10000).fill(255);
      expect(() => toHex(largeData)).not.toThrow();
      
      // Maximum Unicode codepoint
      const maxUnicode = String.fromCodePoint(0x10FFFF);
      expect(() => toUtf8(maxUnicode)).not.toThrow();
    });
  });

  describe('Cross-platform compatibility', () => {
    test('handles different environments', () => {
      // These should work regardless of environment (Node.js, browser, etc.)
      const testData = new Uint8Array([1, 2, 3, 4, 255]);
      
      // All encodings should work
      expect(() => toHex(testData)).not.toThrow();
      expect(() => toBase64(testData)).not.toThrow();
      expect(() => toBase64Url(testData)).not.toThrow();
      
      const testText = 'Test 🌍';
      expect(() => toUtf8(testText)).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('handles large data efficiently', () => {
      const largeData = new Uint8Array(50000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      
      const start = Date.now();
      const encoded = toHex(largeData);
      const decoded = fromHex(encoded);
      const end = Date.now();
      
      expect(decoded).toEqual(largeData);
      expect(end - start).toBeLessThan(500); // Should complete quickly
    });
  });
});