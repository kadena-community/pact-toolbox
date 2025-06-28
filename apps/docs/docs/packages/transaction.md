---
title: "Transaction Builder"
description: "High-level transaction builder for Pact smart contracts with fluent API, type safety, and multi-wallet support."
---

# Transaction Builder

The Transaction Builder (`@pact-toolbox/transaction`) provides a powerful, type-safe API for building and executing Pact transactions on the Kadena blockchain. It features a fluent interface, automatic signing, and seamless wallet integration.

## Features

- 🔨 **Fluent API** - Chainable methods for intuitive transaction building
- 📝 **Type Safety** - Full TypeScript support with auto-completion
- 💼 **Multi-Wallet Support** - Works with all Kadena wallets
- ⚡ **Auto-signing** - Automatic transaction signing and submission
- 🔄 **Batch Operations** - Efficient handling of multiple transactions
- 🛡️ **Built-in Validation** - Comprehensive input validation
- 📊 **Gas Optimization** - Smart gas limit calculation
- 🔍 **Transaction Tracking** - Monitor transaction lifecycle

## Installation

```bash
# npm
npm install @pact-toolbox/transaction

# pnpm
pnpm add @pact-toolbox/transaction

# yarn
yarn add @pact-toolbox/transaction
```

## Quick Start

```typescript
import { execution } from '@pact-toolbox/transaction'

// Create a simple transfer transaction
const result = await execution('(coin.transfer "alice" "bob" 1.0)')
  .withChainId('0')
  .withSigner('alice-public-key', (signFor) => [
    signFor('coin.TRANSFER', 'alice', 'bob', 1.0)
  ])
  .withGasLimit(1000)
  .sign()
  .submitAndListen()

console.log('Transfer successful:', result)
```

## Core Concepts

### Transaction Builder

The transaction builder provides a fluent interface for constructing Pact transactions:

```typescript
const tx = execution('(+ 1 2)')           // Pact code to execute
  .withData('x', 10)                      // Add data to environment
  .withData('y', 20)                      
  .withChainId('0')                       // Target chain
  .withGasLimit(1000)                     // Gas limit
  .withGasPrice(0.000001)                 // Gas price
  .withTTL(600)                           // Time to live (seconds)
  .withNonce('unique-nonce')              // Transaction nonce
```

### Signing and Submission

```typescript
// Sign with default wallet
const signed = await tx.sign()

// Submit to network
const requestKey = await signed.submit()

// Submit and wait for result
const result = await signed.submitAndListen()

// Submit with custom timeout
const result = await signed.submitAndListen({ 
  timeout: 30000 // 30 seconds 
})
```

## Advanced Usage

### Working with Capabilities

```typescript
const tx = createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .capability('coin.TRANSFER', 'alice', 'bob', { decimal: '1.0' })
  .signer({
    pubKey: 'alice-public-key',
    scheme: 'ED25519',
    caps: [
      { name: 'coin.TRANSFER', args: ['alice', 'bob', { decimal: '1.0' }] },
      { name: 'coin.GAS', args: [] }
    ]
  })
```

### Multi-Signature Transactions

```typescript
const tx = createTransaction()
  .code('(free.multi-sig-action)')
  .signer({
    pubKey: 'alice-key',
    scheme: 'ED25519',
    caps: []
  })
  .signer({
    pubKey: 'bob-key',
    scheme: 'ED25519',
    caps: []
  })
  .signer({
    pubKey: 'charlie-key',
    scheme: 'ED25519',
    caps: []
  })
```

### Continuation Transactions

```typescript
// Initial transaction with pact-id
const step1 = await createTransaction()
  .code('(free.multi-step.start)')
  .pactId('unique-pact-id')
  .step(0)
  .rollback(false)
  .sign()
  .submitAndListen()

// Continuation
const step2 = await createTransaction()
  .continuation({
    pactId: 'unique-pact-id',
    step: 1,
    rollback: false,
    data: { additionalData: 'value' }
  })
  .sign()
  .submitAndListen()
```

### Batch Transactions

```typescript
import { batchTransaction } from '@pact-toolbox/transaction'

// Create multiple transactions
const transactions = [
  createTransaction().code('(+ 1 1)'),
  createTransaction().code('(+ 2 2)'),
  createTransaction().code('(+ 3 3)')
]

// Execute in batch
const results = await batchTransaction(transactions)
  .chainId('0')
  .sender('batch-sender')
  .gasLimit(1000)
  .sign()
  .submitAndListen()

console.log('Batch results:', results)
```

## Integration with Pact Contracts

### Type-Safe Contract Calls

When used with the unplugin, you get fully typed contract methods:

```typescript
import { todos } from './contracts/todos.pact'

// Automatic type inference
const result = await todos
  .createTodo({
    id: 'todo-1',
    title: 'Learn Pact',
    completed: false
  })
  .sign()
  .submitAndListen()

// TypeScript knows result.data has the todo structure
console.log(result.data.id) // Type-safe access
```

### Custom Transaction Options

```typescript
const result = await todos
  .createTodo({ id: '1', title: 'Task', completed: false })
  .withOptions({
    sender: 'alice',
    gasLimit: 2000,
    gasPrice: 0.000001,
    chainId: '1',
    ttl: 1800 // 30 minutes
  })
  .sign()
  .submitAndListen()
```

## Wallet Integration

### Automatic Wallet Detection

The transaction builder automatically detects and uses available wallets:

```typescript
// Automatically uses connected wallet
const result = await createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .sign() // Prompts user in their wallet
  .submitAndListen()
```

### Specific Wallet Usage

```typescript
import { ChainweaverWallet, EckoWallet } from '@pact-toolbox/wallet-adapters'

// Use specific wallet
const chainweaver = new ChainweaverWallet()
const result = await createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .sign({ wallet: chainweaver })
  .submitAndListen()
```

### Manual Signing

```typescript
import { sign } from '@pact-toolbox/crypto'

// Build unsigned transaction
const unsigned = createTransaction()
  .code('(+ 1 2)')
  .build()

// Sign manually
const signature = sign(unsigned.hash, privateKey)

// Add signature
const signed = unsigned.addSignature({
  sig: signature,
  pubKey: publicKey,
  scheme: 'ED25519'
})

// Submit
const result = await signed.submitAndListen()
```

## Gas Estimation

### Automatic Gas Estimation

```typescript
const tx = await createTransaction()
  .code('(complex-operation)')
  .estimateGas() // Automatically sets optimal gas limit

console.log('Estimated gas:', tx.gasLimit)
```

### Manual Gas Configuration

```typescript
const tx = createTransaction()
  .code('(simple-operation)')
  .gasLimit(500) // Manual limit
  .gasPrice(0.000001) // 1e-6 KDA per gas
  .gasPayer('gas-station') // Third-party gas payer
  .gasPayerCaps(['coin.GAS']) // Gas payer capabilities
```

## Error Handling

### Transaction Errors

```typescript
try {
  const result = await createTransaction()
    .code('(invalid-function)')
    .sign()
    .submitAndListen()
} catch (error) {
  if (error instanceof TransactionError) {
    console.error('Transaction failed:', error.message)
    console.error('Request key:', error.requestKey)
    console.error('Result:', error.result)
  }
}
```

### Validation Errors

```typescript
try {
  const tx = createTransaction()
    .code('') // Empty code
    .build()
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.field, error.message)
  }
}
```

### Timeout Handling

```typescript
const result = await createTransaction()
  .code('(long-running-operation)')
  .sign()
  .submitAndListen({
    timeout: 60000, // 60 seconds
    onTimeout: () => {
      console.log('Transaction is taking longer than expected...')
      // Can still continue waiting or abort
    }
  })
```

## Transaction Lifecycle

### Status Monitoring

```typescript
const tx = createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .sign()

// Submit and get request key
const requestKey = await tx.submit()
console.log('Submitted:', requestKey)

// Poll for status
const status = await tx.poll(requestKey)
console.log('Status:', status)

// Wait for completion
const result = await tx.listen(requestKey)
console.log('Completed:', result)
```

### Event Handling

```typescript
const result = await createTransaction()
  .code('(emit-event "transfer" { from: "alice", to: "bob", amount: 1.0 })')
  .onEvent('transfer', (event) => {
    console.log('Transfer event:', event)
  })
  .sign()
  .submitAndListen()
```

## Configuration

### Global Configuration

```typescript
import { configureTransaction } from '@pact-toolbox/transaction'

// Set global defaults
configureTransaction({
  networkId: 'testnet04',
  chainId: '0',
  gasLimit: 1000,
  gasPrice: 0.000001,
  ttl: 600,
  sender: 'default-sender'
})

// All transactions will use these defaults
const tx = createTransaction()
  .code('(+ 1 2)')
  // No need to set chainId, gasLimit, etc.
```

### Network-Specific Configuration

```typescript
import { createTransactionForNetwork } from '@pact-toolbox/transaction'

// Create transaction for specific network
const mainnetTx = createTransactionForNetwork('mainnet01')
  .code('(coin.get-balance "alice")')

const testnetTx = createTransactionForNetwork('testnet04')
  .code('(coin.get-balance "alice")')
```

## Best Practices

### 1. Always Set Appropriate TTL

```typescript
// Short TTL for time-sensitive operations
const urgentTx = createTransaction()
  .code('(time-sensitive-operation)')
  .ttl(60) // 1 minute

// Longer TTL for complex operations
const complexTx = createTransaction()
  .code('(complex-operation)')
  .ttl(3600) // 1 hour
```

### 2. Use Meaningful Nonces

```typescript
const tx = createTransaction()
  .code('(operation)')
  .nonce(`user-${userId}-${Date.now()}`)
```

### 3. Handle Capabilities Properly

```typescript
// Always request only required capabilities
const tx = createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .capability('coin.TRANSFER', 'alice', 'bob', { decimal: '1.0' })
  // Don't add unnecessary capabilities
```

### 4. Validate Before Submission

```typescript
const tx = createTransaction()
  .code('(complex-operation)')
  
// Validate locally first
const validation = await tx.validate()
if (validation.valid) {
  const result = await tx.sign().submitAndListen()
} else {
  console.error('Validation errors:', validation.errors)
}
```

## API Reference

### createTransaction()

Creates a new transaction builder instance.

### Transaction Builder Methods

- `code(pactCode: string)` - Set Pact code
- `data(envData: object)` - Set environment data
- `sender(account: string)` - Set sender account
- `chainId(id: string)` - Set target chain
- `gasLimit(limit: number)` - Set gas limit
- `gasPrice(price: number)` - Set gas price
- `ttl(seconds: number)` - Set time to live
- `nonce(value: string)` - Set nonce
- `capability(name: string, ...args: any[])` - Add capability
- `signer(signerInfo: SignerInfo)` - Add signer
- `build()` - Build unsigned transaction
- `sign(options?: SignOptions)` - Sign transaction
- `submit()` - Submit to network
- `submitAndListen(options?: ListenOptions)` - Submit and wait

### Types

```typescript
interface TransactionBuilder {
  // Builder methods...
}

interface SignOptions {
  wallet?: Wallet
  signers?: Signer[]
}

interface ListenOptions {
  timeout?: number
  pollInterval?: number
  onTimeout?: () => void
}

interface TransactionResult {
  requestKey: string
  status: 'success' | 'failure'
  data: any
  events: Event[]
  gas: number
  logs: string
  continuation?: Continuation
}
```