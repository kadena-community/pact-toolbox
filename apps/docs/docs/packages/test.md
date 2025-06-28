---
title: "Testing Framework"
description: "Comprehensive testing framework for Pact smart contracts with REPL support, property-based testing, and integration test utilities."
---

# Testing Framework

The Testing Framework (`@pact-toolbox/test`) provides a modern, comprehensive testing solution for Pact smart contracts. It features REPL-based testing, property-based testing, and seamless integration with popular test runners.

## Features

- 🧪 **REPL Testing** - Native support for `.repl` test files
- 🔄 **Property-Based Testing** - Generate test cases automatically
- 🌐 **Network Isolation** - Each test runs in isolated environment
- 💉 **Automatic Mocking** - Built-in mocks for common operations
- 📊 **Coverage Reports** - Track contract test coverage
- ⚡ **Fast Execution** - Parallel test execution
- 🔍 **Detailed Debugging** - Step-through debugging support
- 🎯 **Snapshot Testing** - Capture and compare contract states

## Installation

```bash
# npm
npm install -D @pact-toolbox/test vitest

# pnpm
pnpm add -D @pact-toolbox/test vitest

# yarn
yarn add -D @pact-toolbox/test vitest
```

## Quick Start

### REPL Tests

Create a `.repl` test file:

```lisp
;; tests/todos.repl
(begin-tx)
(load "../contracts/todos.pact")
(commit-tx)

(begin-tx)
(use todos)

(expect "create todo succeeds"
  "Todo created"
  (create-todo { 
    "id": "todo-1", 
    "title": "Test todo", 
    "completed": false 
  }))

(expect "get todo returns created todo"
  { "id": "todo-1", "title": "Test todo", "completed": false }
  (get-todo "todo-1"))

(commit-tx)
```

Run the test:

```bash
pact-toolbox test
```

### Integration Tests

Create integration tests using Vitest:

```typescript
// tests/todos.test.ts
import { describe, it, expect } from 'vitest'
import { createPactTestEnv } from '@pact-toolbox/test'

describe('Todos Contract', () => {
  const env = createPactTestEnv()

  it('should create and retrieve todos', async () => {
    // Load contract
    await env.loadContract('contracts/todos.pact')

    // Execute transaction
    const result = await env.execute(`
      (todos.create-todo {
        "id": "test-1",
        "title": "Test Todo",
        "completed": false
      })
    `)

    expect(result.status).toBe('success')
    expect(result.data).toBe('Todo created')

    // Query state
    const todo = await env.query('(todos.get-todo "test-1")')
    expect(todo).toEqual({
      id: 'test-1',
      title: 'Test Todo',
      completed: false
    })
  })
})
```

## Testing Patterns

### Unit Testing

Test individual functions in isolation:

```typescript
describe('Math Module', () => {
  const env = createPactTestEnv()

  beforeAll(async () => {
    await env.loadContract('contracts/math.pact')
  })

  it('should add numbers correctly', async () => {
    const result = await env.query('(math.add 2 3)')
    expect(result).toBe(5)
  })

  it('should handle decimals', async () => {
    const result = await env.query('(math.add 1.5 2.5)')
    expect(result).toBe(4.0)
  })
})
```

### Integration Testing

Test complete workflows:

```typescript
describe('Token Transfer Flow', () => {
  const env = createPactTestEnv()

  beforeAll(async () => {
    await env.loadContract('contracts/fungible-v2.pact')
    await env.loadContract('contracts/coin.pact')
    
    // Setup test accounts
    await env.setupTestAccounts([
      { account: 'alice', balance: 1000.0 },
      { account: 'bob', balance: 0.0 }
    ])
  })

  it('should transfer tokens between accounts', async () => {
    // Perform transfer
    const transfer = await env.execute(`
      (coin.transfer "alice" "bob" 100.0)
    `, {
      sender: 'alice',
      caps: [['coin.TRANSFER', 'alice', 'bob', 100.0]]
    })

    expect(transfer.status).toBe('success')

    // Check balances
    const aliceBalance = await env.query('(coin.get-balance "alice")')
    const bobBalance = await env.query('(coin.get-balance "bob")')

    expect(aliceBalance).toBe(900.0)
    expect(bobBalance).toBe(100.0)
  })
})
```

### Property-Based Testing

Generate test cases automatically:

```typescript
import { property, generateAccount, generateAmount } from '@pact-toolbox/test'

describe('Token Properties', () => {
  const env = createPactTestEnv()

  property('transfer preserves total supply', {
    from: generateAccount(),
    to: generateAccount(),
    amount: generateAmount({ min: 0, max: 1000 })
  }, async ({ from, to, amount }) => {
    // Get initial supply
    const initialSupply = await env.query('(coin.total-supply)')

    // Perform transfer
    await env.execute(`
      (coin.transfer "${from}" "${to}" ${amount})
    `, {
      sender: from,
      caps: [['coin.TRANSFER', from, to, amount]]
    })

    // Check supply unchanged
    const finalSupply = await env.query('(coin.total-supply)')
    expect(finalSupply).toBe(initialSupply)
  })
})
```

## Test Environment API

### createPactTestEnv()

Creates an isolated test environment:

```typescript
const env = createPactTestEnv({
  // Optional configuration
  networkId: 'testnet',
  chainId: '0',
  gasLimit: 100000,
  gasPrice: 0.000001
})
```

### Environment Methods

#### loadContract(path)

Load a Pact contract:

```typescript
await env.loadContract('contracts/todos.pact')

// With initial data
await env.loadContract('contracts/todos.pact', {
  admin: 'test-admin-keyset'
})
```

#### execute(code, options?)

Execute a transaction:

```typescript
const result = await env.execute('(todos.create-todo ...)', {
  sender: 'alice',
  data: { extra: 'data' },
  caps: [['todos.CREATE']],
  signers: [{
    pubKey: 'alice-public-key',
    caps: [['todos.CREATE']]
  }]
})
```

#### query(code, options?)

Execute a read-only query:

```typescript
const balance = await env.query('(coin.get-balance "alice")')
```

#### setupTestAccounts(accounts)

Create test accounts with balances:

```typescript
await env.setupTestAccounts([
  { account: 'alice', balance: 1000.0, keys: ['alice-key'] },
  { account: 'bob', balance: 500.0, keys: ['bob-key'] }
])
```

#### expectFailure(code, message?)

Test that code fails with expected message:

```typescript
await env.expectFailure(
  '(coin.transfer "alice" "bob" 2000.0)',
  'Insufficient funds'
)
```

#### snapshot() / restore()

Save and restore contract state:

```typescript
// Save current state
const snapshot = await env.snapshot()

// Make changes
await env.execute('(todos.delete-all)')

// Restore previous state
await env.restore(snapshot)
```

## Advanced Features

### Custom Test Generators

Create custom generators for property-based testing:

```typescript
import { generator } from '@pact-toolbox/test'

const generateTodo = generator({
  id: generator.uuid(),
  title: generator.string({ minLength: 1, maxLength: 100 }),
  completed: generator.boolean(),
  priority: generator.oneOf(['low', 'medium', 'high']),
  dueDate: generator.date({ 
    min: new Date(), 
    max: new Date(2025, 0, 1) 
  })
})

property('todos have valid structure', {
  todo: generateTodo
}, async ({ todo }) => {
  const result = await env.execute(`
    (todos.create-todo ${JSON.stringify(todo)})
  `)
  expect(result.status).toBe('success')
})
```

### Test Fixtures

Share common test setup:

```typescript
// fixtures/token-fixture.ts
export async function setupTokenEnvironment() {
  const env = createPactTestEnv()
  
  await env.loadContract('contracts/fungible-v2.pact')
  await env.loadContract('contracts/coin.pact')
  
  await env.setupTestAccounts([
    { account: 'alice', balance: 1000.0 },
    { account: 'bob', balance: 500.0 },
    { account: 'charlie', balance: 100.0 }
  ])
  
  return env
}

// In tests
import { setupTokenEnvironment } from './fixtures/token-fixture'

describe('Token Tests', () => {
  let env: PactTestEnvironment
  
  beforeEach(async () => {
    env = await setupTokenEnvironment()
  })
  
  // Tests...
})
```

### Coverage Reports

Generate test coverage reports:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { pactCoverage } from '@pact-toolbox/test'

export default defineConfig({
  test: {
    coverage: {
      provider: 'custom',
      customProviders: {
        pact: pactCoverage()
      },
      include: ['**/*.pact'],
      reporter: ['text', 'html', 'json']
    }
  }
})
```

### Debugging Tests

Enable step-through debugging:

```typescript
const env = createPactTestEnv({
  debug: true, // Enable debug mode
  breakpoints: ['todos.pact:45'] // Set breakpoints
})

// Use debugger in tests
await env.debug(async (debugger) => {
  await debugger.stepInto('(todos.create-todo ...)')
  console.log('Current scope:', debugger.scope)
  
  await debugger.continue()
})
```

### Gas Analysis

Track gas usage in tests:

```typescript
describe('Gas Usage', () => {
  it('should track gas consumption', async () => {
    const result = await env.execute('(complex-operation)', {
      trackGas: true
    })
    
    expect(result.gas).toBeLessThan(10000)
    
    // Get detailed gas breakdown
    const gasAnalysis = result.gasAnalysis
    console.log('Gas by operation:', gasAnalysis.breakdown)
  })
})
```

## Configuration

### Test Configuration File

Create `pact-test.config.ts`:

```typescript
import { defineTestConfig } from '@pact-toolbox/test'

export default defineTestConfig({
  // Test file patterns
  include: ['**/*.repl', '**/*.test.ts'],
  
  // Environment defaults
  env: {
    networkId: 'testnet',
    chainId: '0',
    gasLimit: 100000,
    gasPrice: 0.000001
  },
  
  // Test data
  testData: {
    accounts: [
      { name: 'alice', keys: ['alice-key'] },
      { name: 'bob', keys: ['bob-key'] }
    ]
  },
  
  // Coverage options
  coverage: {
    enabled: true,
    include: ['contracts/**/*.pact'],
    exclude: ['contracts/**/*.repl'],
    threshold: {
      lines: 80,
      functions: 80,
      branches: 70
    }
  }
})
```

### Vitest Integration

Configure Vitest for Pact testing:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { pactPlugin } from '@pact-toolbox/test/vitest'

export default defineConfig({
  plugins: [pactPlugin()],
  test: {
    globals: true,
    environment: 'pact',
    setupFiles: ['./test/setup.ts']
  }
})
```

## CLI Commands

Run tests using the CLI:

```bash
# Run all tests
pact-toolbox test

# Run specific test file
pact-toolbox test todos.repl

# Run tests in watch mode
pact-toolbox test --watch

# Generate coverage report
pact-toolbox test --coverage

# Run tests with specific pattern
pact-toolbox test --pattern "**/*token*.repl"

# Debug mode
pact-toolbox test --debug
```

## Best Practices

### 1. Isolate Test Data

```typescript
describe('Contract Tests', () => {
  let env: PactTestEnvironment
  
  beforeEach(async () => {
    // Fresh environment for each test
    env = createPactTestEnv()
    await env.loadContract('contract.pact')
  })
  
  // Tests are isolated
})
```

### 2. Use Descriptive Test Names

```typescript
it('should prevent double-spending when transferring tokens', async () => {
  // Test implementation
})
```

### 3. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  it('handles maximum decimal precision', async () => {
    const result = await env.query('(round 1.123456789012345 12)')
    expect(result).toBe(1.123456789012)
  })
  
  it('handles empty strings', async () => {
    await env.expectFailure(
      '(todos.create-todo { "id": "", "title": "" })',
      'Invalid todo data'
    )
  })
})
```

### 4. Group Related Tests

```typescript
describe('Token Contract', () => {
  describe('Transfer Function', () => {
    it('transfers between accounts')
    it('validates sufficient balance')
    it('updates balances correctly')
  })
  
  describe('Admin Functions', () => {
    it('mints new tokens')
    it('burns tokens')
    it('pauses transfers')
  })
})
```

## Troubleshooting

### Common Issues

**Tests timing out**

```typescript
// Increase timeout for complex operations
it('complex operation', async () => {
  // Test code
}, { timeout: 30000 }) // 30 seconds
```

**Contract not found**

```typescript
// Use correct path relative to test file
await env.loadContract('../contracts/token.pact')

// Or use absolute path
await env.loadContract(path.join(__dirname, '../contracts/token.pact'))
```

**Capability errors**

```typescript
// Ensure capabilities match exactly
await env.execute('(coin.transfer "alice" "bob" 1.0)', {
  caps: [
    ['coin.TRANSFER', 'alice', 'bob', { decimal: '1.0' }] // Note decimal wrapper
  ]
})
```

## API Reference

### createPactTestEnv(options?)

Create test environment with options:
- `networkId`: Network identifier
- `chainId`: Chain ID
- `gasLimit`: Default gas limit
- `gasPrice`: Default gas price
- `debug`: Enable debug mode

### runReplTests(pattern, options?)

Run REPL test files:
- `pattern`: Glob pattern for test files
- `options`: Test runner options

### Generators

- `generator.string(options)`: Generate strings
- `generator.number(options)`: Generate numbers
- `generator.boolean()`: Generate booleans
- `generator.date(options)`: Generate dates
- `generator.uuid()`: Generate UUIDs
- `generator.oneOf(values)`: Pick from values
- `generator.array(generator, options)`: Generate arrays
- `generator.object(schema)`: Generate objects