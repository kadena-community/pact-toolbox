# @pact-toolbox/crypto

> Cryptographic primitives and utilities for Kadena blockchain development

## Overview

The `@pact-toolbox/crypto` package provides a comprehensive set of cryptographic functions specifically designed for Kadena blockchain development. It includes Ed25519 key management, Blake2b hashing, various encoding formats, and utilities for working with Kadena's account system.

## Installation

```bash
npm install @pact-toolbox/crypto
# or
pnpm add @pact-toolbox/crypto
```

## Features

- 🔐 **Ed25519 Cryptography** - Key generation, signing, and verification
- ⚡ **Blake2b Hashing** - Fast and secure hashing algorithm
- 🎯 **Multiple Encodings** - Hex, Base64, Base64URL, UTF-8 with intuitive API
- 🌐 **Cross-Platform** - Works in Node.js, browsers, and React Native
- 🛡️ **Type Safety** - Branded types for addresses, signatures, and k-accounts
- 🚀 **Performance** - Optimized implementations with Web Crypto API
- 🧰 **Simple API** - Intuitive encoding utilities with clear naming

## Quick Start

```typescript
import {
  generateKeyPair,
  genKeyPair,
  signBytes,
  verifySignature,
  blake2b,
  toHex,
  fromUtf8,
} from "@pact-toolbox/crypto";

// Generate a new key pair
const keyPair = await generateKeyPair();

// Generate key pair with hex export
const { publicKey, privateKey } = await genKeyPair();
console.log("Public Key:", publicKey); // 64 hex characters
console.log("Private Key:", privateKey); // 64 hex characters

// Sign a message
const message = fromUtf8("Hello, Kadena!");
const signature = await signBytes(keyPair.privateKey, message);

// Verify signature
const isValid = await verifySignature(keyPair.publicKey, signature, message);

// Hash data
const hash = blake2b("data to hash", undefined, 32);
console.log("Blake2b hash:", toHex(hash));
```

## Key Management

### Key Generation

```typescript
import { generateKeyPair, generateExtractableKeyPair, genKeyPair } from "@pact-toolbox/crypto";

// Generate non-extractable key pair (secure, can't export private key)
const secureKeyPair = await generateKeyPair();

// Generate extractable key pair (can export private key)
const extractableKeyPair = await generateExtractableKeyPair();

// Generate key pair with immediate base16 export
const { publicKey, privateKey } = await genKeyPair();
// publicKey: "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"
// privateKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898"
```

### Key Import/Export

```typescript
import {
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  getPublicKeyFromPrivateKey,
  exportBase16Key,
} from "@pact-toolbox/crypto";

// From 64-byte array (32 private + 32 public)
const keyPairBytes = new Uint8Array(64);
const keyPair1 = await createKeyPairFromBytes(keyPairBytes);

// From 32-byte private key
const privateKeyBytes = new Uint8Array(32);
const keyPair2 = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);

// Get public key from private key
const publicKey = await getPublicKeyFromPrivateKey(keyPair2.privateKey);

// Export key as hex
const publicKeyHex = await exportBase16Key(keyPair1.publicKey);
```

### Key Validation

```typescript
import { createPrivateKeyFromBytes, fromHex } from "@pact-toolbox/crypto";

// Create private key from bytes
const keyBytes = fromHex("368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca");
const privateKey = await createPrivateKeyFromBytes(keyBytes);

// Keys are validated during creation - invalid keys will throw
```

## Signing and Verification

### Message Signing

```typescript
import { signBytes, signature, fromUtf8, toHex } from "@pact-toolbox/crypto";

// Sign bytes
const messageBytes = new Uint8Array([1, 2, 3, 4]);
const signatureBytes = await signBytes(privateKey, messageBytes);

// Sign string (UTF-8 encoded)
const messageString = "Hello, world!";
const encodedMessage = fromUtf8(messageString);
const stringSignature = await signBytes(privateKey, encodedMessage);

// Create branded signature from hex
const sigHex = toHex(signatureBytes);
const brandedSig = signature(sigHex);
```

### Signature Verification

```typescript
import { verifySignature, isSignature } from "@pact-toolbox/crypto";

const isValid = await verifySignature(
  publicKey, // CryptoKey
  signatureBytes, // SignatureBytes (Uint8Array)
  messageBytes, // Uint8Array
);

if (isValid) {
  console.log("Signature is valid");
} else {
  console.log("Signature is invalid");
}

// Validate signature format
const hexSig = "a1b2c3..."; // 128 hex characters
if (isSignature(hexSig)) {
  console.log("Valid signature format");
}
```

## Hashing

### Blake2b Hashing

```typescript
import { blake2b, blake2bBase64Url, toHex, toBase64Url } from "@pact-toolbox/crypto";

// Basic Blake2b hash (returns Uint8Array)
const hash1 = blake2b("data to hash", undefined, 32);

// Blake2b with base64url encoding (returns string)
const hash2 = blake2bBase64Url("data to hash");

// Hash bytes directly
const inputBytes = new Uint8Array([1, 2, 3, 4]);
const hash3 = blake2b(inputBytes, undefined, 32);

// All produce 32-byte (256-bit) hashes
console.log("Hex:", toHex(hash1));
console.log("Base64URL:", toBase64Url(hash1));
```

## Encoding/Decoding

### Simple Encoding API

The package provides intuitive encoding utilities with clear naming:

```typescript
import {
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  toBase64Url,
  fromBase64Url,
  toUtf8,
  fromUtf8,
} from "@pact-toolbox/crypto";

// Hex (Hexadecimal)
const bytes = new Uint8Array([255, 0, 128]);
const hex = toHex(bytes); // Convert bytes TO hex string
const decoded1 = fromHex(hex); // Convert FROM hex string to bytes

// Base64
const b64 = toBase64(bytes); // Convert bytes TO base64 string
const decoded2 = fromBase64(b64); // Convert FROM base64 string to bytes

// Base64 URL-safe
const b64url = toBase64Url(bytes); // Convert bytes TO base64url string
const decoded3 = fromBase64Url(b64url); // Convert FROM base64url string to bytes

// UTF-8
const text = toUtf8(bytes); // Convert bytes TO UTF-8 string
const textBytes = fromUtf8("Hello, 世界!"); // Convert FROM UTF-8 string to bytes

// All encoding functions are deterministic and reversible
console.log("Original:", bytes);
console.log("Hex:", hex); // "ff0080"
console.log("Base64:", b64); // "/wCA"
console.log("Base64URL:", b64url); // "_wCA"
```

### Validation and Type Safety

```typescript
import { assertUint8Array, assertString } from "@pact-toolbox/crypto";

// Input validation for encoding functions
function safeEncode(data: unknown): string {
  assertUint8Array(data, "safeEncode");
  return toHex(data);
}

function safeDecode(hex: unknown): Uint8Array {
  assertString(hex, "safeDecode");
  return fromHex(hex);
}

// All encoding functions include built-in validation
try {
  const result = fromHex("invalid-hex");
} catch (error) {
  console.error("Invalid hex:", error.message);
}
```

## Kadena-Specific Features

### Addresses and K-Accounts

```typescript
import {
  address,
  kAccount,
  isAddress,
  isKAccount,
  getKAccountFromPublicKey,
  Address,
  KAccount,
} from "@pact-toolbox/crypto";

// Create address from hex string
const hexAddr = "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca";
const addr: Address = address(hexAddr);

// Create k-account
const kAcct: KAccount = kAccount(`k:${hexAddr}`);
// "k:368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"

// Validation
if (isAddress(hexAddr)) {
  console.log("Valid address");
}

if (isKAccount(kAcct)) {
  console.log("Valid k-account");
}

// Get k-account from public key
const publicKey = keyPair.publicKey;
const derivedKAccount = await getKAccountFromPublicKey(publicKey);
```

### Address Utilities

```typescript
import { addressToBytes, bytesToAddress, getAddressComparator } from "@pact-toolbox/crypto";

// Convert between address and bytes
const addr = address("368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca");
const bytes = addressToBytes(addr); // Convert to 32-byte array
const restored = bytesToAddress(bytes); // Convert back to address

// Address comparison
const comparator = getAddressComparator();
const result = comparator(addr1, addr2); // -1, 0, or 1
```

## Utility Functions

### Fast Stable Stringify

```typescript
import { fastStableStringify } from "@pact-toolbox/crypto";

// Deterministic JSON stringification for signing
const obj = { b: 2, a: 1, c: { d: 3 } };
const json = fastStableStringify(obj);
// Always produces: '{"a":1,"b":2,"c":{"d":3}}'

// Handles undefined
const result = fastStableStringify(undefined); // undefined
```

### Input Validation

```typescript
import { assertUint8Array, assertString } from "@pact-toolbox/crypto";

// Built-in validation for all encoding functions
function safeDecode(input: string): Uint8Array {
  // Input validation is automatic in encoding functions
  return fromHex(input); // Throws if invalid hex
}

// Manual validation when needed
function processBytes(data: unknown): string {
  assertUint8Array(data, "processBytes");
  return toHex(data);
}

function processString(data: unknown): Uint8Array {
  assertString(data, "processString");
  return fromUtf8(data);
}
```

## Environment Assertions

```typescript
import {
  assertDigestCapabilityIsAvailable,
  assertKeyGenerationIsAvailable,
  assertSigningCapabilityIsAvailable,
  assertVerificationCapabilityIsAvailable,
  assertPRNGIsAvailable,
} from "@pact-toolbox/crypto";

// Check capabilities before use
try {
  assertDigestCapabilityIsAvailable();
  await assertKeyGenerationIsAvailable();
  assertSigningCapabilityIsAvailable();
  assertVerificationCapabilityIsAvailable();
  assertPRNGIsAvailable();

  console.log("All crypto capabilities available");
} catch (error) {
  console.error("Missing crypto capability:", error.message);
}
```

## Platform-Specific Usage

### Node.js

```typescript
// Polyfills are automatically applied
import { generateKeyPair } from "@pact-toolbox/crypto";

const keyPair = await generateKeyPair();
// Works seamlessly in Node.js
```

### Browser

```typescript
// Ensure HTTPS for Web Crypto API
import { generateKeyPair } from "@pact-toolbox/crypto";

if (window.crypto && window.crypto.subtle) {
  const keyPair = await generateKeyPair();
  // Works in modern browsers
}
```

### React Native

```typescript
// Install react-native-get-random-values first
import "react-native-get-random-values";
import { generateKeyPair } from "@pact-toolbox/crypto";

const keyPair = await generateKeyPair();
// Works in React Native
```

## Security Best Practices

### 1. Key Storage

```typescript
// Never store keys in plain text
// Use secure storage mechanisms

// Bad
localStorage.setItem("privateKey", privateKey);

// Good
import { encrypt } from "your-encryption-lib";
const encrypted = await encrypt(privateKey, password);
await secureStorage.setItem("privateKey", encrypted);
```

### 2. Key Generation

```typescript
// Always use cryptographically secure random generation
// The package handles this automatically

// Generate fresh keys for each account
const keyPair1 = await generateKeyPair();
const keyPair2 = await generateKeyPair();
// Each key pair is unique and secure
```

### 3. Signature Verification

```typescript
// Always verify signatures before trusting data
const data = await fetchSignedData();
const isValid = await verifySignature(trustedPublicKey, data.signature, data.message);

if (!isValid) {
  throw new Error("Invalid signature - data may be tampered");
}
```

## Performance Considerations

### Batch Operations

```typescript
// Process multiple operations efficiently
const messages = Array.from({ length: 100 }, (_, i) => new TextEncoder().encode(`Message ${i}`));

// Sign in parallel
const signatures = await Promise.all(messages.map((msg) => signBytes(privateKey, msg)));

// Verify in parallel
const validations = await Promise.all(signatures.map((sig, i) => verifySignature(publicKey, sig, messages[i])));
```

### Caching Keys

```typescript
// Cache parsed keys to avoid repeated processing
const keyCache = new Map<string, CryptoKey>();

async function getCachedKey(hexKey: string): Promise<CryptoKey> {
  if (!keyCache.has(hexKey)) {
    const bytes = fromHex(hexKey);
    const key = await createPrivateKeyFromBytes(bytes);
    keyCache.set(hexKey, key);
  }
  return keyCache.get(hexKey)!;
}
```

## Examples

### Complete Account Creation

```typescript
import { genKeyPair, kAccount, getKAccountFromPublicKey } from "@pact-toolbox/crypto";

async function createNewAccount() {
  // Generate keys
  const { publicKey, privateKey } = await genKeyPair();

  // Create k-account
  const account = kAccount(`k:${publicKey}`);

  return {
    account,
    publicKey,
    privateKey, // Store securely!
  };
}

// Usage
const newAccount = await createNewAccount();
console.log("Account:", newAccount.account);
```

### Message Authentication

```typescript
async function authenticateMessage(
  message: string,
  senderPublicKeyHex: string,
): Promise<{ verified: boolean; data?: any }> {
  try {
    // Parse message format: <data>|<signature>
    const [dataStr, signatureHex] = message.split("|");

    // Decode components
    const data = JSON.parse(dataStr);
    const signatureBytes = fromHex(signatureHex);
    const messageBytes = fromUtf8(dataStr);

    // Verify signature
    const publicKeyBytes = fromHex(senderPublicKeyHex);
    const publicKey = await createPrivateKeyFromBytes(publicKeyBytes);

    const verified = await verifySignature(publicKey, signatureBytes, messageBytes);

    return { verified, data: verified ? data : undefined };
  } catch (error) {
    return { verified: false };
  }
}
```

### Custom Hashing

```typescript
import { blake2b, toBase64Url, fromUtf8, fastStableStringify } from "@pact-toolbox/crypto";

function createContentHash(content: any): string {
  // Deterministic serialization
  const json = fastStableStringify(content);

  // Hash with Blake2b
  const hash = blake2b(fromUtf8(json), undefined, 32);

  // Encode for URL-safe transmission
  return toBase64Url(hash);
}

// Usage
const doc = { title: "Document", version: 1 };
const contentHash = createContentHash(doc);
// Can be used as unique identifier
```

## Troubleshooting

### Common Issues

1. **"Web Crypto API not available"**
   - Ensure HTTPS in browsers
   - Install polyfills for Node.js < 20
   - Check platform compatibility

2. **"Invalid key format"**
   - Verify key length (32 bytes for private, 32 bytes for public)
   - Check encoding (hex string should be 64 characters)
   - Ensure proper key type (Ed25519)

3. **"Signature verification failed"**
   - Confirm message hasn't been modified
   - Verify using correct public key
   - Check signature format (64 bytes)

4. **"Module not found" in React Native**
   - Install `react-native-get-random-values`
   - Ensure proper metro configuration
   - Clear cache and rebuild

## License

MIT

## Contributing

Contributions are welcome! Please read the [contributing guidelines](../../CONTRIBUTING.md) first.
