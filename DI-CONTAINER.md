# Dependency Injection Container

The pact-toolbox uses a lightweight dependency injection (DI) container to manage global state and services across packages. This provides a clean, testable architecture while avoiding circular dependencies.

## Quick Start

### Basic Setup

```typescript
import { register, TOKENS } from '@pact-toolbox/utils';
import { setupWalletDI } from '@pact-toolbox/wallet-adapters';
import { GlobalNetworkConfigProvider } from '@pact-toolbox/network-config';

// 1. Setup network configuration
const networkProvider = new GlobalNetworkConfigProvider({
  currentNetworkId: 'mainnet01',
  networks: {
    default: 'mainnet01',
    configs: {
      mainnet01: { 
        networkId: 'mainnet01',
        chainId: '0',
        rpcUrl: 'https://api.chainweb.com',
        networkHost: 'https://api.chainweb.com'
      },
      testnet04: { 
        networkId: 'testnet04',
        chainId: '0',
        rpcUrl: 'https://api.testnet.chainweb.com',
        networkHost: 'https://api.testnet.chainweb.com'
      }
    }
  }
});
register(TOKENS.NetworkProvider, networkProvider);

// 2. Setup wallet system
await setupWalletDI({
  wallets: {
    chainweaver: true,
    walletconnect: { projectId: 'your-project-id' },
    ecko: true,
    zelcore: true
  }
});

// 3. Setup transaction defaults (optional)
register(TOKENS.TransactionDefaults, {
  gasLimit: 150000,
  gasPrice: 0.00001,
  ttl: 7200
});
```

### Using Services

Once configured, services are automatically available to all packages:

```typescript
import { execution } from '@pact-toolbox/transaction';

// Transaction builder automatically uses registered network provider
const tx = await execution('(coin.get-balance "alice")')
  .withChainId("1")
  .withSigner("alice-public-key")
  .sign()  // Automatically uses registered wallet system
  .submitAndListen();
```

## Available Tokens

The following tokens are available for registration:

| Token | Interface | Description |
|-------|-----------|-------------|
| `TOKENS.NetworkProvider` | `INetworkProvider` | Provides network configuration |
| `TOKENS.WalletSystem` | `IWalletSystem` | Manages wallet connections |
| `TOKENS.WalletProvider` | `IWalletProvider` | Factory for creating wallets |
| `TOKENS.TransactionDefaults` | `ITransactionDefaults` | Default transaction parameters |
| `TOKENS.ChainwebClient` | `IChainwebClient` | Chainweb API client |
| `TOKENS.Store` | `IStore` | Key-value storage |
| `TOKENS.Logger` | `ILogger` | Logging service |

## Manual Registration

For custom implementations, you can register services manually:

```typescript
import { register, TOKENS } from '@pact-toolbox/utils';

// Register a custom logger
register(TOKENS.Logger, {
  log: (level, message, ...args) => {
    console.log(`[${level}] ${message}`, ...args);
  },
  error: (message, ...args) => console.error(message, ...args),
  warn: (message, ...args) => console.warn(message, ...args),
  info: (message, ...args) => console.info(message, ...args),
  debug: (message, ...args) => console.debug(message, ...args)
});

// Register with options
register(TOKENS.NetworkProvider, myProvider, {
  singleton: true,  // Share single instance (default)
  eager: false,     // Lazy initialization (default)
  override: true    // Replace existing registration
});
```

## Testing

The DI container makes testing easy by allowing you to mock services:

```typescript
import { register, TOKENS, globalContainer } from '@pact-toolbox/utils';

beforeEach(() => {
  // Clear all instances for clean tests
  globalContainer.clearInstances();
  
  // Register test doubles
  register(TOKENS.NetworkProvider, {
    getCurrentNetwork: () => ({
      networkId: 'test',
      chainId: '0',
      rpcUrl: 'http://localhost:8080',
      networkHost: 'http://localhost:8080'
    })
  });
  
  register(TOKENS.WalletProvider, async () => ({
    isInstalled: () => true,
    connect: async () => ({ address: 'test-address', publicKey: 'test-key' }),
    sign: async (tx) => ({ ...tx, sigs: [{ sig: 'test-sig' }] })
  }));
});
```

## Service Providers

### Creating a Service Provider

```typescript
import { createProvider, TOKENS } from '@pact-toolbox/utils';

// Simple provider
const myServiceProvider = () => {
  return {
    doSomething: () => console.log('Hello!')
  };
};

// Provider with dependencies
const myComplexProvider = createProvider(
  [TOKENS.NetworkProvider, TOKENS.Logger],
  (networkProvider, logger) => {
    return {
      fetchData: async () => {
        const network = networkProvider.getCurrentNetwork();
        logger.info(`Fetching from ${network.rpcUrl}`);
        // ... implementation
      }
    };
  }
);
```

### Async Providers

```typescript
import { createAsyncProvider, TOKENS } from '@pact-toolbox/utils';

const myAsyncProvider = createAsyncProvider(
  [TOKENS.NetworkProvider],
  async (networkProvider) => {
    const network = networkProvider.getCurrentNetwork();
    const config = await fetch(`${network.rpcUrl}/config`);
    return new MyService(await config.json());
  }
);
```

## Migration from Global State

The DI container replaces various global state patterns. See [MIGRATION-DI.md](./MIGRATION-DI.md) for detailed migration instructions.

### Before (Global State)
```typescript
import { setSignerProvider } from '@pact-toolbox/transaction';

setSignerProvider(async () => myWallet);
```

### After (DI Container)
```typescript
import { setupWalletDI } from '@pact-toolbox/wallet-adapters';

await setupWalletDI({ wallets: { chainweaver: true } });
```

## Default Behavior

Some packages provide sensible defaults when no services are registered:

- **Transaction Builder**: Uses a default development network (http://localhost:8080) with a warning
- **Wallet System**: Falls back to browser environment detection

This allows quick prototyping without setup, but always configure services for production use.

## Best Practices

1. **Initialize Early**: Set up the DI container at your application's entry point
2. **Use Type-Safe Tokens**: Always use the provided `TOKENS` object
3. **Avoid Direct Container Access**: Use the convenience functions (`register`, `resolve`)
4. **Test with Clean State**: Clear instances between tests
5. **Document Dependencies**: Make service dependencies explicit

## Troubleshooting

### "Service not registered" Error

Ensure you've registered the service before using it:

```typescript
// ❌ Wrong - using before registration
const provider = resolve(TOKENS.NetworkProvider); // Error!

// ✅ Correct - register first
register(TOKENS.NetworkProvider, myProvider);
const provider = resolve(TOKENS.NetworkProvider); // Works!
```

### Circular Dependencies

The container detects circular dependencies and throws an error. Refactor your services to break the cycle.

### Type Errors

Ensure your implementations match the expected interfaces:

```typescript
// Check interface in @pact-toolbox/types/interfaces
import type { INetworkProvider } from '@pact-toolbox/types';

const myProvider: INetworkProvider = {
  getCurrentNetwork: () => { /* ... */ },
  // ... other required methods
};
```