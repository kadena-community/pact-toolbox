# @pact-toolbox/dev-wallet

A comprehensive development wallet for Kadena blockchain applications with both programmatic API and browser UI support.

## Features

- 🔐 **Secure Key Management**: Generate and store keys securely with Web Crypto API
- 🌐 **Browser UI**: Built-in web component UI for easy integration
- 📱 **Cross-Platform**: Works in browsers and Node.js environments
- 🔄 **Transaction Management**: Sign and track transactions with full history
- ⚙️ **Configurable**: Extensive settings for networks, gas, and security
- 🔒 **Auto-Lock**: Automatic wallet locking for enhanced security
- 📤 **Import/Export**: Backup and restore wallet data
- 🧪 **Testing Support**: Comprehensive test utilities and mocks

## Installation

```bash
npm install @pact-toolbox/dev-wallet
# or
pnpm add @pact-toolbox/dev-wallet
# or
yarn add @pact-toolbox/dev-wallet
```

## Quick Start

### Basic Usage

```typescript
import { DevWallet } from '@pact-toolbox/dev-wallet';

// Create wallet instance
const wallet = new DevWallet({
  networkId: 'testnet04',
  networkName: 'Testnet',
  rpcUrl: 'https://api.testnet.chainweb.com',
  showUI: true, // Enable browser UI
});

// Connect wallet (creates/retrieves account)
const account = await wallet.connect();
console.log('Connected:', account.address);

// Sign a transaction
const signedTx = await wallet.signTransaction({
  cmd: JSON.stringify({
    payload: { exec: { code: '(coin.transfer "alice" "bob" 1.0)', data: {} } },
    signers: [{ pubKey: account.publicKey }],
    meta: { chainId: '0', sender: 'alice' },
    networkId: 'testnet04',
    nonce: Date.now().toString(),
  })
});
```

### Using the Browser UI

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@pact-toolbox/dev-wallet';
  </script>
</head>
<body>
  <!-- Wallet UI component -->
  <toolbox-wallet-container></toolbox-wallet-container>
</body>
</html>
```

## Architecture

The wallet is built with a clean architecture approach:

### Core Services

- **AccountService**: Manages account creation, import, and storage
- **SettingsService**: Handles wallet configuration and preferences
- **TransactionService**: Manages transaction signing and history
- **WalletStateManager**: Coordinates state across all services

### Components

- **ToolboxWalletContainer**: Main UI container component
- **WalletEventCoordinator**: Handles cross-component communication
- **ScreenRouter**: Manages navigation between wallet screens
- **AutoLockManager**: Implements auto-lock security feature

### Storage

- **DevWalletStorage**: Unified storage layer supporting both browser and Node.js
- Uses localStorage in browsers and in-memory storage in Node.js
- Automatic data persistence and encryption

## API Reference

### DevWallet Class

#### Constructor Options

```typescript
interface DevWalletConfig {
  networkId: string;          // Kadena network ID (e.g., 'testnet04', 'mainnet01')
  networkName: string;        // Display name for the network
  rpcUrl: string;             // RPC endpoint URL
  showUI?: boolean;           // Show browser UI (default: true)
  autoConnect?: boolean;      // Auto-connect on init (default: false)
  storage?: DevWalletStorage; // Custom storage implementation
}
```

#### Methods

##### connect()
Connects the wallet and returns the primary account.

```typescript
const account = await wallet.connect();
// Returns: { address: string, publicKey: string, name: string }
```

##### disconnect()
Disconnects the wallet and clears the session.

```typescript
await wallet.disconnect();
```

##### getAccount()
Gets the current connected account.

```typescript
const account = await wallet.getAccount();
```

##### getAccounts()
Gets all accounts in the wallet.

```typescript
const accounts = await wallet.getAccounts();
```

##### signTransaction(transaction)
Signs a Kadena transaction.

```typescript
const signedTx = await wallet.signTransaction({
  cmd: '...', // Stringified Kadena command
  hash: '...', // Optional: pre-computed hash
  sigs: []     // Existing signatures
});
```

##### signMessage(message)
Signs an arbitrary message.

```typescript
const signature = await wallet.signMessage('Hello, Kadena!');
```

### Using Services Directly

For advanced use cases, you can use the refactored services directly:

```typescript
import { 
  AccountService, 
  SettingsService, 
  TransactionService,
  WalletStateManager,
  DevWalletStorage 
} from '@pact-toolbox/dev-wallet';

// Initialize storage
const storage = new DevWalletStorage();

// Create services
const accountService = new AccountService(storage);
const settingsService = new SettingsService(storage);
const transactionService = new TransactionService(storage);

// Create state manager
const stateManager = new WalletStateManager(storage);
await stateManager.initialize();

// Use services
const account = await accountService.generateAccount('My Account');
await stateManager.addAccount(account);
```

## Testing

### Unit Tests

The package includes comprehensive unit tests using Vitest with jsdom:

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test -- --coverage
```

### E2E Tests

Playwright tests are included for browser integration testing:

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Start test server
pnpm dev:test
```

### Test Utilities

The package exports test utilities for use in your own tests:

```typescript
import { 
  setupBrowserMocks,
  createMockAccount,
  createMockTransaction,
  createMockSettings,
  waitFor 
} from '@pact-toolbox/dev-wallet/test-utils';

// Setup browser environment mocks
setupBrowserMocks();

// Create mock data
const account = createMockAccount({ name: 'Test Account' });
const transaction = createMockTransaction({ status: 'pending' });

// Async utilities
await waitFor(() => condition === true);
```

## Security Considerations

1. **Private Keys**: Never expose private keys. The wallet encrypts keys in storage.
2. **Auto-Lock**: Enable auto-lock in production environments.
3. **HTTPS**: Always use HTTPS in production to prevent man-in-the-middle attacks.
4. **Content Security Policy**: Configure CSP headers to prevent XSS attacks.

## Configuration

### Settings

The wallet supports extensive configuration through the settings service:

```typescript
interface Settings {
  theme: 'light' | 'dark';
  autoLockEnabled: boolean;
  autoLockTimeout: number;    // milliseconds
  defaultNetwork: string;
  defaultChain: string;
  gasLimit: number;
  gasPrice: number;
  ttl: number;
}
```

### Network Configuration

Configure multiple networks:

```typescript
const networks = [
  {
    id: 'testnet04',
    name: 'Testnet',
    host: 'https://api.testnet.chainweb.com',
    explorerUrl: 'https://explorer.testnet.chainweb.com'
  },
  {
    id: 'mainnet01',
    name: 'Mainnet',
    host: 'https://api.chainweb.com',
    explorerUrl: 'https://explorer.chainweb.com'
  }
];
```

## Error Handling

The wallet uses a comprehensive error handling system:

```typescript
import { WalletError, ErrorHandler } from '@pact-toolbox/dev-wallet';

try {
  await wallet.signTransaction(tx);
} catch (error) {
  if (error instanceof WalletError) {
    console.log('Error code:', error.code);
    console.log('Severity:', error.severity);
    console.log('Recoverable:', error.recoverable);
    
    // Handle specific error codes
    switch (error.code) {
      case 'ACCOUNT_NOT_FOUND':
        // Handle missing account
        break;
      case 'INVALID_TRANSACTION':
        // Handle invalid transaction
        break;
    }
  }
}
```

## Migration Guide

### From Original to Refactored Components

The refactored components provide better separation of concerns and error handling:

```typescript
// Original
import { DevWallet } from '@pact-toolbox/dev-wallet';
const wallet = new DevWallet(config);

// Refactored (direct service usage)
import { WalletStateManager } from '@pact-toolbox/dev-wallet';
const stateManager = new WalletStateManager(storage);
await stateManager.initialize();
```

### Breaking Changes

- The refactored services use different import paths
- Error handling now uses `WalletError` class
- State management is centralized through `WalletStateManager`

## Examples

### React Integration

```tsx
import { useEffect, useState } from 'react';
import { DevWallet } from '@pact-toolbox/dev-wallet';

function WalletButton() {
  const [wallet] = useState(() => new DevWallet({
    networkId: 'testnet04',
    networkName: 'Testnet',
    rpcUrl: 'https://api.testnet.chainweb.com',
  }));
  
  const [account, setAccount] = useState(null);
  
  const handleConnect = async () => {
    const acc = await wallet.connect();
    setAccount(acc);
  };
  
  return (
    <button onClick={handleConnect}>
      {account ? `Connected: ${account.address}` : 'Connect Wallet'}
    </button>
  );
}
```

### Vue Integration

```vue
<template>
  <div>
    <toolbox-wallet-container ref="wallet"></toolbox-wallet-container>
    <button @click="signTransaction">Sign Transaction</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { DevWallet } from '@pact-toolbox/dev-wallet';

const wallet = ref(null);

onMounted(() => {
  wallet.value = new DevWallet({
    networkId: 'testnet04',
    networkName: 'Testnet',
    rpcUrl: 'https://api.testnet.chainweb.com',
  });
});

const signTransaction = async () => {
  const signed = await wallet.value.signTransaction({
    // transaction details
  });
  console.log('Signed:', signed);
};
</script>
```

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/kadena-community/pact-toolbox.git
cd pact-toolbox/packages/dev-wallet

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build
```

## License

MIT
