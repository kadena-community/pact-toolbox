# @pact-toolbox/signers

A simplified and efficient signing library for the Kadena ecosystem. This package provides clean interfaces for signing Pact commands and arbitrary messages while maintaining full compatibility with existing wallet integrations.

## Features

- **Simplified API**: Single `Signer` interface instead of multiple overlapping interfaces
- **Kadena-focused**: Optimized for Pact command signing with full ecosystem compatibility  
- **Flexible**: Supports both keypair-based and external signers (wallets)
- **Well-tested**: Comprehensive test coverage with realistic scenarios
- **TypeScript**: Full type safety with proper generics and type guards

## Installation

```bash
npm install @pact-toolbox/signers
```

## Usage

### Creating Signers

```typescript
import { KeyPairSigner } from '@pact-toolbox/signers';

// Generate a new keypair signer
const signer = await KeyPairSigner.generate();

// Create from existing private key (hex)
const signerFromHex = await KeyPairSigner.fromPrivateKeyHex('your-private-key-hex');

// Create from private key bytes
const privateKeyBytes = new Uint8Array(32); // Your 32-byte private key
const signerFromBytes = await KeyPairSigner.fromPrivateKeyBytes(privateKeyBytes);

// Create from full keypair bytes (64 bytes: private + public)
const keypairBytes = new Uint8Array(64); // Your 64-byte keypair
const signerFromKeypair = await KeyPairSigner.fromBytes(keypairBytes);
```

### Signing Pact Commands

```typescript
import type { PactCommand } from '@pact-toolbox/types';
import { finalizeTransaction } from '@pact-toolbox/signers';

const command: PactCommand = {
  payload: {
    exec: {
      code: '(coin.transfer "alice" "bob" 10.0)',
      data: {}
    }
  },
  meta: {
    chainId: "0",
    sender: "alice",
    gasLimit: 1000,
    gasPrice: 0.00001,
    ttl: 600,
    creationTime: Date.now()
  },
  signers: [{
    pubKey: signer.address,
    scheme: "ED25519"
  }],
  networkId: "testnet04",
  nonce: Date.now().toString()
};

// Sign the command
const [partiallySignedTx] = await signer.signPactCommands([command]);

// Finalize for submission to Kadena network
const signedTx = finalizeTransaction(partiallySignedTx);
```

### Signing Arbitrary Messages

```typescript
import { createSignableMessage } from '@pact-toolbox/signers';

// Create a signable message
const message = createSignableMessage("Hello, Kadena!");

// Sign the message
const [signatures] = await signer.signMessages!([message]);

console.log(signatures[signer.address]); // Signature bytes
```

### Multi-signature Scenarios

```typescript
// Create multiple signers
const signer1 = await KeyPairSigner.generate();
const signer2 = await KeyPairSigner.generate();

// Create command requiring multiple signatures
const multiSigCommand: PactCommand = {
  // ... command structure
  signers: [
    { pubKey: signer1.address, scheme: "ED25519" },
    { pubKey: signer2.address, scheme: "ED25519" }
  ]
};

// Sign with each signer
const [partial1] = await signer1.signPactCommands([multiSigCommand]);
const [partial2] = await signer2.signPactCommands([multiSigCommand]);

// Combine signatures
const combined = {
  cmd: partial1.cmd,
  hash: partial1.hash,
  sigs: [...partial1.sigs, ...partial2.sigs]
};

const finalTx = finalizeTransaction(combined);
```

### Working with External Signers

```typescript
import { isSigner, type Signer } from '@pact-toolbox/signers';

// Custom wallet signer implementation
class WalletSigner implements Signer {
  readonly address: Address;
  
  constructor(address: Address) {
    this.address = address;
  }
  
  async signPactCommands(commands: PactCommand[]): Promise<PartiallySignedTransaction[]> {
    // Delegate to wallet API
    return wallet.signPactCommands(commands);
  }
}

const walletSigner = new WalletSigner("wallet-address");

// Type-safe check
if (isSigner(walletSigner)) {
  const signed = await walletSigner.signPactCommands([command]);
}
```

### Testing and Development

```typescript
import { NoopSigner } from '@pact-toolbox/signers';

// Create a no-operation signer for testing
const testSigner = new NoopSigner("test-address");

// Returns empty signatures (useful for testing flows without actual signing)
const mockSigned = await testSigner.signPactCommands([command]);
```

## API Reference

### Main Types

#### `Signer<TAddress>`
The main interface for all signers:

```typescript
interface Signer<TAddress extends string = string> {
  readonly address: Address<TAddress>;
  readonly keyPair?: CryptoKeyPair; // Optional for external signers
  
  // Core Kadena functionality
  signPactCommands(commands: PactCommand[], config?: SignerConfig): Promise<PartiallySignedTransaction[]>;
  
  // Optional message signing
  signMessages?(messages: readonly SignableMessage[], config?: SignerConfig): Promise<readonly SignatureDictionary[]>;
}
```

#### `KeyPairSigner`
Concrete implementation using CryptoKeyPair:

```typescript
class KeyPairSigner implements Signer {
  static async generate(): Promise<KeyPairSigner>
  static async fromKeyPair(keyPair: CryptoKeyPair): Promise<KeyPairSigner>
  static async fromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<KeyPairSigner>
  static async fromPrivateKeyBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<KeyPairSigner>
  static async fromPrivateKeyHex(privateKey: string, extractable?: boolean): Promise<KeyPairSigner>
}
```

#### `NoopSigner`
Testing implementation that returns empty signatures:

```typescript
class NoopSigner implements Signer {
  constructor(address: Address)
}
```

### Utility Functions

#### Transaction Processing
- `finalizeTransaction(tx: PartiallySignedTransaction): SignedTransaction` - Convert partial transaction to final format
- `isFullySignedTransaction(tx: unknown): tx is SignedTransaction` - Type guard for complete transactions
- `isTransactionFullSig(sig: TransactionSig): sig is TransactionFullSig` - Type guard for complete signatures

#### Message Creation  
- `createSignableMessage(content: Uint8Array | string, signatures?: SignatureDictionary): SignableMessage` - Create signable message

#### Type Guards
- `isSigner(value: unknown): value is Signer` - Check if value implements Signer interface
- `isKeyPairSigner(value: unknown): value is KeyPairSigner` - Check if signer has keypair access


## Configuration

### AbortSignal Support

All signing operations support AbortSignal for cancellation:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const signed = await signer.signPactCommands([command], { 
    abortSignal: controller.signal 
  });
} catch (error) {
  if (error.message === 'Operation aborted') {
    console.log('Signing was cancelled');
  }
}
```

## Migration from Previous Versions

If upgrading from earlier versions, the main changes are:

1. **Unified Interface**: `PactCommandSigner`, `MessageSigner`, and `KeyPairSigner` are now all the same `Signer` interface
2. **Class-based Creation**: Use `KeyPairSigner.generate()` instead of `generateKeyPairSigner()`
3. **Optional Message Signing**: Message signing is now optional (marked with `?` in interface)
4. **Simplified Exports**: Fewer separate interfaces to import

## Integration with Kadena Ecosystem

This package is designed to work seamlessly with:

- **@pact-toolbox/chainweb-client** - For transaction submission
- **@pact-toolbox/transaction** - For transaction building  
- **@pact-toolbox/dev-wallet** - For development wallet functionality
- **@pact-toolbox/wallet-adapters** - For wallet integrations

The simplified API reduces complexity while maintaining all functionality needed by these ecosystem packages.
