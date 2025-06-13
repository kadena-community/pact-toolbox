# @pact-toolbox/client

> High-level client library for Pact blockchain interactions

## Overview

The `@pact-toolbox/client` package provides a powerful, type-safe client for interacting with Pact blockchains. It features a fluent transaction builder API, multi-wallet support, and convenient helpers for common operations.

## Installation

```bash
npm install @pact-toolbox/client
# or
pnpm add @pact-toolbox/client
```

## Features

- =( **Fluent Transaction Builder** - Chainable API for building complex transactions
- =[ **Multi-Wallet Support** - Integrates with Ecko, Ledger, MetaMask, and more
- = **Type-Safe** - Full TypeScript support with proper typing
- =€ **High-Level Abstractions** - Simplified APIs for common operations
- = **Transaction Management** - Automatic polling and confirmation handling
- =ñ **Cross-Platform** - Works in Node.js, browsers, and React Native

## Quick Start

```typescript
import { PactTransactionBuilder } from '@pact-toolbox/client';

// Build and execute a simple transaction
const result = await PactTransactionBuilder
  .create()
  .code('(coin.details "alice")')
  .setMeta({ chainId: '0', senderAccount: 'alice' })
  .execute();

console.log(result);
```

## Transaction Builder

### Basic Usage

```typescript
import { PactTransactionBuilder } from '@pact-toolbox/client';

const builder = PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .addCapability('coin.TRANSFER', 'alice', 'bob', 10.0)
  .addSigner({
    pubKey: 'alice-public-key',
    caps: [['coin.TRANSFER', 'alice', 'bob', 10.0]]
  })
  .setMeta({
    chainId: '0',
    senderAccount: 'alice',
    gasLimit: 1000,
    gasPrice: 0.00001
  });

// Execute the transaction
const result = await builder.execute();
```

### Advanced Features

#### Multi-Chain Transactions

```typescript
const multiChainTx = PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .setMeta({ chainId: '0' })
  .continuation({
    pactId: 'cross-chain-transfer',
    step: 1,
    rollback: false,
    data: { amount: 10.0 }
  });
```

#### Namespace Support

```typescript
const namespacedTx = PactTransactionBuilder.create()
  .namespace('my-namespace')
  .code('(my-namespace.my-module.my-function)')
  .addCapability('my-namespace.my-module.MY-CAP');
```

#### Data Passing

```typescript
const txWithData = PactTransactionBuilder.create()
  .code('(free.my-module.process-data data)')
  .addData({ 
    data: {
      items: ['item1', 'item2'],
      metadata: { version: '1.0' }
    }
  });
```

## Wallet Integration

### Using Different Wallets

```typescript
import { 
  PactTransactionBuilder, 
  EckoWallet, 
  LedgerWallet, 
  ToolboxWallet 
} from '@pact-toolbox/client';

// Ecko Wallet
const eckoWallet = new EckoWallet();
await eckoWallet.connect();

const eckoTx = await PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .wallet(eckoWallet)
  .execute();

// Ledger Wallet
const ledgerWallet = new LedgerWallet({ transport: 'WebUSB' });
await ledgerWallet.connect();

const ledgerTx = await PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .wallet(ledgerWallet)
  .execute();

// Toolbox Wallet (for development)
const toolboxWallet = new ToolboxWallet({
  account: 'sender00',
  keys: {
    public: 'public-key',
    secret: 'secret-key'
  }
});

const toolboxTx = await PactTransactionBuilder.create()
  .code('(coin.transfer "sender00" "bob" 10.0)')
  .wallet(toolboxWallet)
  .execute();
```

### Custom Wallet Implementation

```typescript
import { Wallet, WalletAccount } from '@pact-toolbox/client';

class CustomWallet implements Wallet {
  async connect(): Promise<void> {
    // Connection logic
  }
  
  async disconnect(): Promise<void> {
    // Disconnection logic
  }
  
  async getAccounts(): Promise<WalletAccount[]> {
    return [{
      account: 'my-account',
      publicKey: 'my-public-key',
      chains: ['0', '1', '2']
    }];
  }
  
  async sign(transaction: any): Promise<any> {
    // Signing logic
    return signedTransaction;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  isInstalled(): boolean {
    return true;
  }
}
```

## Transaction Dispatcher

For more control over transaction lifecycle:

```typescript
import { PactTransactionDispatcher } from '@pact-toolbox/client';

const dispatcher = new PactTransactionDispatcher({
  networkConfig: {
    apiUrl: 'http://localhost:8080',
    networkId: 'development'
  }
});

// Build transaction
const tx = await PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" 10.0)')
  .build();

// Submit transaction
const requestKey = await dispatcher.submit(tx);

// Poll for result
const result = await dispatcher.pollOne(requestKey, {
  interval: 1000,
  timeout: 60000
});
```

## Coin Module Helpers

Convenient functions for common coin operations:

```typescript
import { coin } from '@pact-toolbox/client';

// Get account details
const details = await coin.details('alice');

// Transfer tokens
await coin.transfer({
  from: 'alice',
  to: 'bob',
  amount: 10.0,
  signer: aliceWallet
});

// Create account with guard
await coin.createAccount({
  account: 'charlie',
  guard: {
    keys: ['charlie-public-key'],
    pred: 'keys-all'
  },
  signer: gasStationWallet
});

// Get balance
const balance = await coin.getBalance('alice');
```

## Capabilities and Signers

### Adding Capabilities

```typescript
const tx = PactTransactionBuilder.create()
  .code('(my-module.protected-function)')
  .addCapability('my-module.ADMIN')
  .addCapability('coin.TRANSFER', 'alice', 'bob', 10.0)
  .addSigner({
    pubKey: 'admin-key',
    caps: [
      ['my-module.ADMIN'],
      ['coin.TRANSFER', 'alice', 'bob', 10.0]
    ]
  });
```

### Multiple Signers

```typescript
const multiSigTx = PactTransactionBuilder.create()
  .code('(my-module.multi-sig-operation)')
  .addSigner({
    pubKey: 'alice-key',
    caps: [['my-module.OPERATE']]
  })
  .addSigner({
    pubKey: 'bob-key',
    caps: [['my-module.APPROVE']]
  });
```

## Keysets and Guards

```typescript
// Add keyset
const tx = PactTransactionBuilder.create()
  .code('(my-module.guarded-function)')
  .addKeyset('admin-keyset', {
    keys: ['admin-key-1', 'admin-key-2'],
    pred: 'keys-2'
  });

// Use with guards
const guardedTx = PactTransactionBuilder.create()
  .code(`
    (coin.create-account 
      "new-account" 
      (read-keyset "account-guard"))
  `)
  .addKeyset('account-guard', {
    keys: ['key1', 'key2'],
    pred: 'keys-any'
  });
```

## Network Configuration

```typescript
// Configure for different networks
const testnetTx = PactTransactionBuilder.create()
  .code('(coin.details "alice")')
  .networkConfig({
    apiUrl: 'https://api.testnet.chainweb.com',
    networkId: 'testnet04'
  })
  .setMeta({ chainId: '0' });

// Use with existing client
const client = new PactToolboxClient(config);
const tx = PactTransactionBuilder.create()
  .code('(coin.details "alice")')
  .client(client);
```

## Error Handling

```typescript
try {
  const result = await PactTransactionBuilder.create()
    .code('(coin.transfer "alice" "bob" 10.0)')
    .execute();
    
  if (result.status === 'failure') {
    console.error('Transaction failed:', result.error);
  }
} catch (error) {
  if (error.code === 'WALLET_NOT_CONNECTED') {
    console.error('Please connect your wallet first');
  } else if (error.code === 'INSUFFICIENT_GAS') {
    console.error('Not enough gas for transaction');
  } else {
    console.error('Transaction error:', error);
  }
}
```

## Best Practices

### 1. Always Set Metadata

```typescript
const tx = PactTransactionBuilder.create()
  .code('...')
  .setMeta({
    chainId: '0',
    senderAccount: 'gas-payer',
    gasLimit: 10000,
    gasPrice: 0.00001,
    ttl: 600
  });
```

### 2. Use Type Guards

```typescript
import { isTransactionSuccess, isTransactionFailure } from '@pact-toolbox/client';

const result = await tx.execute();

if (isTransactionSuccess(result)) {
  console.log('Success:', result.data);
} else if (isTransactionFailure(result)) {
  console.error('Failed:', result.error);
}
```

### 3. Handle Network Delays

```typescript
const result = await PactTransactionBuilder.create()
  .code('...')
  .execute({
    pollInterval: 5000,
    pollTimeout: 300000 // 5 minutes
  });
```

### 4. Validate Before Execution

```typescript
const tx = PactTransactionBuilder.create()
  .code('(coin.transfer "alice" "bob" amount)')
  .addData({ amount: 10.0 });

// Validate transaction before sending
const validation = await tx.validate();
if (!validation.isValid) {
  console.error('Invalid transaction:', validation.errors);
}
```

## API Reference

### PactTransactionBuilder

Main class for building transactions with a fluent API.

#### Methods

- `create()` - Create a new builder instance
- `code(pactCode: string)` - Set Pact code
- `addCapability(name: string, ...args: any[])` - Add capability
- `addSigner(signer: SignerInput)` - Add transaction signer
- `addKeyset(name: string, keyset: Keyset)` - Add keyset
- `addData(data: object)` - Add transaction data
- `setMeta(meta: Partial<TransactionMeta>)` - Set metadata
- `wallet(wallet: Wallet)` - Set wallet for signing
- `client(client: PactToolboxClient)` - Use existing client
- `networkConfig(config: NetworkConfig)` - Set network config
- `namespace(ns: string)` - Set namespace
- `continuation(cont: Continuation)` - Set continuation
- `build()` - Build transaction object
- `execute(options?)` - Build and execute transaction

### PactTransactionDispatcher

Handles transaction submission and monitoring.

#### Methods

- `submit(transaction: Transaction)` - Submit transaction
- `pollOne(requestKey: string, options?)` - Poll single transaction
- `pollMany(requestKeys: string[], options?)` - Poll multiple transactions
- `getStatus(requestKey: string)` - Get transaction status

### Wallet Interface

```typescript
interface Wallet {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccounts(): Promise<WalletAccount[]>;
  sign(transaction: any): Promise<any>;
  isConnected(): boolean;
  isInstalled(): boolean;
}
```

### Transaction Types

```typescript
interface TransactionMeta {
  chainId: string;
  senderAccount: string;
  gasLimit: number;
  gasPrice: number;
  ttl: number;
  creationTime?: number;
}

interface SignerInput {
  pubKey: string;
  scheme?: 'ED25519' | 'WebAuthn';
  caps?: Capability[];
}

interface Keyset {
  keys: string[];
  pred: 'keys-all' | 'keys-any' | 'keys-2' | string;
}
```

## Examples

### Complete Transfer Example

```typescript
import { PactTransactionBuilder, EckoWallet } from '@pact-toolbox/client';

async function transferTokens() {
  // Connect wallet
  const wallet = new EckoWallet();
  await wallet.connect();
  
  // Get account info
  const accounts = await wallet.getAccounts();
  const sender = accounts[0];
  
  // Build and execute transfer
  const result = await PactTransactionBuilder.create()
    .code(`(coin.transfer "${sender.account}" "bob" 10.0)`)
    .addCapability('coin.TRANSFER', sender.account, 'bob', 10.0)
    .addSigner({
      pubKey: sender.publicKey,
      caps: [['coin.TRANSFER', sender.account, 'bob', 10.0]]
    })
    .setMeta({
      chainId: '0',
      senderAccount: sender.account,
      gasLimit: 1000,
      gasPrice: 0.00001
    })
    .wallet(wallet)
    .execute();
  
  if (result.status === 'success') {
    console.log('Transfer successful!');
  }
}
```

### Module Deployment Example

```typescript
async function deployModule(moduleCode: string) {
  const result = await PactTransactionBuilder.create()
    .code(moduleCode)
    .addKeyset('module-admin', {
      keys: ['admin-public-key'],
      pred: 'keys-all'
    })
    .addSigner({
      pubKey: 'admin-public-key',
      caps: []
    })
    .setMeta({
      chainId: '0',
      senderAccount: 'module-deployer',
      gasLimit: 100000,
      gasPrice: 0.00001
    })
    .execute();
  
  return result;
}
```