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

- **REPL Test Runner** - Execute traditional Pact REPL tests
- **Test Environment** - Create isolated environments for integration tests
- **Concurrent Execution** - Run tests in parallel for faster feedback
- **Watch Mode** - Automatic test re-run on file changes
- **Vitest Integration** - Combine Pact and JavaScript tests
- **Network Isolation** - Each test gets its own network instance
- **Clean Output** - Formatted test results with clear pass/fail status

## Quick Start

### REPL Tests

Create a `.repl` test file:

```pact
;; tests/coin.repl
(load "../contracts/coin.pact")

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

Run tests:

```bash
# Run all tests
pact-toolbox test

# Run only REPL tests
pact-toolbox test --repl-only

# Watch mode
pact-toolbox test --watch
```

### Integration Tests

Create isolated test environments:

```typescript
import { describe, test, beforeEach, afterEach } from "vitest";
import { createPactTestEnv } from "@pact-toolbox/test";

describe("Contract Integration", () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await createPactTestEnv();
    await testEnv.start();
  });

  afterEach(async () => {
    await testEnv.stop();
  });

  test("deploy and interact with contract", async () => {
    const { client } = testEnv;

    // Deploy contract
    await client.deployContract("./contracts/my-contract.pact");

    // Execute transaction
    const result = await client.execute('(my-module.my-function "arg")');

    expect(result).toBe("expected-value");
  });
});
```

## API Reference

### `runReplTests(options)`

Executes all REPL test files in the contracts directory.

```typescript
interface RunReplTestsOptions {
  contractsDir?: string; // Directory containing contracts and tests
  concurrency?: number; // Number of parallel test workers
  filter?: string; // Filter test files by pattern
  verbose?: boolean; // Enable verbose output
  continueOnError?: boolean; // Continue running tests after failures
}

const results = await runReplTests({
  contractsDir: "./pact",
  concurrency: 4,
  filter: "coin*.repl",
});
```

### `createPactTestEnv(options)`

Creates an isolated test environment with network and client.

```typescript
interface CreatePactTestEnvOptions {
  config?: Partial<PactToolboxConfig>; // Custom configuration
  networkType?: "pact-server" | "devnet"; // Network type
  port?: number; // Custom port (0 for random)
}

const testEnv = await createPactTestEnv({
  networkType: "pact-server",
  config: {
    preludes: ["kadena/chainweb"],
  },
});

// Available properties
testEnv.client; // PactToolboxClient instance
testEnv.config; // Resolved configuration
testEnv.network; // Network instance
testEnv.start(); // Start network
testEnv.stop(); // Stop network
testEnv.restart(); // Restart network
```

## REPL Testing

### Test Structure

REPL tests follow a structured format:

```pact
;; 1. Load dependencies and setup
(load "prelude/init.repl")

;; 2. Environment setup
(env-data {
  'alice-ks: { "keys": ["alice-key"], "pred": "keys-all" },
  'bob-ks: { "keys": ["bob-key"], "pred": "keys-all" }
})

;; 3. Load module under test
(load "../contracts/my-module.pact")

;; 4. Test transactions
(begin-tx "Test case description")
  ;; Test setup
  (my-module.init)

  ;; Assertions
  (expect "description" actual expected)
  (expect-failure "should fail"
    (my-module.invalid-call)
    "Error message")
(commit-tx)

;; 5. More test cases...
```

### Common Test Patterns

#### Testing Module Deployment

```pact
(begin-tx "Deploy module")
  (load "../contracts/my-module.pact")
  (expect "Module deployed" true true)
(commit-tx)
```

#### Testing Capabilities

```pact
(begin-tx "Test capabilities")
  (test-capability (my-module.TRANSFER "alice" "bob" 10.0))
  (my-module.transfer "alice" "bob" 10.0)
  (expect "Transfer succeeded" true true)
(commit-tx)
```

#### Testing Guards

```pact
(begin-tx "Test keyset guard")
  (env-keys ["alice-key"])
  (my-module.guarded-function)
  (expect "Function executed" true true)
(rollback-tx)

(begin-tx "Test guard failure")
  (env-keys ["wrong-key"])
  (expect-failure "Guard check failed"
    (my-module.guarded-function)
    "Keyset failure")
(rollback-tx)
```

### Prelude Files

Organize common test setup in prelude files:

```pact
;; prelude/init.repl
;; Common test setup

;; Define test keysets
(env-data {
  'admin-ks: { "keys": ["admin-key"], "pred": "keys-all" },
  'test-ks: { "keys": ["test-key"], "pred": "keys-all" }
})

;; Set default environment
(env-chain-data {
  "block-height": 0,
  "block-time": (time "2024-01-01T00:00:00Z"),
  "chain-id": "0",
  "gas-limit": 100000,
  "gas-price": 0.00001,
  "sender": "sender00"
})

;; Load common modules
(load "../../preludes/coin-v5.pact")
```

## Integration Testing

### Test Helpers

```typescript
import { test } from "vitest";
import { createPactTestEnv } from "@pact-toolbox/test";
import { PactTransactionBuilder } from "@pact-toolbox/client";

test("complex transaction flow", async () => {
  const env = await createPactTestEnv();
  await env.start();

  try {
    const { client } = env;

    // Deploy contracts
    await client.deployContract("./contracts/token.pact");
    await client.deployContract("./contracts/exchange.pact");

    // Create accounts
    await PactTransactionBuilder.create()
      .code('(token.create-account "alice" (read-keyset "alice-ks"))')
      .addKeyset("alice-ks", {
        keys: ["alice-public-key"],
        pred: "keys-all",
      })
      .client(client)
      .execute();

    // Perform operations
    const result = await client.execute('(exchange.swap "token" "kda" 100.0 "alice")');

    expect(result.status).toBe("success");
  } finally {
    await env.stop();
  }
});
```

### Custom Test Configuration

```typescript
const testEnv = await createPactTestEnv({
  config: {
    // Custom network configuration
    network: {
      type: "devnet",
      devnet: {
        containerConfig: {
          onDemandMining: true,
          persistDb: false,
        },
      },
    },

    // Custom preludes
    preludes: ["kadena/chainweb", "test-helpers"],

    // Custom accounts
    accounts: {
      alice: {
        keys: { public: "alice-pub", secret: "alice-sec" },
        balance: 1000,
      },
    },
  },
});
```

## CLI Integration

The test command integrates with pact-toolbox CLI:

```bash
# Run all tests (REPL + Vitest)
pact-toolbox test

# Run only REPL tests
pact-toolbox test --repl-only

# Run only Vitest tests
pact-toolbox test --vitest-only

# Watch mode
pact-toolbox test --watch

# Filter tests
pact-toolbox test --filter "coin"

# Specify test directory
pact-toolbox test --contracts-dir ./my-contracts
```

## Best Practices

### 1. Test Organization

```
contracts/
--- coin.pact
--- exchange.pact
--- tests/
    --- coin.repl
    --- exchange.repl
    --- integration.test.ts
--- prelude/
    --- test-init.repl
```

### 2. Isolated Test Cases

```pact
;; Use separate transactions for isolation
(begin-tx "Test case 1")
  ;; Test logic
(rollback-tx)  ; or commit-tx

(begin-tx "Test case 2")
  ;; Different test logic
(rollback-tx)
```

### 3. Clear Test Descriptions

```pact
(expect "should calculate 10% fee correctly"
  (exchange.calculate-fee 100.0)
  10.0)

(expect-failure "should reject negative amounts"
  (exchange.swap -10.0)
  "Amount must be positive")
```

### 4. Environment Management

```typescript
// Always clean up test environments
const env = await createPactTestEnv();
try {
  await env.start();
  // Run tests
} finally {
  await env.stop();
}
```

## Troubleshooting

### Common Issues

1. **Port conflicts**

   ```typescript
   // Use random ports for tests
   const env = await createPactTestEnv({ port: 0 });
   ```

2. **Test discovery issues**

   ```bash
   # Verify test files are found
   pact-toolbox test --verbose
   ```

3. **Module loading errors**

   ```pact
   ;; Use relative paths from test file
   (load "../contracts/module.pact")
   ```

4. **Environment data conflicts**
   ```pact
   ;; Clear environment between tests
   (env-data {})
   (env-keys [])
   ```

### Debug Options

```typescript
// Enable debug logging
const env = await createPactTestEnv({
  config: {
    logLevel: "debug",
  },
});

// Get network logs
console.log(await env.network.getLogs());
```

## Examples

### Complete Test Suite

```typescript
// vitest.config.ts
import { defineConfig } from "vitest";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./test-setup.ts"],
  },
});

// test-setup.ts
import { beforeAll, afterAll } from "vitest";
import { createPactTestEnv } from "@pact-toolbox/test";

let globalEnv;

beforeAll(async () => {
  globalEnv = await createPactTestEnv();
  await globalEnv.start();
  global.pactClient = globalEnv.client;
});

afterAll(async () => {
  await globalEnv?.stop();
});
```

### Property-Based Testing

```pact
;; Use loops for property tests
(begin-tx "Property: transfer preserves total supply")
  (let ((amounts [1.0 10.0 100.0 1000.0]))
    (map (lambda (amount)
      (let ((before-alice (coin.get-balance "alice"))
            (before-bob (coin.get-balance "bob")))
        (coin.transfer "alice" "bob" amount)
        (expect (format "Total preserved for {}" [amount])
          (+ (coin.get-balance "alice") (coin.get-balance "bob"))
          (+ before-alice before-bob))))
      amounts))
(rollback-tx)
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "22"
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
```
