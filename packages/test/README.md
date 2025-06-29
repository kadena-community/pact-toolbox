# @pact-toolbox/test

> Comprehensive testing framework for Pact smart contracts

## Overview

The `@pact-toolbox/test` package provides a complete testing solution for Pact smart contracts, combining traditional REPL-based testing with modern JavaScript testing capabilities. It offers isolated test environments, concurrent test execution, and seamless integration with the pact-toolbox ecosystem.

## Installation

```bash
npm install --save-dev @pact-toolbox/test vitest
# or
pnpm add -D @pact-toolbox/test vitest
```

## Features

- **REPL Test Runner** - Execute traditional Pact REPL tests (.repl files)
- **Test Environment** - Create isolated devnet/pact-server environments for integration tests
- **Automatic Wallet Injection** - Test mode automatically uses keypair wallet for signing
- **Network Isolation** - Each test gets its own network instance with unique ports
- **Clean Output** - Formatted test results with clear pass/fail status
- **Vitest Integration** - Combine Pact and JavaScript tests seamlessly

## Quick Start

### REPL Tests

Create a `.repl` test file:

```pact
;; tests/coin.repl
(load "prelude/init.repl")

(begin-tx "Create account test")
  (coin.create-account "alice" (read-keyset "alice-ks"))
  (expect "Account created"
    (coin.details "alice")
    { "balance": 0.0, "guard": (read-keyset "alice-ks") })
(commit-tx)

(begin-tx "Transfer test")
  (coin.transfer "sender00" "alice" 100.0)
  (expect "Balance updated"
    (coin.get-balance "alice")
    100.0)
(commit-tx)
```

Run tests programmatically:

```typescript
import { runReplTests } from "@pact-toolbox/test";

// Run all .repl files in contracts directory
await runReplTests();

// Run with custom config
await runReplTests({
  contractsDir: "./pact",
  networks: {
    testnet: {
      networkId: "testnet",
      rpcUrl: "http://localhost:8080",
      type: "pact-server",
      chainId: "0",
    },
  },
  defaultNetwork: "testnet",
});
```

### Integration Tests

Create isolated test environments:

```typescript
import { describe, test, beforeAll, afterAll } from "vitest";
import { createPactTestEnv } from "@pact-toolbox/test";
import { CoinService } from "@pact-toolbox/kda";

describe("Contract Integration", () => {
  let testEnv;
  let coinService;

  beforeAll(async () => {
    testEnv = await createPactTestEnv({
      privateKey: "your-test-private-key", // Optional
      accountName: "test-account", // Optional
    });
    await testEnv.start();

    // Initialize services with test environment
    coinService = new CoinService({
      context: testEnv.client.getContext(),
      defaultChainId: "0",
      wallet: testEnv.wallet,
    });
  });

  afterAll(async () => {
    await testEnv.stop();
  });

  test("transfer coins between accounts", async () => {
    // Check sender00 balance (pre-funded account)
    const balance = await coinService.getBalance("sender00");
    expect(parseFloat(balance)).toBeGreaterThan(0);

    // Transfer coins
    const result = await coinService.transfer({
      from: "sender00",
      to: "k:test-public-key",
      amount: "10.0",
    });

    expect(result).toBe("Write succeeded");
  });
});
```

## API Reference

### `runReplTests(config?, options?)`

Executes all REPL test files in the contracts directory.

```typescript
import { runReplTests } from "@pact-toolbox/test";
import type { PactToolboxConfigObj } from "@pact-toolbox/config";

// Use default configuration
await runReplTests();

// Use custom configuration
const config: PactToolboxConfigObj = {
  contractsDir: "./pact",
  networks: {
    testnet: {
      networkId: "testnet",
      rpcUrl: "http://localhost:8080",
      type: "pact-server",
      chainId: "0",
    },
  },
  defaultNetwork: "testnet",
  scriptsDir: "./scripts",
  pactVersion: "4.0.0",
  preludes: [],
  downloadPreludes: true,
  deployPreludes: true,
};

await runReplTests(config);
```

**Behavior:**

- Searches for all `*.repl` files in the contracts directory
- Ignores files in `prelude/` directories by default
- Executes tests using the `pact` command with `-t` flag
- Runs tests with configurable concurrency (defaults to CPU count)
- Reports results with formatted output

### `createPactTestEnv(options?)`

Creates an isolated test environment with network and client.

```typescript
import { createPactTestEnv } from "@pact-toolbox/test";

interface CreatePactTestEnvOptions {
  /** Private key for test wallet (generates random if not provided) */
  privateKey?: string;

  /** Account name for test wallet */
  accountName?: string;

  /** Network type to use ("devnet" | "pact-server") */
  network?: string;

  /** Configuration overrides */
  configOverrides?: Partial<PactToolboxConfigObj>;
}

const testEnv = await createPactTestEnv({
  privateKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
  accountName: "sender00",
  network: "devnet", // or "pact-server"
  configOverrides: {
    defaultNetwork: "devnet",
    networks: {
      devnet: createDevNetNetworkConfig({
        containerConfig: {
          persistDb: false,
          onDemandMining: true,
        },
      }),
    },
  },
});

// Available properties and methods
testEnv.client; // PactToolboxClient instance
testEnv.config; // Resolved configuration
testEnv.network; // Network instance
testEnv.wallet; // Test wallet (KeypairWallet)
testEnv.start(); // Start the network
testEnv.stop(); // Stop the network
testEnv.restart(); // Restart the network
```

**Key Features:**

- **Automatic Port Management** - Finds free ports to avoid conflicts
- **Test Mode Flag** - Sets `globalThis.__PACT_TOOLBOX_TEST_MODE__ = true`
- **Wallet Injection** - Automatically configures wallet for test transactions
- **Network Isolation** - Each environment runs in isolated Docker containers
- **Clean Startup/Shutdown** - Proper resource management

### Utility Functions

```typescript
import { getConfigOverrides, updatePorts, injectNetworkConfig } from "@pact-toolbox/test";

// Get configuration overrides for testing
const overrides = getConfigOverrides({
  contractsDir: "./test-contracts",
});

// Update ports in configuration to avoid conflicts
await updatePorts(config);

// Inject network configuration into global scope
injectNetworkConfig(config);
```

## Test Environment Details

### Automatic Wallet Injection

When you create a test environment, the package automatically:

1. **Sets Test Mode Flag** - `globalThis.__PACT_TOOLBOX_TEST_MODE__ = true`
2. **Creates Keypair Wallet** - Uses provided private key or generates one
3. **Configures Transaction Builder** - Automatically uses test wallet for signing
4. **Injects Network Config** - Makes network accessible to services

This means your services will automatically use the test wallet without manual configuration:

```typescript
const testEnv = await createPactTestEnv();
await testEnv.start();

// Services automatically use the test wallet
const coinService = new CoinService({
  context: testEnv.client.getContext(),
  defaultChainId: "0",
  // wallet: testEnv.wallet <- Optional, injected automatically in test mode
});

// Transactions are automatically signed with test wallet
await coinService.transfer({
  from: "sender00",
  to: "k:target-account",
  amount: "10.0",
});
```

### Network Configurations

#### DevNet (Recommended for most tests)

```typescript
import { createDevNetNetworkConfig } from "@pact-toolbox/config";

const testEnv = await createPactTestEnv({
  network: "devnet",
  configOverrides: {
    networks: {
      devnet: createDevNetNetworkConfig({
        containerConfig: {
          persistDb: false, // Clean state for each test
          onDemandMining: true, // Mine blocks on demand
        },
      }),
    },
  },
});
```

#### Pact Server (For simpler scenarios)

```typescript
import { createPactServerNetworkConfig } from "@pact-toolbox/config";

const testEnv = await createPactTestEnv({
  network: "pact-server",
  configOverrides: {
    networks: {
      testnet: createPactServerNetworkConfig({
        containerConfig: {
          persistDb: false,
          onDemandMining: true,
        },
      }),
    },
  },
});
```

## Integration with Services

The test package integrates seamlessly with pact-toolbox services:

```typescript
import { createPactTestEnv } from "@pact-toolbox/test";
import { CoinService, MarmaladeService } from "@pact-toolbox/kda";

describe("Service Integration Tests", () => {
  let testEnv;
  let coinService;
  let marmaladeService;

  beforeAll(async () => {
    testEnv = await createPactTestEnv({
      privateKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
      accountName: "sender00",
    });
    await testEnv.start();

    const context = testEnv.client.getContext();
    const wallet = testEnv.wallet;

    coinService = new CoinService({ context, defaultChainId: "0", wallet });
    marmaladeService = new MarmaladeService({ context, defaultChainId: "0", wallet });
  });

  afterAll(async () => {
    await testEnv.stop();
  });

  test("coin operations work", async () => {
    const balance = await coinService.getBalance("sender00");
    expect(parseFloat(balance)).toBeGreaterThan(0);
  });

  test("marmalade operations work", async () => {
    // Note: MarmaladeService requires marmalade-v2 to be deployed
    try {
      await marmaladeService.createToken({
        id: "test-token",
        precision: 0,
        uri: "https://example.com/token.json",
        policies: [],
      });
    } catch (error) {
      // Expected if marmalade-v2 is not deployed on devnet
      expect(error.message).toContain("marmalade-v2");
    }
  });
});
```

## Best Practices

### 1. Test Organization

```
contracts/
├── coin.pact
├── exchange.pact
├── tests/
│   ├── coin.repl
│   ├── exchange.repl
│   └── integration.test.ts
└── prelude/
    └── init.repl
```

### 2. Environment Management

```typescript
// Always clean up test environments
describe("My Tests", () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await createPactTestEnv();
    await testEnv.start();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.stop();
    }
  });

  // Your tests here...
});
```

### 3. Account Management

```typescript
// Use consistent test accounts
const testEnv = await createPactTestEnv({
  privateKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
  accountName: "sender00", // This account is pre-funded on devnet
});

// Create additional test accounts
const aliceAccount = "k:368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca";
const aliceKeyset = {
  keys: ["368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"],
  pred: "keys-all",
};
```

### 4. Error Handling

```typescript
test("should handle expected errors gracefully", async () => {
  try {
    await coinService.transfer({
      from: "sender00",
      to: "non-existent-account",
      amount: "999999999.0", // More than available
    });

    // Should not reach here
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toMatch(/insufficient|funds|balance/i);
  }
});
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - The package automatically finds free ports
   - If issues persist, check for Docker container conflicts

2. **Docker Issues**
   - Ensure Docker is running
   - Check for permission issues with Docker volumes
   - Clean up old containers: `docker system prune -f`

3. **Network Startup Failures**
   - Check Docker logs: `docker logs <container-name>`
   - Ensure sufficient disk space
   - Try restarting Docker

4. **Test Timeouts**
   - DevNet takes time to start (10-15 seconds)
   - Increase test timeouts if needed
   - Use smaller test datasets

### Debug Options

```typescript
// Enable debug logging
const testEnv = await createPactTestEnv({
  configOverrides: {
    networks: {
      devnet: createDevNetNetworkConfig({
        containerConfig: {
          logLevel: "debug",
        },
      }),
    },
  },
});
```

## Examples

Check the integration tests in this package for complete examples:

- `src/coin-service.integration.test.ts` - Coin operations testing
- `src/marmalade-service.integration.test.ts` - NFT operations testing
- `examples/` - Sample REPL test files

These examples demonstrate:

- Test environment setup and teardown
- Service integration patterns
- Error handling strategies
- Concurrent testing approaches

## Contributing

When contributing to this package:

1. **Write Tests** - All new functionality must have unit tests
2. **Update Documentation** - Keep README and code comments current
3. **Follow Patterns** - Use existing patterns for consistency
4. **Test Integration** - Verify compatibility with other pact-toolbox packages

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
