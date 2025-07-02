# Multi-Signature Transaction Support

The `@pact-toolbox/transaction` package provides built-in support for multi-signature transactions, allowing multiple wallets to sign a single transaction.

## Basic Usage

### Using `multiSign()` Method

The simplest way to collect signatures from multiple wallets:

```typescript
import { execution } from "@pact-toolbox/transaction";

const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [
    signFor("coin.TRANSFER", "alice", "bob", 10.0)
  ])
  .withSigner("gas-payer-key", (signFor) => [
    signFor("coin.GAS")
  ])
  .multiSign([aliceWallet, gasPayerWallet])
  .submitAndListen();
```

## Advanced Usage

### Manual Signature Collection

For more control over the signing process:

```typescript
import { collectSignatures } from "@pact-toolbox/transaction";

// Build unsigned transaction
const unsignedTx = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [
    signFor("coin.TRANSFER", "alice", "bob", 10.0)
  ])
  .withSigner("gas-payer-key", (signFor) => [
    signFor("coin.GAS")
  ])
  .build()
  .getPartialTransaction();

// Collect signatures
const signedTx = await collectSignatures(unsignedTx, [aliceWallet, gasPayerWallet]);
```

### Merging Signatures

When signatures are collected separately (e.g., on different devices):

```typescript
import { mergeSignatures, isFullySigned } from "@pact-toolbox/transaction";

// Alice signs on her device
const aliceSignedTx = await aliceWallet.sign(unsignedTx);

// Gas payer signs on their device
const gasPayerSignedTx = await gasPayerWallet.sign(unsignedTx);

// Merge signatures
const fullySignedTx = mergeSignatures(aliceSignedTx, gasPayerSignedTx);

// Check if fully signed
if (isFullySigned(fullySignedTx)) {
  // Submit transaction
}
```

## API Reference

### `multiSign(wallets: Wallet[])`

Transaction builder method that collects signatures from multiple wallets.

- **Parameters**: Array of wallet instances
- **Returns**: Transaction dispatcher for further operations
- **Throws**: Error if any required signatures are missing

### `collectSignatures(transaction: PartiallySignedTransaction, wallets: Wallet[])`

Utility function to collect signatures from multiple wallets.

- **Parameters**: 
  - `transaction`: Unsigned or partially signed transaction
  - `wallets`: Array of wallet instances
- **Returns**: Fully signed transaction
- **Throws**: Error listing missing signature indices

### `mergeSignatures(...transactions: PartiallySignedTransaction[])`

Merges signatures from multiple partially signed transactions.

- **Parameters**: Variable number of partially signed transactions
- **Returns**: Merged transaction with all signatures
- **Throws**: Error if transactions have different hashes

### `isFullySigned(tx: PartiallySignedTransaction)`

Type guard to check if a transaction has all required signatures.

- **Parameters**: Transaction to check
- **Returns**: `true` if fully signed, `false` otherwise

## Examples

### Safe Transfer Pattern

Both sender and receiver must sign:

```typescript
const result = await execution(`
  (coin.transfer "alice" "bob" 100.0)
  (coin.transfer "bob" "alice" 1.0)
`)
  .withSigner("alice-key", (signFor) => [
    signFor("coin.TRANSFER", "alice", "bob", 100.0),
    signFor("coin.GAS")
  ])
  .withSigner("bob-key", (signFor) => [
    signFor("coin.TRANSFER", "bob", "alice", 1.0)
  ])
  .multiSign([aliceWallet, bobWallet])
  .submitAndListen();
```

### Async Signature Collection

Share partially signed transactions:

```typescript
// Alice signs first
const aliceSignedTx = await aliceWallet.sign(unsignedTx);

// Serialize for sharing (QR code, URL, etc.)
const serialized = JSON.stringify(aliceSignedTx);

// Later, gas payer receives and completes signing
const receivedTx = JSON.parse(serialized);
const gasPayerSignedTx = await gasPayerWallet.sign(unsignedTx);
const fullySignedTx = mergeSignatures(receivedTx, gasPayerSignedTx);
```

## Notes

- Wallet order doesn't matter - signatures are matched by public key
- The `multiSign()` method will throw an error if any required signatures are missing
- All signatures must be for the same transaction (same hash)
- The implementation is compatible with existing wallet interfaces