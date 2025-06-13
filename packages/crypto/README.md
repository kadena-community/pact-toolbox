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

- = **Ed25519 Cryptography** - Key generation, signing, and verification
- = **Blake2b Hashing** - Fast and secure hashing algorithm
- =$ **Multiple Encodings** - Base16, Base64, Base58, UTF-8, and more
- < **Cross-Platform** - Works in Node.js, browsers, and React Native
- =á **Type Safety** - Branded types for addresses, signatures, and k-accounts
- ¡ **Performance** - Optimized implementations with Web Crypto API
- >é **Codec System** - Composable encoding/decoding utilities

## Quick Start

```typescript
import { 
  generateKeyPair,
  genKeyPair,
  signBytes,
  verifySignature,
  hashBlake2b,
  base16
} from '@pact-toolbox/crypto';

// Generate a new key pair
const keyPair = await generateKeyPair();

// Generate key pair with base16 export
const { publicKey, secretKey } = genKeyPair();
console.log('Public Key:', publicKey);  // 64 hex characters
console.log('Secret Key:', secretKey);  // 64 hex characters

// Sign a message
const message = new TextEncoder().encode('Hello, Kadena!');
const signature = await signBytes(keyPair.privateKey, message);

// Verify signature
const isValid = await verifySignature(
  keyPair.publicKey,
  message,
  signature
);

// Hash data
const hash = hashBlake2b('data to hash');
console.log('Blake2b hash:', base16.encode(hash));
```

## Key Management

### Key Generation

```typescript
import { 
  generateKeyPair,
  generateExtractableKeyPair,
  genKeyPair 
} from '@pact-toolbox/crypto';

// Generate non-extractable key pair (secure, can't export private key)
const secureKeyPair = await generateKeyPair();

// Generate extractable key pair (can export private key)
const extractableKeyPair = await generateExtractableKeyPair();

// Generate key pair with immediate base16 export
const { publicKey, secretKey } = genKeyPair();
// publicKey: "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"
// secretKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898"
```

### Key Import/Export

```typescript
import {
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  getPublicKeyFromPrivateKey,
  exportBase16Key
} from '@pact-toolbox/crypto';

// From 64-byte array (32 private + 32 public)
const keyPairBytes = new Uint8Array(64);
const keyPair1 = await createKeyPairFromBytes(keyPairBytes);

// From 32-byte private key
const privateKeyBytes = new Uint8Array(32);
const keyPair2 = await createKeyPairFromPrivateKeyBytes(privateKeyBytes);

// Get public key from private key
const publicKey = await getPublicKeyFromPrivateKey(privateKeyBytes);

// Export key as base16
const publicKeyHex = await exportBase16Key(keyPair1.publicKey);
```

### Key Validation

```typescript
import { isValidKeyBytes, parseFromHex } from '@pact-toolbox/crypto';

// Validate key bytes
const keyBytes = new Uint8Array(32);
if (isValidKeyBytes(keyBytes)) {
  console.log('Valid key');
}

// Parse hex key safely
try {
  const keyBytes = parseFromHex('368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca');
  console.log('Parsed key bytes:', keyBytes);
} catch (error) {
  console.error('Invalid hex key');
}
```

## Signing and Verification

### Message Signing

```typescript
import { signBytes, signString } from '@pact-toolbox/crypto';

// Sign bytes
const messageBytes = new Uint8Array([1, 2, 3, 4]);
const signature1 = await signBytes(privateKey, messageBytes);

// Sign string (UTF-8 encoded)
const signature2 = await signString(privateKey, "Hello, world!");

// Signature format: Uint8Array(64)
```

### Signature Verification

```typescript
import { verifySignature } from '@pact-toolbox/crypto';

const isValid = await verifySignature(
  publicKey,    // CryptoKey or Uint8Array
  message,      // Uint8Array
  signature     // Uint8Array
);

if (isValid) {
  console.log('Signature is valid');
} else {
  console.log('Signature is invalid');
}
```

## Hashing

### Blake2b Hashing

```typescript
import { 
  hashBlake2b,
  hashBlake2bBase64Url,
  blake2b256
} from '@pact-toolbox/crypto';

// Basic Blake2b hash (returns Uint8Array)
const hash1 = hashBlake2b('data to hash');

// Blake2b with base64url encoding (returns string)
const hash2 = hashBlake2bBase64Url('data to hash');

// Direct Blake2b-256 hash
const hash3 = blake2b256(new Uint8Array([1, 2, 3]));

// All produce 32-byte (256-bit) hashes
```

## Encoding/Decoding

### Codec System

The package provides a powerful codec system for encoding and decoding data:

```typescript
import { 
  base16,
  base64,
  base64url,
  base58,
  utf8,
  createCodec
} from '@pact-toolbox/crypto';

// Base16 (Hexadecimal)
const hex = base16.encode(new Uint8Array([255, 0, 128]));
const bytes1 = base16.decode(hex);

// Base64
const b64 = base64.encode(new Uint8Array([1, 2, 3]));
const bytes2 = base64.decode(b64);

// Base64 URL-safe
const b64url = base64url.encode(new Uint8Array([1, 2, 3]));
const bytes3 = base64url.decode(b64url);

// Base58 (Bitcoin-style)
const b58 = base58.encode(new Uint8Array([1, 2, 3]));
const bytes4 = base58.decode(b58);

// UTF-8
const text = utf8.encode('Hello, L!');
const decoded = utf8.decode(text);
```

### Custom Codecs

```typescript
import { createCodec, createFixedCodec } from '@pact-toolbox/crypto';

// Variable-length codec
const customCodec = createCodec<string>({
  encode: (value) => new TextEncoder().encode(value.toUpperCase()),
  decode: (bytes) => new TextDecoder().decode(bytes).toLowerCase()
});

// Fixed-length codec (e.g., for addresses)
const addressCodec = createFixedCodec<string>(32, {
  encode: (addr) => base16.decode(addr),
  decode: (bytes) => base16.encode(bytes)
});
```

### Codec Transformations

```typescript
import { transformCodec, bimap } from '@pact-toolbox/crypto';

// Transform codec values
const numberCodec = transformCodec(utf8, {
  encode: (n: number) => n.toString(),
  decode: (s: string) => parseInt(s, 10)
});

// Bidirectional mapping
const boolCodec = bimap(utf8,
  (b: boolean) => b ? 'true' : 'false',
  (s: string) => s === 'true'
);
```

## Kadena-Specific Features

### Addresses and K-Accounts

```typescript
import { 
  createAddress,
  createKAccount,
  isValidAddress,
  isValidKAccount,
  getAddressFromKAccount
} from '@pact-toolbox/crypto';

// Create address from public key
const publicKey = "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca";
const address = createAddress(publicKey);

// Create k-account
const kAccount = createKAccount(publicKey);
// "k:368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"

// Validation
if (isValidAddress(address)) {
  console.log('Valid address');
}

if (isValidKAccount(kAccount)) {
  const extractedAddress = getAddressFromKAccount(kAccount);
  console.log('Address:', extractedAddress);
}
```

### Account Guards

```typescript
import { createSingleKeyGuard, createMultiKeyGuard } from '@pact-toolbox/crypto';

// Single key guard
const guard1 = createSingleKeyGuard(publicKey);
// { keys: [publicKey], pred: 'keys-all' }

// Multi-key guard
const guard2 = createMultiKeyGuard(
  [publicKey1, publicKey2],
  'keys-any'  // or 'keys-all', 'keys-2', etc.
);
```

## Utility Functions

### Fast Stable Stringify

```typescript
import { fastStableStringify } from '@pact-toolbox/crypto';

// Deterministic JSON stringification for signing
const obj = { b: 2, a: 1, c: { d: 3 } };
const json = fastStableStringify(obj);
// Always produces: '{"a":1,"b":2,"c":{"d":3}}'
```

### Byte Utilities

```typescript
import { 
  mergeBytes,
  padBytes,
  fixBytes,
  bytesToBigInt,
  bigIntToBytes
} from '@pact-toolbox/crypto';

// Merge multiple byte arrays
const merged = mergeBytes(
  new Uint8Array([1, 2]),
  new Uint8Array([3, 4])
);

// Pad bytes to specific length
const padded = padBytes(new Uint8Array([1, 2]), 32); // Right-pad with zeros

// Fix byte array to exact length (pad or truncate)
const fixed = fixBytes(bytes, 32);

// BigInt conversions
const bigInt = bytesToBigInt(new Uint8Array([255, 255]));
const bytes = bigIntToBytes(65535n);
```

## Platform-Specific Usage

### Node.js

```typescript
// Polyfills are automatically applied
import { generateKeyPair } from '@pact-toolbox/crypto';

const keyPair = await generateKeyPair();
// Works seamlessly in Node.js
```

### Browser

```typescript
// Ensure HTTPS for Web Crypto API
import { generateKeyPair } from '@pact-toolbox/crypto';

if (window.crypto && window.crypto.subtle) {
  const keyPair = await generateKeyPair();
  // Works in modern browsers
}
```

### React Native

```typescript
// Install react-native-get-random-values first
import 'react-native-get-random-values';
import { generateKeyPair } from '@pact-toolbox/crypto';

const keyPair = await generateKeyPair();
// Works in React Native
```

## Security Best Practices

### 1. Key Storage

```typescript
// Never store keys in plain text
// Use secure storage mechanisms

// Bad
localStorage.setItem('privateKey', secretKey);

// Good
import { encrypt } from 'your-encryption-lib';
const encrypted = await encrypt(secretKey, password);
await secureStorage.setItem('privateKey', encrypted);
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
const isValid = await verifySignature(
  trustedPublicKey,
  data.message,
  data.signature
);

if (!isValid) {
  throw new Error('Invalid signature - data may be tampered');
}
```

## Performance Considerations

### Batch Operations

```typescript
// Process multiple operations efficiently
const messages = Array.from({ length: 100 }, (_, i) => 
  `Message ${i}`
);

// Sign in parallel
const signatures = await Promise.all(
  messages.map(msg => signString(privateKey, msg))
);

// Verify in parallel
const validations = await Promise.all(
  signatures.map((sig, i) => 
    verifySignature(publicKey, messages[i], sig)
  )
);
```

### Caching Keys

```typescript
// Cache parsed keys to avoid repeated processing
const keyCache = new Map<string, CryptoKey>();

async function getCachedKey(hexKey: string): Promise<CryptoKey> {
  if (!keyCache.has(hexKey)) {
    const bytes = base16.decode(hexKey);
    const key = await importKey(bytes);
    keyCache.set(hexKey, key);
  }
  return keyCache.get(hexKey)!;
}
```

## Examples

### Complete Account Creation

```typescript
import { 
  genKeyPair,
  createKAccount,
  createSingleKeyGuard
} from '@pact-toolbox/crypto';

function createNewAccount() {
  // Generate keys
  const { publicKey, secretKey } = genKeyPair();
  
  // Create k-account
  const account = createKAccount(publicKey);
  
  // Create guard
  const guard = createSingleKeyGuard(publicKey);
  
  return {
    account,
    publicKey,
    secretKey, // Store securely!
    guard
  };
}

// Usage
const newAccount = createNewAccount();
console.log('Account:', newAccount.account);
console.log('Guard:', newAccount.guard);
```

### Message Authentication

```typescript
async function authenticateMessage(
  message: string,
  senderPublicKey: string
): Promise<{ verified: boolean; data?: any }> {
  try {
    // Parse message format: <data>|<signature>
    const [dataStr, signatureHex] = message.split('|');
    
    // Decode components
    const data = JSON.parse(dataStr);
    const signature = base16.decode(signatureHex);
    const messageBytes = utf8.encode(dataStr);
    
    // Verify signature
    const publicKeyBytes = base16.decode(senderPublicKey);
    const publicKey = await importPublicKey(publicKeyBytes);
    
    const verified = await verifySignature(
      publicKey,
      messageBytes,
      signature
    );
    
    return { verified, data: verified ? data : undefined };
  } catch (error) {
    return { verified: false };
  }
}
```

### Custom Hashing

```typescript
import { blake2b256, base64url } from '@pact-toolbox/crypto';

function createContentHash(content: any): string {
  // Deterministic serialization
  const json = fastStableStringify(content);
  
  // Hash with Blake2b
  const hash = blake2b256(utf8.encode(json));
  
  // Encode for URL-safe transmission
  return base64url.encode(hash);
}

// Usage
const doc = { title: 'Document', version: 1 };
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