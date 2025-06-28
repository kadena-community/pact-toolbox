# @pact-toolbox/runtime

> Node.js runtime client for Pact smart contract development on Kadena blockchain

## Overview

The `@pact-toolbox/runtime` package provides a comprehensive Node.js client for interacting with Pact smart contracts on the Kadena blockchain. It offers high-level APIs for contract deployment, transaction execution, and blockchain interactions with support for multiple network types including local Pact servers, devnets, testnets, and mainnet.

## Installation

```bash
npm install @pact-toolbox/runtime
# or
pnpm add @pact-toolbox/runtime
```

## Features

- 📄 **Contract Deployment** - Deploy single or multiple contracts with ease
- 🔧 **Transaction Building** - Fluent API for building complex transactions
- 🌐 **Multi-Network Support** - Works with local, devnet, testnet, and mainnet
- 🔑 **Signer Integration** - Environment variable and wallet support
- 📁 **File System Integration** - Load contracts directly from files
- ⚡ **Performance Options** - Preflight, local execution, and dirty reads
- 📡 **Transaction Management** - Submit, listen, and poll for results
- 🛠️ **Developer Tools** - Module introspection and namespace management

## Quick Start

```typescript
import { PactToolboxClient } from "@pact-toolbox/runtime";

// Create client with configuration
const client = new PactToolboxClient({
  defaultNetwork: "devnet",
  contractsDir: "./contracts",
  networks: {
    devnet: {
      type: "chainweb-devnet",
      name: "local-devnet",
      networkId: "devnet",
      rpcUrl: "http://localhost:8080",
      senderAccount: "sender00",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});

// Deploy a contract
await client.deployContract("./contracts/my-module.pact");

// Execute a transaction
const result = await client
  .execution("(my-module.hello-world)")
  .addData({ name: "Alice" })
  .sign(client.getWallet())
  .submitAndListen();

console.log(result);
```

## Client Configuration

### Creating a Client

```typescript
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { resolveConfig } from "@pact-toolbox/config";

// Option 1: With inline configuration
const client1 = new PactToolboxClient({
  defaultNetwork: "local",
  networks: {
    local: {
      type: "pact-server",
      name: "local",
      networkId: "pact-server",
      rpcUrl: "http://localhost:9001",
      senderAccount: "sender00",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});

// Option 2: From resolved configuration
const config = await resolveConfig();
const client2 = new PactToolboxClient(config);

// Option 3: With custom directories
const client3 = new PactToolboxClient({
  contractsDir: "./pact",
  scriptsDir: "./pact/scripts",
  defaultNetwork: "devnet",
  networks: {
    /* ... */
  },
});
```

### Network Types

#### 1. Pact Server (Local Development)

```typescript
const client = new PactToolboxClient({
  defaultNetwork: "local",
  networks: {
    local: {
      type: "pact-server",
      name: "local",
      networkId: "pact-server",
      rpcUrl: "http://localhost:9001",
      senderAccount: "sender00",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});
```

#### 2. Chainweb DevNet

```typescript
const client = new PactToolboxClient({
  defaultNetwork: "devnet",
  networks: {
    devnet: {
      type: "chainweb-devnet",
      name: "devnet",
      networkId: "devnet",
      rpcUrl: "http://localhost:8080",
      senderAccount: "sender00",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});
```

#### 3. Chainweb (Testnet/Mainnet)

```typescript
const client = new PactToolboxClient({
  defaultNetwork: "testnet",
  networks: {
    testnet: {
      type: "chainweb",
      name: "testnet",
      networkId: "testnet04",
      rpcUrl: "https://api.testnet.chainweb.com",
      senderAccount: "sender00",
      keyPairs: [],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});
```

## Contract Deployment

### Deploy Single Contract

```typescript
// Deploy from file
await client.deployContract("./contracts/token.pact");

// Deploy with options
await client.deployContract(
  "./contracts/token.pact",
  {
    preflight: false, // Skip preflight
    listen: true, // Wait for confirmation
  },
  ["0", "1"],
); // Deploy to specific chains

// Deploy raw code
await client.deployCode("(module test GOVERNANCE ...)");
```

### Deploy Multiple Contracts

```typescript
// Deploy multiple files
await client.deployContracts(["./contracts/token.pact", "./contracts/exchange.pact", "./contracts/governance.pact"]);

// Deploy with dependencies in order
const contracts = [
  { path: "./base.pact", chainIds: ["0"] },
  { path: "./dependent.pact", chainIds: ["0"] },
];

for (const contract of contracts) {
  await client.deployContract(
    contract.path,
    {
      listen: true,
    },
    contract.chainIds,
  );
}
```

### Deployment Patterns

```typescript
// Check before deploying
const isDeployed = await client.isContractDeployed("my-module");
if (!isDeployed) {
  await client.deployContract("./my-module.pact");
}

// Deploy with custom wallet
const result = await client.deployContract("./token.pact", {
  wallet: {
    publicKey: "admin-public-key",
    secretKey: "admin-secret-key",
    account: "admin-account",
  },
  builder: {
    chainId: "0",
    senderAccount: "admin-account",
  },
});
```

## Transaction Building

### Basic Execution

```typescript
// Simple execution
const result = await client.execution('(coin.details "alice")').sign(client.getWallet()).submitAndListen();

// With data
const transfer = await client
  .execution('(coin.transfer "alice" "bob" amount)')
  .addData({ amount: 10.0 })
  .sign(client.getWallet())
  .submitAndListen();
```

### Advanced Transaction Building

```typescript
const result = await client
  .execution("(my-module.complex-operation)")
  // Add metadata
  .withMeta({
    chainId: "0",
    sender: "gas-payer",
    gasLimit: 10000,
    gasPrice: 0.00001,
    ttl: 600,
  })
  // Add signers
  .withSigner("alice-key", (signFor) => [signFor("my-module.TRANSFER", "alice", "bob", 10.0)])
  // Add keyset
  .withKeyset("admin-keyset", {
    keys: ["admin-key-1", "admin-key-2"],
    pred: "keys-all",
  })
  // Add data
  .withData("config", { timeout: 30 })
  .withData("metadata", { version: "1.0" })
  // Sign and execute
  .sign(client.getWallet())
  .submitAndListen();
```

### Transaction Execution Methods

```typescript
// Submit without waiting (returns request key)
const requestKey = await client.execution("(my-module.async-op)").sign(client.getWallet()).submit();

// Submit and listen for result
const result = await client.execution("(my-module.sync-op)").sign(client.getWallet()).submitAndListen();

// Local execution (validation only)
const localResult = await client.execution("(my-module.validate)").build().local();

// Dirty read (fast, no consensus)
const dirtyResult = await client.execution('(coin.get-balance "alice")').build().dirtyRead();
```

### Multi-Chain Transactions

```typescript
// Execute on specific chains
const result = await client.deployContract("my-module.pact", {}, ["0", "1", "2"]);

// Execute on all available chains
const allChains = client.getNetworkConfig().meta?.chainId ? [client.getNetworkConfig().meta.chainId] : ["0"];
const results = await client.deployContract("my-module.pact", {}, allChains);
```

## Contract Interaction

### Module Management

```typescript
// List all modules
const modules = await client.listModules();
console.log("Deployed modules:", modules);

// Describe module interface
const moduleInfo = await client.describeModule("coin");
console.log("Module interface:", moduleInfo);

// Check if module exists
const exists = await client.isContractDeployed("my-module");
console.log("Module deployed:", exists);
```

### Namespace Management

```typescript
// List namespaces
const namespaces = await client.execution("(list-namespaces)").build().dirtyRead();

// Describe namespace
const nsInfo = await client.describeNamespace("free");
console.log("Namespace info:", nsInfo);

// Check namespace existence
const nsDefined = await client.isNamespaceDefined("my-namespace");
```

### Reading Contract State

```typescript
// Read table data
const accounts = await client.execution("(map (read coin.coin-table) (keys coin.coin-table))").build().dirtyRead();

// Query specific data
const balance = await client.execution('(coin.get-balance "alice")').build().dirtyRead();

// Complex queries
const topHolders = await client
  .execution(
    `
  (let* ((accounts (keys coin.coin-table))
         (balances (map (read coin.coin-table) accounts)))
    (take 10 (sort (lambda (a b) (> (at 'balance a) (at 'balance b))) balances)))
`,
  )
  .build()
  .dirtyRead();
```

## Signer Management

### Environment Variable Signers

```typescript
// Set environment variables
process.env.PACT_TOOLBOX_PUBLIC_KEY = "your-public-key";
process.env.PACT_TOOLBOX_SECRET_KEY = "your-secret-key";

// Client automatically uses env signers
const client = new PactToolboxClient(config);

// Or for network-specific signers
process.env.DEVNET_PUBLIC_KEY = "devnet-public-key";
process.env.DEVNET_SECRET_KEY = "devnet-secret-key";

// Get signer keys
const signer = client.getSignerKeys();
```

### Custom Signers

```typescript
// Provide keypair in configuration
const client = new PactToolboxClient({
  defaultNetwork: "local",
  networks: {
    local: {
      type: "pact-server",
      name: "local",
      networkId: "pact-server",
      rpcUrl: "http://localhost:9001",
      senderAccount: "admin-account",
      keyPairs: [
        {
          publicKey: "public-key-hex",
          secretKey: "secret-key-hex",
          account: "admin-account",
        },
      ],
      keysets: {},
      meta: { chainId: "0" },
    },
  },
});

// Or use wallet parameter in execution
const result = await client.execution("(my-module.admin-op)").sign(client.getWallet()).submitAndListen();
```

## File Management

### Contract Loading

```typescript
// Get contract code
const code = await client.getContractCode("token.pact");
console.log("Contract code:", code);

// Load from custom directory
const customCode = await client.getContractCode("../shared/base.pact");

// Handle missing files
try {
  const code = await client.getContractCode("missing.pact");
} catch (error) {
  console.error("Contract not found:", error.message);
}
```

### Directory Configuration

```typescript
const client = new PactToolboxClient({
  contractsDir: "./pact/contracts",
  scriptsDir: "./pact/scripts",
  defaultNetwork: "local",
  networks: {
    /* ... */
  },
});

// Paths are resolved relative to configured directories
await client.deployContract("token.pact"); // Loads from ./pact/contracts/token.pact
```

## Advanced Features

### Preflight Simulation

```typescript
// Simulate transaction before submission
const simulation = await client
  .execution('(coin.transfer "alice" "bob" 100.0)')
  .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 100.0)])
  .build()
  .local();

if (simulation.result.status === "success") {
  // Safe to submit
  const result = await client
    .execution('(coin.transfer "alice" "bob" 100.0)')
    .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 100.0)])
    .sign(client.getWallet())
    .submitAndListen();
}
```

### Batch Operations

```typescript
// Deploy multiple contracts efficiently
async function deployAll() {
  const contracts = ["base.pact", "token.pact", "exchange.pact", "governance.pact"];

  const results = await Promise.all(
    contracts.map((contract) =>
      client.deployContract(contract, {
        preflight: false,
        listen: false,
      }),
    ),
  );

  // Results will contain request keys for tracking
  return results;
}
```

### Error Handling

```typescript
try {
  const result = await client.execution("(my-module.risky-op)").sign(client.getWallet()).submitAndListen();

  if (result.result.status === "failure") {
    console.error("Transaction failed:", result.result.error);
    // Handle business logic failure
  }
} catch (error) {
  // Handle network or validation errors
  if (error.code === "NETWORK_ERROR") {
    console.error("Network issue:", error.message);
  } else if (error.code === "VALIDATION_ERROR") {
    console.error("Invalid transaction:", error.message);
  }
}
```

## Testing

### Testing with Mock Dependencies

```typescript
import { describe, test, expect, vi } from "vitest";
import { PactToolboxClient } from "@pact-toolbox/runtime";

// Mock the transaction module
vi.mock("@pact-toolbox/transaction", () => ({
  createToolboxNetworkContext: vi.fn(() => mockContext),
  execution: vi.fn(() => mockBuilder),
}));

describe("My Contract Tests", () => {
  let client;

  beforeEach(() => {
    client = new PactToolboxClient(testConfig);
  });

  test("deploys contract", async () => {
    await client.deployContract("token.pact");
    // Assert on mock calls
  });
});
```

### Integration Testing

```typescript
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { createPactTestEnv } from "@pact-toolbox/test";

describe("Contract Integration", () => {
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

  test("deploy and interact", async () => {
    await client.deployContract("./test-contract.pact");
    const result = await client.execution("(test-contract.get-value)").build().dirtyRead();
    expect(result).toBeDefined();
  });
});
```

## Best Practices

### 1. Configuration Management

```typescript
// Use environment-specific configs
const getClient = () => {
  const env = process.env.NODE_ENV || "development";
  const configs = {
    development: {
      defaultNetwork: "local",
      networks: {
        /* local config */
      },
    },
    test: {
      defaultNetwork: "devnet",
      networks: {
        /* devnet config */
      },
    },
    production: {
      defaultNetwork: "mainnet",
      networks: {
        /* mainnet config */
      },
    },
  };

  return new PactToolboxClient(configs[env]);
};
```

### 2. Transaction Reliability

```typescript
async function reliableTransaction(client, code, options = {}) {
  const maxRetries = options.retries || 3;
  const delay = options.delay || 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.execution(code).sign(client.getWallet()).submitAndListen();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
}
```

### 3. Resource Management

```typescript
class ManagedClient {
  constructor(config) {
    this.client = new PactToolboxClient(config);
    this.pendingRequests = new Set();
  }

  async execute(code) {
    const tx = await this.client.execution(code).sign(this.client.getWallet()).getSignedTransaction();

    const requestKey = tx.hash;
    this.pendingRequests.add(requestKey);

    try {
      const result = await this.client.execution(code).sign(this.client.getWallet()).submitAndListen();
      this.pendingRequests.delete(requestKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(requestKey);
      throw error;
    }
  }

  async cleanup() {
    // Cancel pending requests if needed
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
// The runtime package uses @pact-toolbox/node-utils logger
// Set environment variable to enable debug logging
process.env.DEBUG = "pact-toolbox:*";

const client = new PactToolboxClient(config);

// Logs will appear for contract loading, deployments, etc.
```

## API Reference

### PactToolboxClient

The main client class with the following key methods:

- `constructor(config?, network?)` - Create a new client instance
- `execution(command)` - Create a transaction builder
- `deployContract(path, options?, chainId?)` - Deploy a contract file
- `deployContracts(paths, options?, chainId?)` - Deploy multiple contracts
- `deployCode(code, options?, chainId?)` - Deploy raw Pact code
- `getSignerKeys(signerLike?)` - Get signer keypair
- `getWallet(walletLike?)` - Get wallet instance
- `listModules()` - List deployed modules
- `describeModule(module)` - Get module interface
- `isContractDeployed(module)` - Check if module exists
- `getContractCode(path)` - Read contract from filesystem

### TransactionBuilderData

Configuration object for transaction builders:

- `senderAccount` - Account paying for gas
- `chainId` - Target chain ID
- `init` - Initialize contract (default: true)
- `namespace` - Contract namespace
- `keysets` - Keyset definitions
- `data` - Additional transaction data
- `upgrade` - Upgrade mode (default: false)

### DeployContractOptions

Options for contract deployment:

- `preflight` - Run preflight checks (default: true)
- `listen` - Wait for confirmation (default: true)
- `skipSign` - Skip transaction signing
- `wallet` - Wallet or signer configuration
- `builder` - Custom transaction builder config

## Contributing

See the main [pact-toolbox contributing guide](../../CONTRIBUTING.md).

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
