# Migration Guide: From Global Context to Dependency Injection

This guide helps you migrate from the global context pattern to the new dependency injection (DI) pattern in pact-toolbox.

## Overview

The pact-toolbox codebase is transitioning from a global context pattern to dependency injection to:
- Improve testability and isolation
- Enable better modularity and composition
- Reduce tight coupling between components
- Support multiple configurations simultaneously

## Key Changes

### 1. Context → DI Services

The global `PactToolboxContext` is being replaced with specific service interfaces:

| Old (Context) | New (DI) | Purpose |
|---------------|----------|---------|
| `context.getNetwork()` | `INetworkProvider` | Network configuration |
| `context.getDefaultSigner()` | `ISignerResolver` | Signer resolution |
| `context.wallet` | `IWalletManager` | Wallet management |
| `context.eventBus` | `IEventBus` | Event system |

### 2. Service Tokens

New service tokens are available in `@pact-toolbox/types`:

```typescript
import { TOKENS } from "@pact-toolbox/types";

// Core tokens
TOKENS.NetworkProvider
TOKENS.SignerResolver
TOKENS.WalletManager
TOKENS.EventBus
TOKENS.ChainwebClient
```

### 3. KDA Services Migration

All KDA services now have DI versions alongside legacy versions for backward compatibility:

```typescript
// Old way (still works but deprecated)
import { CoinService } from "@pact-toolbox/kda";

const service = new CoinService({
  context: myContext,
  wallet: myWallet
});

// New way (recommended)
import { CoinServiceDI, createCoinService } from "@pact-toolbox/kda";

// Option 1: Use DI container
const service = createCoinService(); // Resolves from container

// Option 2: Explicit dependencies
const service = new CoinServiceDI({
  networkProvider: myNetworkProvider,
  signerResolver: mySignerResolver,
  defaultSigner: myWallet
});
```

## Migration Steps

### Step 1: Update Service Initialization

#### Before:
```typescript
import { CoinService } from "@pact-toolbox/kda";
import { getContext } from "./context";

const coinService = new CoinService({
  context: getContext(),
  wallet: myWallet
});
```

#### After:
```typescript
import { createCoinService } from "@pact-toolbox/kda";
import { setupDI } from "./setup";

// Setup DI container once at app startup
setupDI();

// Create services without context
const coinService = createCoinService({
  defaultSigner: myWallet
});
```

### Step 2: Setup DI Container

Create a setup function for your application:

```typescript
import { Container, TOKENS } from "@pact-toolbox/types";
import { 
  createWalletManager, 
  createSignerResolver,
  EventBus 
} from "@pact-toolbox/utils";

export function setupDI() {
  const container = Container.getInstance();
  
  // Register core services
  container.register(TOKENS.EventBus, new EventBus());
  
  const walletManager = createWalletManager();
  container.register(TOKENS.WalletManager, walletManager);
  
  const signerResolver = createSignerResolver(walletManager);
  container.register(TOKENS.SignerResolver, signerResolver);
  
  // Register network provider
  container.register(TOKENS.NetworkProvider, {
    getNetworkConfig: () => ({
      network: "testnet04",
      chainId: "0",
      networkApi: "https://api.testnet.chainweb.com"
    })
  });
}
```

### Step 3: Update Transaction Builder Usage

The transaction builder now supports DI:

```typescript
// Old way
import { execution } from "@pact-toolbox/transaction";

execution("(coin.details 'alice')")
  .withContext(context)
  .build();

// New way
execution("(coin.details 'alice')")
  .withNetwork(networkConfig) // or it resolves from DI
  .build();
```

### Step 4: Migrate Tests

Update your tests to use scoped containers:

```typescript
import { Container, TOKENS } from "@pact-toolbox/types";
import { createCoinService } from "@pact-toolbox/kda";

describe("CoinService", () => {
  let container: Container;
  
  beforeEach(() => {
    // Create isolated container for each test
    container = new Container();
    
    // Register test doubles
    container.register(TOKENS.NetworkProvider, {
      getNetworkConfig: () => testNetworkConfig
    });
  });
  
  it("should transfer coins", async () => {
    const service = createCoinService();
    // ... test logic
  });
});
```

## Backward Compatibility

### Using Adapters

If you need to use the new DI services with existing context code:

```typescript
import { createAdaptersFromContext } from "@pact-toolbox/kda";

const adapters = createAdaptersFromContext(myContext);

const coinService = new CoinServiceDI({
  networkProvider: adapters.networkProvider,
  signerResolver: adapters.signerResolver
});
```

### Gradual Migration

1. **Phase 1**: Update service initialization to use DI versions
2. **Phase 2**: Replace context usage in your code
3. **Phase 3**: Remove context imports and setup

## Common Patterns

### Pattern 1: Service Factory

```typescript
// services/factory.ts
export function createServices() {
  return {
    coin: createCoinService(),
    marmalade: createMarmaladeService(),
    namespace: createNamespaceService()
  };
}
```

### Pattern 2: Custom Providers

```typescript
class MyNetworkProvider implements INetworkProvider {
  constructor(private config: MyConfig) {}
  
  getNetworkConfig() {
    return {
      network: this.config.network,
      chainId: this.config.chainId,
      networkApi: this.config.apiUrl
    };
  }
}

// Register custom provider
container.register(TOKENS.NetworkProvider, new MyNetworkProvider(config));
```

### Pattern 3: Testing with Mocks

```typescript
const mockSignerResolver: ISignerResolver = {
  getDefaultSigner: () => mockSigner,
  getSignerKeys: () => ["mock-key"],
  createSigner: (keypairs) => mockSigner
};

container.register(TOKENS.SignerResolver, mockSignerResolver);
```

## Troubleshooting

### Error: "NetworkProvider not registered"

Make sure to setup DI before using services:

```typescript
import { setupDI } from "./setup";

// At app startup
setupDI();
```

### Error: "No signer available"

Ensure either:
1. A default signer is registered via `SignerResolver`
2. You pass a signer to the operation: `transfer({ signer: myWallet, ... })`

### Testing Issues

Use scoped containers in tests to avoid interference:

```typescript
beforeEach(() => {
  Container.clearInstance(); // Clear global container
  container = new Container(); // Create test container
});
```

## Benefits of Migration

1. **Better Testing**: Easily mock dependencies
2. **Modularity**: Services are loosely coupled
3. **Flexibility**: Support multiple configurations
4. **Type Safety**: Strong typing for all dependencies
5. **Performance**: No global state lookups

## Next Steps

1. Review the new service interfaces in `@pact-toolbox/types`
2. Start with migrating one service at a time
3. Update tests to use DI patterns
4. Remove context dependencies gradually

For questions or issues, please refer to the [GitHub issues](https://github.com/kadena/pact-toolbox/issues).