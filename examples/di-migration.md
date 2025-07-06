# Migrating to DI Container

This guide shows how to migrate from the old global state patterns to the new DI container system in pact-toolbox.

## Overview

The DI container provides a centralized way to manage dependencies and global state across the pact-toolbox ecosystem. It replaces various global provider patterns with a unified, type-safe approach.

## Setup

### 1. Basic Application Setup

```typescript
import { register, TOKENS } from '@pact-toolbox/utils';
import { setupWalletDI } from '@pact-toolbox/wallet-adapters';
import { GlobalNetworkConfigProvider } from '@pact-toolbox/network-config';

// Initialize your application
async function initializeApp() {
  // 1. Setup network configuration
  const networkProvider = new GlobalNetworkConfigProvider({
    currentNetworkId: 'mainnet01',
    networks: {
      default: 'mainnet01',
      configs: {
        mainnet01: { /* your config */ },
        testnet04: { /* your config */ }
      }
    }
  });
  register(TOKENS.NetworkProvider, networkProvider);

  // 2. Setup wallet system
  await setupWalletDI({
    wallets: {
      chainweaver: true,
      walletconnect: { projectId: 'your-project-id' }
    }
  });

  // 3. Setup transaction defaults
  register(TOKENS.TransactionDefaults, {
    gasLimit: 150000,
    gasPrice: 0.00001,
    ttl: 7200
  });
}
```

## Migration Examples

### Network Configuration

**Before (Global Provider):**
```typescript
import { configureGlobalNetworkProvider, getGlobalNetworkProvider } from '@pact-toolbox/network-config';

// Setup
configureGlobalNetworkProvider({
  currentNetworkId: 'mainnet01'
});

// Usage
const provider = getGlobalNetworkProvider();
const config = provider.getCurrentNetwork();
```

**After (DI Container):**
```typescript
import { register, resolve, TOKENS } from '@pact-toolbox/utils';
import { GlobalNetworkConfigProvider } from '@pact-toolbox/network-config';

// Setup
register(TOKENS.NetworkProvider, new GlobalNetworkConfigProvider({
  currentNetworkId: 'mainnet01'
}));

// Usage
const provider = resolve(TOKENS.NetworkProvider);
const config = provider.get();
```

### Wallet/Signer Provider

**Before (Global Signer):**
```typescript
import { setSignerProvider } from '@pact-toolbox/transaction';
import { getWalletSystem } from '@pact-toolbox/wallet-adapters';

// Setup
setSignerProvider(async (options) => {
  const system = await getWalletSystem();
  return system.getPrimaryWallet();
});

// Usage in transaction
const tx = execution('(coin.get-balance "alice")')
  .sign(); // Uses global provider
```

**After (DI Container):**
```typescript
import { register, TOKENS } from '@pact-toolbox/utils';
import { setupWalletDI } from '@pact-toolbox/wallet-adapters';

// Setup (done once during app init)
await setupWalletDI();

// Usage in transaction (no changes needed!)
const tx = execution('(coin.get-balance "alice")')
  .sign(); // Automatically uses DI container
```

### Transaction Defaults

**Before (Global Defaults):**
```typescript
import { configureTransactionDefaults } from '@pact-toolbox/transaction';

// Setup
configureTransactionDefaults({
  networkProvider: myNetworkProvider
});
```

**After (DI Container):**
```typescript
import { register, TOKENS } from '@pact-toolbox/utils';

// Setup
register(TOKENS.TransactionDefaults, {
  networkProvider: myNetworkProvider,
  gasLimit: 150000
});
```

## Testing with DI Container

The DI container makes testing much easier by allowing you to create isolated scopes:

```typescript
import { globalContainer, register, TOKENS } from '@pact-toolbox/utils';

describe('MyComponent', () => {
  let scope;

  beforeEach(() => {
    // Create isolated scope for each test
    scope = globalContainer.createScope();

    // Register test doubles
    scope.register(TOKENS.NetworkProvider, mockNetworkProvider);
    scope.register(TOKENS.WalletProvider, async () => mockWallet);
  });

  it('should use mocked dependencies', () => {
    // Your test code uses the scoped container
    const provider = scope.resolve(TOKENS.NetworkProvider);
    expect(provider).toBe(mockNetworkProvider);
  });
});
```

## Advanced Patterns

### Custom Service Registration

```typescript
// Define your service token
const MyServiceToken = createToken<MyService>('MyService');

// Register with dependencies
register(MyServiceToken, createProvider(
  [TOKENS.NetworkProvider, TOKENS.Logger],
  (network, logger) => new MyService(network, logger)
));

// Use anywhere
const myService = resolve(MyServiceToken);
```

### Conditional Registration

```typescript
if (process.env.NODE_ENV === 'development') {
  register(TOKENS.Logger, () => new VerboseLogger());
} else {
  register(TOKENS.Logger, () => new ProductionLogger());
}
```

### Lazy Loading

```typescript
// Register async factory for code splitting
register(TOKENS.HeavyService, async () => {
  const { HeavyService } = await import('./heavy-service');
  return new HeavyService();
});

// Resolve async when needed
const service = await resolveAsync(TOKENS.HeavyService);
```

## Benefits

1. **Type Safety**: Full TypeScript support with inference
2. **Testability**: Easy to mock dependencies with scoped containers
3. **No Circular Dependencies**: Container manages dependency graph
4. **Lazy Loading**: Services created on-demand
5. **Single Source of Truth**: All dependencies in one place

## Backward Compatibility

All the old global provider functions still work but are marked as deprecated. They now use the DI container under the hood, so you can migrate gradually:

1. Start by setting up the DI container in your app initialization
2. New code uses `resolve()` instead of global getters
3. Gradually update old code as you touch it
4. Eventually remove all deprecated global functions

The migration can be done incrementally without breaking existing code!