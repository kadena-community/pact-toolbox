# @pact-toolbox/runtime

> Node.js runtime client for Pact smart contract development on Kadena blockchain

## Overview

The `@pact-toolbox/runtime` package provides a comprehensive Node.js client for interacting with Pact smart contracts. It offers high-level APIs for contract deployment, transaction execution, and blockchain interactions with support for multiple network types and configurations.

## Installation

```bash
npm install @pact-toolbox/runtime
# or
pnpm add @pact-toolbox/runtime
```

## Features

- =€ **Contract Deployment** - Deploy single or multiple contracts with ease
- =Ý **Transaction Building** - Fluent API for building complex transactions
- < **Multi-Network Support** - Works with local, devnet, and mainnet
- = **Signer Integration** - Environment variable and wallet support
- =Á **File System Integration** - Load contracts directly from files
- ¡ **Performance Options** - Preflight, local execution, and dirty reads
- = **Transaction Management** - Submit, listen, and poll for results
- =à **Developer Tools** - Module introspection and namespace management

## Quick Start

```typescript
import { PactToolboxClient } from '@pact-toolbox/runtime';

// Create client with configuration
const client = new PactToolboxClient({
  network: {
    type: 'devnet',
    name: 'local-devnet',
    devnet: {
      url: 'http://localhost:8080',
      chainIds: ['0', '1', '2', '3']
    }
  },
  contractsDir: './contracts'
});

// Deploy a contract
await client.deployContract('./contracts/my-module.pact');

// Execute a transaction
const result = await client.execution('(my-module.hello-world)')
  .addData({ name: 'Alice' })
  .submitAndListen();

console.log(result);
```

## Client Configuration

### Creating a Client

```typescript
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { resolveConfig } from '@pact-toolbox/config';

// Option 1: With inline configuration
const client1 = new PactToolboxClient({
  network: {
    type: 'pact-server',
    name: 'local',
    pactServer: {
      url: 'http://localhost:9001'
    }
  }
});

// Option 2: From resolved configuration
const config = await resolveConfig();
const client2 = new PactToolboxClient(config);

// Option 3: With custom directories
const client3 = new PactToolboxClient({
  contractsDir: './pact',
  scriptsDir: './pact/scripts',
  preludesDir: './pact/preludes',
  network: { /* ... */ }
});
```

### Network Types

#### 1. Pact Server (Local Development)

```typescript
const client = new PactToolboxClient({
  network: {
    type: 'pact-server',
    name: 'local',
    pactServer: {
      url: 'http://localhost:9001'
    }
  }
});
```

#### 2. Chainweb DevNet

```typescript
const client = new PactToolboxClient({
  network: {
    type: 'chainweb-devnet',
    name: 'devnet',
    devnet: {
      url: 'http://localhost:8080',
      chainIds: ['0', '1', '2', '3'],
      miningConfig: {
        onDemandMining: true
      }
    }
  }
});
```

#### 3. Chainweb (Testnet/Mainnet)

```typescript
const client = new PactToolboxClient({
  network: {
    type: 'chainweb',
    name: 'testnet',
    chainweb: {
      networkId: 'testnet04',
      apiHost: 'https://api.testnet.chainweb.com',
      chainIds: ['0', '1']
    }
  }
});
```

## Contract Deployment

### Deploy Single Contract

```typescript
// Deploy from file
await client.deployContract('./contracts/token.pact');

// Deploy with options
await client.deployContract('./contracts/token.pact', {
  chainIds: ['0', '1'],      // Deploy to specific chains
  preflight: false,          // Skip preflight
  signatureVerification: false,
  listen: true               // Wait for confirmation
});

// Deploy raw code
await client.deployCode('(module test GOVERNANCE ...)');
```

### Deploy Multiple Contracts

```typescript
// Deploy multiple files
await client.deployContracts([
  './contracts/token.pact',
  './contracts/exchange.pact',
  './contracts/governance.pact'
]);

// Deploy with dependencies in order
const contracts = [
  { path: './base.pact', chainIds: ['0'] },
  { path: './dependent.pact', chainIds: ['0'] }
];

for (const contract of contracts) {
  await client.deployContract(contract.path, {
    chainIds: contract.chainIds
  });
}
```

### Deployment Patterns

```typescript
// Check before deploying
const isDeployed = await client.isContractDeployed('my-module');
if (!isDeployed) {
  await client.deployContract('./my-module.pact');
}

// Deploy with custom signers
const result = await client.deployContract('./token.pact', {
  signers: [{
    pubKey: 'admin-public-key',
    scheme: 'ED25519'
  }],
  meta: {
    chainId: '0',
    sender: 'admin-account',
    gasLimit: 100000
  }
});
```

## Transaction Building

### Basic Execution

```typescript
// Simple execution
const result = await client.execution('(coin.details "alice")')
  .submitAndListen();

// With data
const transfer = await client.execution('(coin.transfer "alice" "bob" amount)')
  .addData({ amount: 10.0 })
  .submitAndListen();
```

### Advanced Transaction Building

```typescript
const result = await client.execution('(my-module.complex-operation)')
  // Add metadata
  .setMeta({
    chainId: '0',
    sender: 'gas-payer',
    gasLimit: 10000,
    gasPrice: 0.00001,
    ttl: 600
  })
  // Add signers
  .addSigner({
    pubKey: 'alice-key',
    scheme: 'ED25519',
    caps: [['my-module.TRANSFER', 'alice', 'bob', 10.0]]
  })
  // Add keyset
  .addKeyset('admin-keyset', {
    keys: ['admin-key-1', 'admin-key-2'],
    pred: 'keys-all'
  })
  // Add capabilities
  .addCapability('my-module.TRANSFER', 'alice', 'bob', 10.0)
  // Add data
  .addData({
    config: { timeout: 30 },
    metadata: { version: '1.0' }
  })
  // Execute
  .submitAndListen();
```

### Transaction Execution Methods

```typescript
// Submit without waiting (returns request key)
const requestKey = await client.execution('(my-module.async-op)')
  .submit();

// Submit and listen for result
const result = await client.execution('(my-module.sync-op)')
  .submitAndListen();

// Local execution (validation only)
const localResult = await client.execution('(my-module.validate)')
  .local();

// Dirty read (fast, no consensus)
const dirtyResult = await client.execution('(coin.get-balance "alice")')
  .dirtyRead();
```

### Multi-Chain Transactions

```typescript
// Execute on specific chains
const result = await client.execution('(my-module.deploy)')
  .onChains(['0', '1', '2'])
  .submitAndListen();

// Execute on all chains
const allChains = await client.execution('(my-module.global-update)')
  .onAllChains()
  .submitAndListen();
```

## Contract Interaction

### Module Management

```typescript
// List all modules
const modules = await client.listModules();
console.log('Deployed modules:', modules);

// Describe module interface
const moduleInfo = await client.describeModule('coin');
console.log('Module interface:', moduleInfo);

// Check if module exists
const exists = await client.isContractDeployed('my-module');
console.log('Module deployed:', exists);
```

### Namespace Management

```typescript
// List namespaces
const namespaces = await client.execution('(list-namespaces)')
  .dirtyRead();

// Describe namespace
const nsInfo = await client.describeNamespace('free');
console.log('Namespace info:', nsInfo);

// Check namespace existence
const nsDefined = await client.isNamespaceDefined('my-namespace');
```

### Reading Contract State

```typescript
// Read table data
const accounts = await client.execution('(map (read coin.coin-table) (keys coin.coin-table))')
  .dirtyRead();

// Query specific data
const balance = await client.execution('(coin.get-balance "alice")')
  .dirtyRead();

// Complex queries
const topHolders = await client.execution(`
  (let* ((accounts (keys coin.coin-table))
         (balances (map (read coin.coin-table) accounts)))
    (take 10 (sort (lambda (a b) (> (at 'balance a) (at 'balance b))) balances)))
`)
  .dirtyRead();
```

## Signer Management

### Environment Variable Signers

```typescript
// Set environment variables
process.env.PACT_TOOLBOX_PUBLIC_KEY = 'your-public-key';
process.env.PACT_TOOLBOX_SECRET_KEY = 'your-secret-key';

// Client automatically uses env signers
const client = new PactToolboxClient(config);

// Or explicitly
const signer = client.getSigner();
```

### Custom Signers

```typescript
// Provide keypair
const client = new PactToolboxClient({
  network: { /* ... */ },
  signers: [{
    public: 'public-key-hex',
    secret: 'secret-key-hex'
  }]
});

// Use with transaction
const result = await client.execution('(my-module.admin-op)')
  .withSigner(customSigner)
  .submitAndListen();
```

## File Management

### Contract Loading

```typescript
// Get contract code
const code = await client.getContractCode('token.pact');
console.log('Contract code:', code);

// Load from custom directory
const customCode = await client.getContractCode('../shared/base.pact');

// Handle missing files
try {
  const code = await client.getContractCode('missing.pact');
} catch (error) {
  console.error('Contract not found:', error.message);
}
```

### Directory Configuration

```typescript
const client = new PactToolboxClient({
  contractsDir: './pact/contracts',
  scriptsDir: './pact/scripts',
  preludesDir: './pact/preludes',
  network: { /* ... */ }
});

// Paths are resolved relative to configured directories
await client.deployContract('token.pact'); // Loads from ./pact/contracts/token.pact
```

## Advanced Features

### Preflight Simulation

```typescript
// Simulate transaction before submission
const simulation = await client.execution('(coin.transfer "alice" "bob" 100.0)')
  .addCapability('coin.TRANSFER', 'alice', 'bob', 100.0)
  .local();

if (simulation.result.status === 'success') {
  // Safe to submit
  const result = await client.execution('(coin.transfer "alice" "bob" 100.0)')
    .addCapability('coin.TRANSFER', 'alice', 'bob', 100.0)
    .submitAndListen();
}
```

### Batch Operations

```typescript
// Deploy multiple contracts efficiently
async function deployAll() {
  const contracts = [
    'base.pact',
    'token.pact',
    'exchange.pact',
    'governance.pact'
  ];
  
  const results = await Promise.all(
    contracts.map(contract => 
      client.deployContract(contract, { 
        preflight: false,
        listen: false 
      })
    )
  );
  
  // Wait for all deployments
  const requestKeys = results.map(r => r.requestKey);
  const finalResults = await client.pollRequests(requestKeys);
  
  return finalResults;
}
```

### Error Handling

```typescript
try {
  const result = await client.execution('(my-module.risky-op)')
    .submitAndListen();
    
  if (result.result.status === 'failure') {
    console.error('Transaction failed:', result.result.error);
    // Handle business logic failure
  }
} catch (error) {
  // Handle network or validation errors
  if (error.code === 'NETWORK_ERROR') {
    console.error('Network issue:', error.message);
  } else if (error.code === 'VALIDATION_ERROR') {
    console.error('Invalid transaction:', error.message);
  }
}
```

### Custom Network Context

```typescript
// Override network for specific operations
const testnetClient = client.withNetwork({
  type: 'chainweb',
  name: 'testnet',
  chainweb: {
    networkId: 'testnet04',
    apiHost: 'https://api.testnet.chainweb.com'
  }
});

// Use different network temporarily
const result = await testnetClient.execution('(my-module.test)')
  .submitAndListen();
```

## Testing

### Mock Client for Tests

```typescript
import { createMockClient } from '@pact-toolbox/runtime/testing';

describe('My Contract Tests', () => {
  let client;
  
  beforeEach(() => {
    client = createMockClient({
      modules: ['coin', 'my-module'],
      responses: {
        '(coin.get-balance "alice")': { balance: 1000 }
      }
    });
  });
  
  test('balance query', async () => {
    const result = await client.execution('(coin.get-balance "alice")')
      .dirtyRead();
    expect(result.balance).toBe(1000);
  });
});
```

### Integration Testing

```typescript
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { createPactTestEnv } from '@pact-toolbox/test';

describe('Contract Integration', () => {
  let client;
  let testEnv;
  
  beforeAll(async () => {
    testEnv = await createPactTestEnv();
    await testEnv.start();
    client = new PactToolboxClient(testEnv.config);
  });
  
  afterAll(async () => {
    await testEnv.stop();
  });
  
  test('deploy and interact', async () => {
    await client.deployContract('./test-contract.pact');
    const result = await client.execution('(test-contract.get-value)')
      .dirtyRead();
    expect(result).toBeDefined();
  });
});
```

## Best Practices

### 1. Configuration Management

```typescript
// Use environment-specific configs
const getClient = () => {
  const env = process.env.NODE_ENV || 'development';
  const config = {
    development: {
      network: { type: 'pact-server', /* ... */ }
    },
    test: {
      network: { type: 'chainweb-devnet', /* ... */ }
    },
    production: {
      network: { type: 'chainweb', /* ... */ }
    }
  };
  
  return new PactToolboxClient(config[env]);
};
```

### 2. Transaction Reliability

```typescript
// Implement retry logic
async function reliableTransaction(client, code, options = {}) {
  const maxRetries = options.retries || 3;
  const delay = options.delay || 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.execution(code)
        .submitAndListen();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}
```

### 3. Resource Management

```typescript
// Clean up resources
class ManagedClient {
  constructor(config) {
    this.client = new PactToolboxClient(config);
    this.pendingRequests = new Set();
  }
  
  async execute(code) {
    const requestKey = await this.client.execution(code).submit();
    this.pendingRequests.add(requestKey);
    
    try {
      const result = await this.client.pollRequest(requestKey);
      this.pendingRequests.delete(requestKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(requestKey);
      throw error;
    }
  }
  
  async cleanup() {
    // Cancel pending requests
    for (const requestKey of this.pendingRequests) {
      // Implement cancellation logic
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **"Network connection failed"**
   - Verify network URL and port
   - Check if local network is running
   - Ensure firewall allows connections

2. **"Module not found"**
   - Verify contract is deployed
   - Check namespace is correct
   - Ensure chain ID matches deployment

3. **"Signature verification failed"**
   - Check signer configuration
   - Verify public/private key pair
   - Ensure capabilities match signers

4. **"Gas limit exceeded"**
   - Increase gas limit in meta
   - Optimize contract code
   - Use preflight to estimate gas

### Debug Mode

```typescript
// Enable debug logging
const client = new PactToolboxClient({
  debug: true,
  network: { /* ... */ }
});

// Log all transactions
client.on('transaction', (tx) => {
  console.log('Transaction:', tx);
});

// Log all responses
client.on('response', (res) => {
  console.log('Response:', res);
});
```