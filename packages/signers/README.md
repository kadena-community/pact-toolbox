# @pact-toolbox/signer

> Cryptographic signing utilities for Pact transactions on Kadena blockchain

## Overview

The `@pact-toolbox/signer` package provides a comprehensive signing solution for Pact transactions and messages on the Kadena blockchain. It offers multiple signer implementations, supports various key formats, and integrates seamlessly with the pact-toolbox ecosystem.

## Installation

```bash
npm install @pact-toolbox/signer
# or
pnpm add @pact-toolbox/signer
```

## Features

- = **Multiple Signer Types** - Message signing, transaction signing, and combined signers
- = **Key Format Support** - Create signers from various key formats (bytes, hex, base64)
- < **Cross-Platform** - Works in Node.js, browsers, and React Native
- � **Web Crypto API** - Uses native cryptography for optimal performance
- =� **Type Safety** - Full TypeScript support with branded types
- > � **Testing Support** - Mock signers for testing without real cryptography
- = **Batch Operations** - Sign multiple messages or transactions efficiently

## Quick Start

```typescript
import { generateKeyPairSigner, createSignableMessage, finalizeTransaction } from "@pact-toolbox/signer";

// Generate a new keypair signer
const signer = await generateKeyPairSigner();

// Sign a message
const message = createSignableMessage("Hello, Kadena!");
const [signatures] = await signer.signMessages([message]);

// Sign a Pact transaction
const command = {
  payload: { exec: { code: '(coin.details "alice")' } },
  meta: { chainId: "0", sender: "alice" },
  signers: [],
  networkId: "development",
};

const [signedTx] = await signer.signPactCommands([command]);
const finalTx = finalizeTransaction(signedTx);
```

## Signer Types

### KeyPairSigner

The primary signer implementation using Web Crypto API CryptoKeyPair.

```typescript
import {
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createKeyPairSignerFromBase16PrivateKey,
} from "@pact-toolbox/signer";

// Generate new keypair
const signer1 = await generateKeyPairSigner();

// From 64-byte keypair (32 private + 32 public)
const keypairBytes = new Uint8Array(64);
const signer2 = await createKeyPairSignerFromBytes(keypairBytes);

// From 32-byte private key
const privateKeyBytes = new Uint8Array(32);
const signer3 = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes);

// From hex-encoded private key
const privateKeyHex = "deadbeef...";
const signer4 = await createKeyPairSignerFromBase16PrivateKey(privateKeyHex);

// Access the underlying keypair
const cryptoKeyPair = signer1.getKeyPair();
```

### MessageSigner

Interface for signing arbitrary messages.

```typescript
interface MessageSigner {
  signMessages(messages: SignableMessage[]): Promise<SignatureWithAddress[]>;
}

// Usage
const messages = [
  createSignableMessage("Message 1"),
  createSignableMessage("Message 2", "utf8"),
  createSignableMessage(new Uint8Array([1, 2, 3])),
];

const signatures = await signer.signMessages(messages);
```

### PactCommandSigner

Interface for signing Pact commands/transactions.

```typescript
interface PactCommandSigner {
  signPactCommands(commands: PactCommand[]): Promise<PartiallySignedPactCommand[]>;
}

// Usage
const commands = [
  { payload: {...}, meta: {...}, signers: [...], networkId: "..." },
  { payload: {...}, meta: {...}, signers: [...], networkId: "..." }
];

const signedCommands = await signer.signPactCommands(commands);
```

### NoopSigner

Mock signer for testing purposes.

```typescript
import { createNoopSigner } from "@pact-toolbox/signer";

// Create a mock signer
const noopSigner = createNoopSigner();

// Returns empty signatures (useful for testing)
const [emptySignatures] = await noopSigner.signMessages([message]);
```

## API Reference

### Core Functions

#### `generateKeyPairSigner()`

Generates a new keypair signer with a random Ed25519 keypair.

```typescript
const signer = await generateKeyPairSigner();
console.log(signer.address); // Public key as hex string
```

#### `createKeyPairSignerFromBytes(keypairBytes)`

Creates a signer from a 64-byte keypair (32 private + 32 public).

```typescript
const keypairBytes = new Uint8Array(64); // Your keypair bytes
const signer = await createKeyPairSignerFromBytes(keypairBytes);
```

#### `createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes)`

Creates a signer from a 32-byte private key.

```typescript
const privateKey = new Uint8Array(32); // Your private key
const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey);
```

#### `createKeyPairSignerFromBase16PrivateKey(privateKeyHex)`

Creates a signer from a hex-encoded private key string.

```typescript
const privateKeyHex = "0123456789abcdef..."; // 64 hex characters
const signer = await createKeyPairSignerFromBase16PrivateKey(privateKeyHex);
```

#### `createSignableMessage(message, encoding?)`

Creates a signable message from string or bytes.

```typescript
// From string (UTF-8 encoded)
const msg1 = createSignableMessage("Hello, world!");

// From string with custom encoding
const msg2 = createSignableMessage("Hello", "ascii");

// From bytes
const msg3 = createSignableMessage(new Uint8Array([1, 2, 3]));
```

#### `finalizeTransaction(partiallySignedCommand)`

Finalizes a partially signed command into a complete transaction.

```typescript
const [partiallySignedCmd] = await signer.signPactCommands([command]);
const transaction = finalizeTransaction(partiallySignedCmd);
// Ready to submit to the blockchain
```

### Type Guards

#### `isMessageSigner(signer)`

Checks if an object implements the MessageSigner interface.

```typescript
if (isMessageSigner(signer)) {
  const signatures = await signer.signMessages([message]);
}
```

#### `isPactCommandSigner(signer)`

Checks if an object implements the PactCommandSigner interface.

```typescript
if (isPactCommandSigner(signer)) {
  const signedCommands = await signer.signPactCommands([command]);
}
```

#### `isKeyPairSigner(signer)`

Checks if an object is a KeyPairSigner (implements both interfaces).

```typescript
if (isKeyPairSigner(signer)) {
  // Can use both signMessages and signPactCommands
  const keyPair = signer.getKeyPair();
}
```

## Advanced Usage

### Multi-Signature Transactions

```typescript
// Create multiple signers
const signer1 = await generateKeyPairSigner();
const signer2 = await generateKeyPairSigner();

// Create command with multiple signers
const command: PactCommand = {
  payload: { exec: { code: "(multi-sig-operation)" } },
  meta: { chainId: "0", sender: "gas-payer" },
  signers: [
    { pubKey: signer1.address, scheme: "ED25519" },
    { pubKey: signer2.address, scheme: "ED25519" },
  ],
  networkId: "development",
};

// Sign with each signer
const [partial1] = await signer1.signPactCommands([command]);
const [partial2] = await signer2.signPactCommands([command]);

// Combine signatures
const combined = combineSignatures(partial1, partial2);
const finalTx = finalizeTransaction(combined);
```

### Custom Signer Implementation

```typescript
import { MessageSigner, PactCommandSigner, SignableMessage } from "@pact-toolbox/signer";

class CustomSigner implements MessageSigner, PactCommandSigner {
  constructor(private customKey: any) {}

  async signMessages(messages: SignableMessage[]): Promise<SignatureWithAddress[]> {
    // Custom signing logic
    return messages.map((msg) => ({
      [this.getAddress()]: await this.customSign(msg.message),
    }));
  }

  async signPactCommands(commands: PactCommand[]): Promise<PartiallySignedPactCommand[]> {
    // Custom Pact signing logic
    return commands.map((cmd) => {
      const hash = hashPactCommand(cmd);
      const signature = await this.customSign(hash);
      return {
        ...cmd,
        sigs: [{ sig: signature }],
      };
    });
  }

  private async customSign(data: Uint8Array): Promise<string> {
    // Your custom signing implementation
    return "custom-signature";
  }

  private getAddress(): string {
    return "custom-address";
  }
}
```

### Working with Hardware Wallets

```typescript
import { PactCommandSigner } from "@pact-toolbox/signer";

class LedgerSigner implements PactCommandSigner {
  constructor(private transport: any) {}

  async signPactCommands(commands: PactCommand[]): Promise<PartiallySignedPactCommand[]> {
    // Connect to Ledger
    const app = new KadenaApp(this.transport);

    return Promise.all(
      commands.map(async (cmd) => {
        // Sign with Ledger
        const response = await app.signTransaction(
          "44'/626'/0'/0/0", // Derivation path
          JSON.stringify(cmd),
        );

        return {
          ...cmd,
          sigs: [{ sig: response.signature }],
        };
      }),
    );
  }
}
```

## Integration with pact-toolbox

### With @pact-toolbox/transaction

```typescript
import { PactTransactionBuilder } from "@pact-toolbox/transaction";
import { generateKeyPairSigner } from "@pact-toolbox/signer";

const signer = await generateKeyPairSigner();

const result = await PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .addSigner({
    pubKey: signer.address,
    caps: [["coin.TRANSFER", "alice", "bob", 10.0]],
  })
  .customSigner(signer) // Use custom signer
  .execute();
```

### With @pact-toolbox/runtime

```typescript
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { generateKeyPairSigner } from "@pact-toolbox/signer";

const client = new PactToolboxClient(config);
const signer = await generateKeyPairSigner();

// Client can use signer for transaction signing
const result = await client.execute('(coin.transfer "alice" "bob" 10.0)', { signer });
```

## Security Considerations

1. **Private Key Storage**: Never store private keys in plain text. Use secure key management solutions.

2. **Key Generation**: Always use cryptographically secure random number generators (handled by Web Crypto API).

3. **Message Validation**: Validate messages before signing to prevent signing malicious content.

4. **Transport Security**: Use secure channels (HTTPS) when transmitting signed transactions.

## Best Practices

### 1. Key Management

```typescript
// Generate and securely store keypair
const signer = await generateKeyPairSigner();

// Export for secure storage
const privateKey = await exportPrivateKey(signer.getKeyPair());
const encryptedKey = await encryptKey(privateKey, password);
await secureStorage.save("key", encryptedKey);

// Later: restore from storage
const encryptedKey = await secureStorage.load("key");
const privateKey = await decryptKey(encryptedKey, password);
const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey);
```

### 2. Error Handling

```typescript
try {
  const signer = await createKeyPairSignerFromBase16PrivateKey(privateKeyHex);
  const [signedTx] = await signer.signPactCommands([command]);
  const finalTx = finalizeTransaction(signedTx);
} catch (error) {
  if (error.message.includes("Invalid private key")) {
    console.error("Private key format is incorrect");
  } else if (error.message.includes("Signing failed")) {
    console.error("Failed to sign transaction");
  }
}
```

### 3. Testing

```typescript
import { createNoopSigner } from "@pact-toolbox/signer";

describe("Transaction Flow", () => {
  test("builds and signs transaction", async () => {
    // Use noop signer for testing
    const signer = createNoopSigner();

    const command = buildCommand();
    const [signed] = await signer.signPactCommands([command]);

    expect(signed.sigs).toHaveLength(1);
    expect(signed.sigs[0]).toEqual({ sig: "" });
  });
});
```

## Examples

### Complete Transaction Flow

```typescript
import { generateKeyPairSigner, finalizeTransaction } from "@pact-toolbox/signer";
import { PactCommand } from "@pact-toolbox/types";

async function transferTokens() {
  // 1. Create signer
  const signer = await generateKeyPairSigner();

  // 2. Build command
  const command: PactCommand = {
    payload: {
      exec: {
        code: '(coin.transfer "alice" "bob" 10.0)',
        data: {},
      },
    },
    meta: {
      chainId: "0",
      sender: "alice",
      gasLimit: 1000,
      gasPrice: 0.00001,
      ttl: 600,
      creationTime: Math.floor(Date.now() / 1000),
    },
    signers: [
      {
        pubKey: signer.address,
        scheme: "ED25519",
        clist: [{ name: "coin.TRANSFER", args: ["alice", "bob", 10.0] }],
      },
    ],
    networkId: "testnet04",
    nonce: Date.now().toString(),
  };

  // 3. Sign command
  const [partiallySignedCmd] = await signer.signPactCommands([command]);

  // 4. Finalize transaction
  const transaction = finalizeTransaction(partiallySignedCmd);

  // 5. Submit to blockchain
  const response = await fetch("https://api.testnet.chainweb.com/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmds: [transaction] }),
  });

  return response.json();
}
```

### Batch Signing

```typescript
async function batchTransfer() {
  const signer = await generateKeyPairSigner();

  // Create multiple commands
  const commands = recipients.map((recipient) => ({
    payload: {
      exec: {
        code: `(coin.transfer "treasury" "${recipient.account}" ${recipient.amount})`,
      },
    },
    meta: { chainId: "0", sender: "treasury" },
    signers: [{ pubKey: signer.address }],
    networkId: "mainnet01",
  }));

  // Sign all at once
  const signedCommands = await signer.signPactCommands(commands);

  // Finalize all transactions
  const transactions = signedCommands.map(finalizeTransaction);

  // Submit batch
  return submitBatch(transactions);
}
```

## Troubleshooting

### Common Issues

1. **"Invalid private key format"**

   - Ensure private key is exactly 32 bytes or 64 hex characters
   - Check encoding (hex vs base64)

2. **"Signing failed"**

   - Verify the command structure is valid
   - Check that signers array matches the signing key

3. **"Web Crypto API not available"**

   - Ensure running in a secure context (HTTPS)
   - Check browser compatibility

4. **"Empty signatures"**
   - Make sure you're not using NoopSigner in production
   - Verify signer is properly initialized
