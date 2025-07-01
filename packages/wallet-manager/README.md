# @pact-toolbox/wallet-adapters

Unified wallet adapter system for Kadena blockchain wallets. Provides a simple, powerful API for connecting and managing multiple wallet providers.

## Features

- 🔌 **Multiple Wallet Support** - Ecko, Chainweaver, Zelcore, WalletConnect, Magic, and Keypair
- ⚛️ **React Integration** - First-class React hooks and context provider
- 🔄 **Auto-Reconnection** - Automatic reconnection with exponential backoff
- 💾 **Persistence** - Remember user's wallet choice across sessions
- 🎯 **Type-Safe** - Full TypeScript support with strict typing
- 📦 **Modular** - Tree-shakeable with separate entry points

## Installation

```bash
npm install @pact-toolbox/wallet-adapters
# or
pnpm add @pact-toolbox/wallet-adapters
# or
yarn add @pact-toolbox/wallet-adapters
```

## Quick Start

### Basic Usage (Vanilla TypeScript/JavaScript)

```typescript
import { WalletManager, getWallet } from '@pact-toolbox/wallet-adapters';

// Simple approach - just get a wallet
const wallet = await getWallet({ walletId: 'ecko' });
const account = await wallet.getAccount();
console.log('Connected to:', account.address);

// Sign a transaction
const signedTx = await wallet.sign(transaction);
```

### Advanced Usage with WalletManager

```typescript
import { WalletManager } from '@pact-toolbox/wallet-adapters';

// Get the singleton instance
const manager = WalletManager.getInstance({
  wallets: {
    ecko: true,
    chainweaver: true,
    zelcore: false, // Disabled
    walletconnect: {
      projectId: 'YOUR_PROJECT_ID',
      // ... other WalletConnect config
    },
  },
  autoReconnect: true, // Enable auto-reconnection (default: true)
});

// Initialize the manager
await manager.initialize();

// Connect to a specific wallet
const wallet = await manager.connect({ walletId: 'ecko' });

// Or let the manager auto-detect available wallets
const wallet = await manager.connect(); // Will try to auto-connect

// Get available wallets
const availableWallets = manager.getAvailableWallets();
console.log('Available wallets:', availableWallets);

// Sign transactions with primary wallet
const signed = await manager.sign(transaction);

// Disconnect
await manager.disconnect();
```

### React Integration

```tsx
import { WalletProvider, useWallet } from '@pact-toolbox/wallet-adapters/react';

// Wrap your app with WalletProvider
function App() {
  return (
    <WalletProvider 
      config={{
        wallets: {
          ecko: true,
          chainweaver: true,
        },
        autoReconnect: true,
      }}
    >
      <YourApp />
    </WalletProvider>
  );
}

// Use the wallet hook in your components
function WalletButton() {
  const { 
    wallet, 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect,
    sign,
    error 
  } = useWallet();

  if (isConnected && wallet) {
    return (
      <div>
        <p>Connected to: {wallet.id}</p>
        <button onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => connect({ walletId: 'ecko' })}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
```

## Configuration

### Wallet Configuration

```typescript
interface WalletConfig {
  // Configure which wallets are available
  wallets?: {
    ecko?: boolean | EckoConfig;
    chainweaver?: boolean | ChainweaverConfig;
    zelcore?: boolean | ZelcoreConfig;
    walletconnect?: boolean | WalletConnectConfig;
    magic?: boolean | MagicConfig;
    keypair?: boolean | KeypairConfig;
  };
  
  // Auto-reconnection settings
  autoReconnect?: boolean; // Default: true
  
  // User preferences
  preferences?: {
    autoConnect?: boolean; // Auto-connect on load
  };
}
```

### Example Configurations

#### Enable specific wallets
```typescript
const config = {
  wallets: {
    ecko: true,
    chainweaver: true,
    zelcore: false, // Explicitly disabled
  }
};
```

#### Configure WalletConnect
```typescript
const config = {
  wallets: {
    walletconnect: {
      projectId: 'YOUR_PROJECT_ID',
      metadata: {
        name: 'My App',
        description: 'My App Description',
        url: 'https://myapp.com',
        icons: ['https://myapp.com/icon.png'],
      },
    },
  },
};
```

#### Configure Magic (Email/Social login)
```typescript
const config = {
  wallets: {
    magic: {
      apiKey: 'YOUR_MAGIC_API_KEY',
      network: 'mainnet',
    },
  },
};
```

#### Configure Keypair (For testing)
```typescript
const config = {
  wallets: {
    keypair: {
      accountName: 'test-account',
      chains: ['0', '1'],
      // Optional: provide a private key for deterministic keypair
      privateKey: '0000000000000000000000000000000000000000000000000000000000000000',
    },
  },
};
```

## API Reference

### WalletManager

The main class for managing wallet connections.

#### Methods

- `getInstance(config?)` - Get the singleton instance
- `initialize()` - Initialize the manager
- `register(id, factory)` - Register a custom wallet provider
- `connect(options?)` - Connect to a wallet
- `disconnect(walletId?)` - Disconnect a wallet
- `sign(transaction)` - Sign a transaction with the primary wallet
- `getPrimaryWallet()` - Get the current primary wallet
- `setPrimaryWallet(wallet)` - Set the primary wallet
- `getProviders()` - Get all available providers
- `getConnectedWallets()` - Get all connected wallets
- `getAvailableWallets()` - Get metadata for available wallets

#### Events

The WalletManager extends EventEmitter and emits the following events:

- `connected` - When a wallet connects
- `disconnected` - When a wallet disconnects
- `primaryWalletChanged` - When the primary wallet changes
- `error` - When an error occurs

```typescript
manager.on('connected', (wallet) => {
  console.log('Wallet connected:', wallet);
});

manager.on('error', (error) => {
  console.error('Wallet error:', error);
});
```

### React Hooks

#### useWallet()

Main hook that provides wallet state and actions.

```typescript
const {
  wallet,           // Current connected wallet
  wallets,          // All connected wallets
  availableWallets, // Available wallet metadata
  isConnecting,     // Connection in progress
  isConnected,      // Connection status
  error,            // Last error
  connect,          // Connect function
  disconnect,       // Disconnect function
  sign,             // Sign transaction function
  selectWallet,     // Select primary wallet
} = useWallet();
```

#### usePrimaryWallet()

Get just the primary wallet.

```typescript
const wallet = usePrimaryWallet();
```

#### useWalletConnection()

Get connection status and actions.

```typescript
const { isConnected, isConnecting, connect, disconnect } = useWalletConnection();
```

#### useAvailableWallets()

Get list of available wallets.

```typescript
const availableWallets = useAvailableWallets();
```

#### useWalletSign()

Hook for transaction signing.

```typescript
const { sign, isReady, error } = useWalletSign();

if (isReady) {
  const signed = await sign(transaction);
}
```

## Helper Functions

### getWallet()

Quick helper to get a connected wallet.

```typescript
import { getWallet } from '@pact-toolbox/wallet-adapters';

// Connect to a specific wallet
const wallet = await getWallet({ walletId: 'ecko' });

// Auto-connect to the best available wallet
const wallet = await getWallet();
```

### getWalletManager()

Get an initialized wallet manager instance.

```typescript
import { getWalletManager } from '@pact-toolbox/wallet-adapters';

const manager = await getWalletManager({
  wallets: { ecko: true }
});
```

## Custom Wallet Providers

You can register custom wallet providers:

```typescript
import { WalletManager, BaseWalletProvider } from '@pact-toolbox/wallet-adapters';

class MyCustomWalletProvider extends BaseWalletProvider {
  metadata = {
    id: 'my-wallet',
    name: 'My Custom Wallet',
    type: 'browser-extension',
    description: 'My custom wallet provider',
  };

  async isAvailable() {
    return typeof window !== 'undefined' && Boolean(window.myWallet);
  }

  async createWallet() {
    // Return wallet instance
    return new MyCustomWallet();
  }
}

// Register the provider
const manager = WalletManager.getInstance();
manager.register('my-wallet', () => new MyCustomWalletProvider());
```

## Testing

For testing, use the built-in keypair wallet:

```typescript
// In test environment
const manager = WalletManager.getInstance({
  wallets: {
    keypair: {
      accountName: 'test-account',
      privateKey: '0000000000000000000000000000000000000000000000000000000000000000',
      deterministic: true, // Same keys every time
    },
  },
});

const wallet = await manager.connect({ walletId: 'keypair' });
```

## Persistence

The wallet manager automatically persists the user's wallet choice and will attempt to reconnect on page reload:

```typescript
import { getPersistedWallet, clearPersistedWallet } from '@pact-toolbox/wallet-adapters';

// Get persisted wallet info
const persisted = getPersistedWallet();
console.log('Last wallet:', persisted?.lastWalletId);

// Clear persistence
clearPersistedWallet();
```

## Error Handling

The package provides a `WalletError` class with specific error types:

```typescript
import { WalletError } from '@pact-toolbox/wallet-adapters';

try {
  await manager.connect();
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.type) {
      case 'NOT_FOUND':
        console.error('Wallet not found');
        break;
      case 'USER_REJECTED':
        console.error('User rejected connection');
        break;
      case 'CONNECTION_FAILED':
        console.error('Connection failed:', error.message);
        break;
      // ... handle other error types
    }
  }
}
```

## Best Practices

1. **Always initialize the manager before use**
   ```typescript
   await manager.initialize();
   ```

2. **Use React context for React apps**
   - Wrap your app with `WalletProvider`
   - Use hooks instead of direct manager access

3. **Handle errors gracefully**
   - Always wrap wallet operations in try-catch
   - Show user-friendly error messages

4. **Test with keypair wallet**
   - Use deterministic keypair for consistent testing
   - Mock wallet providers in unit tests

5. **Configure only needed wallets**
   - Disable wallets you don't need to reduce bundle size
   - Lazy-load wallet providers for better performance

## License

MIT