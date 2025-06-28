# @pact-toolbox/chainweb-client

Fast, lightweight client for Chainweb and Pact APIs on the Kadena blockchain.

## Features

- 🚀 **Simple & Powerful** - Clean API focused on common use cases
- 🌐 **Cross-Platform** - Works in browsers, Node.js, and React Native
- ⚡ **Fast** - Native fetch API with minimal overhead
- 🔄 **Robust** - Built-in timeout and error handling
- 📦 **Lightweight** - No external dependencies beyond pact-toolbox core
- 🔧 **TypeScript** - Full type safety and IntelliSense support

## Installation

```bash
npm install @pact-toolbox/chainweb-client
# or
pnpm add @pact-toolbox/chainweb-client
# or
yarn add @pact-toolbox/chainweb-client
```

## Quick Start

```typescript
import { ChainwebClient, createMainnetClient, createTestnetClient } from '@pact-toolbox/chainweb-client';

// Use built-in network clients
const mainnetClient = createMainnetClient();
const testnetClient = createTestnetClient();

// Or create custom client
const client = new ChainwebClient({
  networkId: 'mainnet01',
  chainId: '0',
  rpcUrl: (networkId, chainId) => 
    `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`
});
```

## Core API

### Send Transactions

```typescript
// Send signed transactions
const result = await client.send([signedTransaction]);
console.log('Request keys:', result.requestKeys);

// Submit and wait for result
const txResult = await client.submitAndWait(signedTransaction);
console.log('Transaction result:', txResult);
```

### Query Blockchain

```typescript
// Execute local (read-only) queries
const localResult = await client.local({
  cmd: JSON.stringify({
    code: '(coin.get-balance "alice")',
    data: {},
    meta: { chainId: '0', sender: '', gasLimit: 1000, gasPrice: 0.000001, ttl: 28800 }
  })
});

// Poll for transaction status
const pollResult = await client.poll(['request-key-123']);

// Listen for single transaction
const listenResult = await client.listen('request-key-123');
```

### Batch Operations

```typescript
// Process multiple transactions in batches
const batchResult = await client.submitBatch(signedTransactions, {
  batchSize: 10,
  pollInterval: 5000
});

console.log(`${batchResult.successCount} succeeded, ${batchResult.failureCount} failed`);
```

### Network Information

```typescript
// Check network health
const health = await client.healthCheck();
console.log('Network healthy:', health.healthy);

// Get network info
const networkInfo = await client.getNetworkInfo();
console.log('Chains:', networkInfo.chains);

// Get current cut info
const cut = await client.getCut();
console.log('Current height:', cut.height);
```

### Client Configuration

```typescript
// Create clients for different chains/networks
const chain5Client = client.forChain('5');
const devnetClient = client.forNetwork('development');

// Custom configuration
const customClient = client.withConfig({
  timeout: 60000,
  headers: { 'Authorization': 'Bearer token' }
});
```

## Configuration Options

```typescript
interface NetworkConfig {
  /** Network ID (e.g., 'mainnet01', 'testnet04', 'development') */
  networkId: string;
  /** Chain ID (e.g., '0', '1', '2', etc.) */
  chainId: string;
  /** Function to build RPC URLs */
  rpcUrl: (networkId: string, chainId: string) => string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}
```

## Error Handling

The client provides detailed error information through `ChainwebClientError`:

```typescript
try {
  await client.send([transaction]);
} catch (error) {
  if (error instanceof ChainwebClientError) {
    console.log('Error code:', error.code);
    console.log('HTTP status:', error.status);
    console.log('Response:', error.response);
  }
}
```

Error codes:
- `NETWORK_ERROR` - Network connectivity issues
- `TIMEOUT` - Request timeout
- `HTTP_ERROR` - HTTP status errors (4xx, 5xx)
- `PARSE_ERROR` - Invalid response format
- `VALIDATION_ERROR` - Invalid input parameters
- `TRANSACTION_ERROR` - Transaction processing errors

## Built-in Network Clients

### Mainnet
```typescript
import { createMainnetClient } from '@pact-toolbox/chainweb-client';

const client = createMainnetClient({
  chainId: '1', // Optional: defaults to '0'
  timeout: 60000 // Optional: custom timeout
});
```

### Testnet
```typescript
import { createTestnetClient } from '@pact-toolbox/chainweb-client';

const client = createTestnetClient({
  chainId: '0' // Optional: defaults to '0'
});
```

### Development/Local
```typescript
import { createDevnetClient, createPactServerClient } from '@pact-toolbox/chainweb-client';

// For local chainweb node
const devClient = createDevnetClient(8080);

// For pact-server
const pactClient = createPactServerClient(8080);
```

## Integration with Pact Toolbox

The client integrates seamlessly with other pact-toolbox packages:

```typescript
import { ChainwebClient } from '@pact-toolbox/chainweb-client';
import { finalizeTransaction } from '@pact-toolbox/signers';
import type { Transaction } from '@pact-toolbox/types';

const client = new ChainwebClient(config);

// Sign and send transaction
const signedTx = finalizeTransaction(transaction);
const result = await client.submitAndWait(signedTx);
```

## Platform Compatibility

- **Browsers** - Modern browsers with native fetch support
- **Node.js** - Version 18+ (native fetch) or 16+ with fetch polyfill
- **React Native** - All recent versions with fetch support
- **Deno/Bun** - Full compatibility

## Performance Tips

1. **Reuse client instances** - Create once, use throughout your app
2. **Use batch operations** - For multiple transactions
3. **Configure timeouts** - Based on your network conditions
4. **Handle errors gracefully** - Implement proper retry logic for critical operations

## API Reference

### Core Methods

- `send(transactions)` - Send signed transactions
- `poll(requestKeys)` - Poll for transaction results
- `listen(requestKey)` - Listen for single transaction result
- `local(command)` - Execute read-only local query
- `submitAndWait(transaction)` - Send transaction and wait for result
- `submitBatch(transactions, options)` - Process multiple transactions in batches

### Network Methods

- `healthCheck()` - Check network health
- `getNetworkInfo()` - Get network information
- `getCut()` - Get current cut information
- `getChainInfo(chainId?)` - Get chain-specific information
- `getTransaction(requestKey)` - Get transaction by request key

### Utility Methods

- `withConfig(config)` - Create client with new configuration
- `forChain(chainId)` - Create client for different chain
- `forNetwork(networkId)` - Create client for different network

## Contributing

See the main [pact-toolbox repository](https://github.com/kadena-community/pact-toolbox) for contribution guidelines.

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)