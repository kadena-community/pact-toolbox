# @pact-toolbox/transaction

> High-level transaction builder for Pact smart contracts

## Overview

The `@pact-toolbox/transaction` package provides a powerful, type-safe transaction builder for Pact blockchains. It features a fluent transaction builder API, multi-wallet support, network context management, and convenient abstractions for common operations.

## Installation

```bash
npm install @pact-toolbox/transaction
# or
pnpm add @pact-toolbox/transaction
```

## Features

- 🔧 **Fluent Transaction Builder** - Chainable API for building complex transactions
- 🔐 **Multi-Wallet Support** - Integrates with Ecko, Ledger, MetaMask, and more
- 🎯 **Type-Safe** - Full TypeScript support with proper typing
- 📦 **High-Level Abstractions** - Simplified APIs for common operations
- ⚡ **Transaction Management** - Automatic polling and confirmation handling
- 🌐 **Cross-Platform** - Works in Node.js, browsers, and React Native

## Quick Start

```typescript
import { execution } from "@pact-toolbox/transaction";

// Build and execute a simple read operation
const result = await execution('(coin.details "alice")')
  .withChainId("0")
  .build()
  .dirtyRead();

console.log(result);
```

## Transaction Builder

### Basic Usage

```typescript
import { execution } from "@pact-toolbox/transaction";

// Build and execute a transaction
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-public-key", (signFor) => [
    signFor("coin.TRANSFER", "alice", "bob", 10.0)
  ])
  .withChainId("0")
  .withMeta({
    gasLimit: 1000,
    gasPrice: 0.00001,
  })
  .sign(wallet)
  .submitAndListen();
```

### Continuation Transactions

```typescript
import { continuation } from "@pact-toolbox/transaction";

// Create a continuation transaction
const contResult = await continuation({
  pactId: "cross-chain-transfer-pact-id",
  step: 1,
  rollback: false,
  data: { amount: 10.0 },
})
  .withChainId("1")
  .sign(wallet)
  .submitAndListen();
```

### Data and Keysets

```typescript
const txWithData = execution("(free.my-module.process-data data)")
  .withData("user", "alice")
  .withData("amount", 100)
  .withKeyset("admin-keyset", {
    keys: ["admin-public-key"],
    pred: "keys-all",
  })
  .withChainId("0");
```

## Wallet Integration

### Using Wallets with Transactions

The package supports explicit wallet selection for enhanced security:

```typescript
import { execution } from "@pact-toolbox/transaction";

// Option 1: Provide wallet instance
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withChainId("0")
  .sign(myWallet) // Pass wallet instance
  .submitAndListen();

// Option 2: Use wallet ID (requires wallet adapters)
const result2 = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withChainId("0")
  .sign("ecko-wallet", { showUI: true }) // Show wallet selector
  .submitAndListen();

// Option 3: Show wallet selector
const result3 = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withChainId("0")
  .sign() // Shows wallet selector UI
  .submitAndListen();
```

## Network Context Management

The transaction package automatically manages network configuration through a global context:

### Getting Network Context

```typescript
import { createToolboxNetworkContext, getToolboxGlobalMultiNetworkConfig } from "@pact-toolbox/transaction";

// Get global network configuration
const config = getToolboxGlobalMultiNetworkConfig();
console.log("Available networks:", Object.keys(config.configs));
console.log("Current environment:", config.environment);

// Create a network context
const context = createToolboxNetworkContext(config);
```

### Using Custom Network Context

```typescript
import { execution, createToolboxNetworkContext } from "@pact-toolbox/transaction";

// Create custom context
const customConfig = {
  default: "testnet",
  environment: "development",
  configs: {
    testnet: {
      type: "chainweb",
      networkId: "testnet04",
      rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/testnet04/chain/{chainId}/pact",
      meta: { chainId: "0" },
      // ... other config
    }
  }
};

const context = createToolboxNetworkContext(customConfig);

// Use with transactions
const result = await execution('(coin.details "alice")', context)
  .withChainId("0")
  .build()
  .dirtyRead();
```

## Transaction Execution Methods

### Local Operations (Read-only)

```typescript
// dirtyRead - Fast read without going through consensus
const balance = await execution('(coin.get-balance "alice")')
  .withChainId("0")
  .build()
  .dirtyRead();

// local - Full local execution with gas estimation
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
  .withChainId("0")
  .build()
  .local();
```

### Write Operations

```typescript
// submit - Submit transaction and get request key
const descriptor = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
  .withChainId("0")
  .sign(wallet)
  .submit();

console.log("Request key:", descriptor.requestKey);

// submitAndListen - Submit and wait for result
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
  .withChainId("0")
  .sign(wallet)
  .submitAndListen();
```

### Multi-Chain Operations

```typescript
// Execute on multiple chains
const multiChainResult = await execution('(coin.get-balance "alice")')
  .build()
  .dirtyRead(["0", "1", "2"]); // Execute on chains 0, 1, and 2

// Execute on all chains (0-19)
const allChainResult = await execution('(coin.get-balance "alice")')
  .build()
  .dirtyReadAll();
```

## Utility Functions

### Account Generation

```typescript
import { generateKAccount, generateKAccounts } from "@pact-toolbox/transaction";

// Generate a single K-account
const account = await generateKAccount();
console.log(account.account); // "k:public-key..."
console.log(account.publicKey);
console.log(account.secretKey);

// Generate multiple accounts
const accounts = await generateKAccounts(5);
```

### Network Validation

```typescript
import { validateNetworkForEnvironment } from "@pact-toolbox/transaction";

// Check if network is allowed in current environment
const isValid = validateNetworkForEnvironment("pactServer");
if (!isValid) {
  console.log("Network not available in production");
}
```

### Pact Decimal Formatting

```typescript
import { pactDecimal } from "@pact-toolbox/transaction";

const amount = pactDecimal(123.456);
console.log(amount.decimal); // "123.456000000000"
```

## Transaction Builder Methods

### Data Methods

- `withData(key: string, value: Serializable)` - Add data key-value pair
- `withDataMap(data: Record<string, Serializable>)` - Add multiple data entries

### Keyset Methods

- `withKeyset(name: string, keyset: PactKeyset)` - Add keyset
- `withKeysetMap(keysets: Record<string, PactKeyset>)` - Add multiple keysets

### Transaction Configuration

- `withChainId(chainId: ChainId)` - Set chain ID
- `withMeta(meta: Partial<PactMetadata>)` - Set transaction metadata
- `withNetworkId(networkId: string)` - Set network ID
- `withNonce(nonce: string)` - Set custom nonce

### Signer and Verifier Methods

- `withSigner(signer: PactSignerLike, capability?: PactCapabilityLike)` - Add signer with optional capabilities
- `withVerifier(verifier: PactVerifier)` - Add verifier

### Context and Building

- `withContext(context: ToolboxNetworkContext)` - Set network context
- `build(context?: ToolboxNetworkContext)` - Build unsigned transaction dispatcher
- `sign(walletOrId?: Wallet | string, options?: WalletUIOptions)` - Sign and build transaction dispatcher

## PactTransactionDispatcher Methods

The dispatcher provides execution methods for different transaction types:

### Read Operations

- `dirtyRead(chainId?: ChainId | ChainId[], client?: Client)` - Fast read operation
- `dirtyReadAll(client?: Client)` - Read from all chains
- `local(chainId?: ChainId | ChainId[], client?: Client)` - Local execution
- `localAll(client?: Client)` - Local execution on all chains

### Write Operations

- `submit(chainId?: ChainId | ChainId[], preflight?: boolean, client?: Client)` - Submit transaction
- `submitAll(preflight?: boolean, client?: Client)` - Submit to all chains
- `submitAndListen(chainId?: ChainId | ChainId[], preflight?: boolean, client?: Client)` - Submit and wait for result
- `submitAndListenAll(preflight?: boolean, client?: Client)` - Submit and listen on all chains

### Utility

- `getSignedTransaction()` - Get the signed transaction object

## Error Handling

```typescript
try {
  const result = await execution('(coin.transfer "alice" "bob" 10.0)')
    .withChainId("0")
    .sign(wallet)
    .submitAndListen();

  console.log("Success:", result);
} catch (error) {
  if (error.message.includes("No wallet provided")) {
    console.error("Please provide a wallet");
  } else if (error.message.includes("No client provided")) {
    console.error("Network configuration issue");
  } else {
    console.error("Transaction error:", error);
  }
}
```

## Best Practices

### 1. Always Specify Chain ID

```typescript
// Always set chain ID explicitly
const tx = execution("...")
  .withChainId("0"); // Explicit chain ID
```

### 2. Use Appropriate Execution Method

```typescript
// Use dirtyRead for simple queries
const balance = await execution('(coin.get-balance "alice")')
  .build()
  .dirtyRead();

// Use local for complex queries or validation
const estimate = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
  .build()
  .local();

// Use submitAndListen for write operations
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .sign(wallet)
  .submitAndListen();
```

### 3. Handle Network Context Properly

```typescript
import { getToolboxGlobalMultiNetworkConfig, validateNetworkForEnvironment } from "@pact-toolbox/transaction";

// Check network availability
const config = getToolboxGlobalMultiNetworkConfig();
if (!validateNetworkForEnvironment(config.default)) {
  throw new Error("Current network not available in this environment");
}
```

### 4. Provide Appropriate Capabilities

```typescript
const tx = execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice-key", (signFor) => [
    signFor("coin.TRANSFER", "alice", "bob", 10.0), // Specific transfer capability
    signFor("coin.GAS") // Gas capability
  ]);
```

## Examples

### Complete Transfer Example

```typescript
import { execution } from "@pact-toolbox/transaction";

async function transferTokens(fromAccount: string, toAccount: string, amount: number, wallet: any) {
  try {
    const result = await execution(`(coin.transfer "${fromAccount}" "${toAccount}" ${amount})`)
      .withSigner(wallet.publicKey, (signFor) => [
        signFor("coin.TRANSFER", fromAccount, toAccount, amount),
        signFor("coin.GAS")
      ])
      .withChainId("0")
      .withMeta({
        gasLimit: 1000,
        gasPrice: 0.00001,
        ttl: 600,
      })
      .sign(wallet)
      .submitAndListen();

    console.log("Transfer successful:", result);
    return result;
  } catch (error) {
    console.error("Transfer failed:", error);
    throw error;
  }
}
```

### Query Balance Example

```typescript
import { execution } from "@pact-toolbox/transaction";

async function getBalance(account: string, chainId: string = "0") {
  const result = await execution(`(coin.get-balance "${account}")`)
    .withChainId(chainId)
    .build()
    .dirtyRead();

  return result;
}
```

### Module Deployment Example

```typescript
import { execution } from "@pact-toolbox/transaction";

async function deployModule(moduleCode: string, adminKeyset: any, wallet: any) {
  const result = await execution(moduleCode)
    .withKeyset("module-admin", adminKeyset)
    .withSigner(wallet.publicKey, (signFor) => [
      signFor("coin.GAS")
    ])
    .withChainId("0")
    .withMeta({
      gasLimit: 100000,
      gasPrice: 0.00001,
    })
    .sign(wallet)
    .submitAndListen();

  return result;
}
```

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)