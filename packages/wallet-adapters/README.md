# @pact-toolbox/wallet-adapters

Multi-provider wallet adapter system for Kadena blockchain with a unified API, supporting browser extensions, WalletConnect, Magic Link, and built-in development wallets.

## Features

### 🔗 **Universal Wallet Support**

- **Keypair Wallet**: Built-in wallet using local keypairs for development/testing
- **Ecko Wallet**: Browser extension integration
- **Chainweaver**: Official Kadena desktop wallet
- **Zelcore**: Multi-cryptocurrency wallet
- **WalletConnect**: Connect mobile wallets via QR code
- **Magic**: Email-based authentication
- **Extensible**: Easy to add new wallet providers

### ⚡ **Unified Wallet Interface**

- Consistent API across all wallet providers
- Automatic wallet detection and availability checking
- Built-in error handling with typed errors
- Event-driven architecture for state updates

### 🧪 **Testing & Development**

- Deterministic wallets from seed phrases
- Static keypair signers for tests
- Automatic fallback to test wallet
- Mock wallet providers

### 🔧 **Advanced Features**

- Connection pooling and health checks
- Real-time wallet discovery
- Multi-account management
- Event-driven architecture
- TypeScript-first design

## Quick Start

### Basic Setup

```typescript
import { setupWallets, connectWallet } from "@pact-toolbox/wallet-adapters";
import { execution } from "@pact-toolbox/transaction";

// Setup wallets with auto-connect
const wallet = await setupWallets({
  autoConnect: true,
  wallets: ['keypair', 'ecko', 'chainweaver'],
  preferredWallets: ['ecko', 'chainweaver']
});

// Or manually connect
const wallet = await connectWallet('ecko');
console.log(`Connected to ${wallet.metadata.name}`);

// Execute a transaction (wallet UI appears automatically in browser)
const result = await execution('(+ 1 2)')
  .sign()
  .submitAndListen();
```

### Setup with WalletConnect and Magic

Some wallets require additional configuration:

```typescript
import { setupWallets } from "@pact-toolbox/wallet-adapters";

await setupWallets({
  wallets: ['keypair', 'walletconnect', 'magic'],
  walletConfigs: {
    // WalletConnect requires a project ID from https://cloud.walletconnect.com
    walletconnect: {
      projectId: 'your-walletconnect-project-id',
      metadata: {
        name: 'My Kadena App',
        description: 'My awesome Kadena DApp',
        url: 'https://myapp.com',
        icons: ['https://myapp.com/icon.png']
      }
    },
    // Magic requires an API key from https://magic.link
    magic: {
      magicApiKey: 'your-magic-publishable-key',
      networkId: 'mainnet01', // or 'testnet04'
      chainId: '0',
      createAccountsOnChain: true
    }
  },
  autoConnect: true,
  preferredWallets: ['magic', 'walletconnect']
});
```

### Transaction Signing

```typescript
import { getPrimaryWallet } from "@pact-toolbox/wallet-adapters";
import { execution } from "@pact-toolbox/transaction";

// Get connected wallet
const wallet = getPrimaryWallet();

// Build and sign transaction
const result = await execution('(+ 1 2)')
  .withChainId('0')
  .sign() // Automatically uses connected wallet
  .submitAndListen();

console.log("Transaction result:", result);
```

## Common Usage Patterns

### Local Queries (Read-only)

```typescript
import { execution } from "@pact-toolbox/transaction";

// Local queries don't require signing
const balance = await execution('(coin.get-balance "alice")')
  .local();

console.log("Alice's balance:", balance);
```

### Transactions with Capabilities

```typescript
import { execution } from "@pact-toolbox/transaction";

// Transfer with capability
const result = await execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner('alice-public-key', (signFor) => [
    signFor('coin.TRANSFER', 'alice', 'bob', 10.0)
  ])
  .sign() // Shows wallet UI
  .submitAndListen();
```

### Multi-step Pacts (Continuations)

```typescript
import { execution, continuation } from "@pact-toolbox/transaction";

// Step 1: Start a multi-step pact
const step1 = await execution('(my-pact.start-process)')
  .sign()
  .submitAndListen();

// Step 2: Continue the pact
const step2 = await continuation({
    pactId: step1.pactId,
    step: 1,
    rollback: false
  })
  .sign()
  .submitAndListen();
```

## Wallet Providers

### Keypair Wallet (Built-in)

Perfect for development, testing, and server-side applications:

```typescript
import { setupWallets } from "@pact-toolbox/wallet-adapters";

// Setup with keypair wallet
const wallet = await setupWallets({
  wallets: ['keypair'],
  autoConnect: true
});

// The keypair wallet uses keys from your pact-toolbox configuration
// or generates new ones if none are available
```

### Browser Extension Wallets

```typescript
import { connectWallet } from "@pact-toolbox/wallet-adapters";

// Connect to Ecko wallet
const wallet = await connectWallet('ecko');

// Get accounts
const accounts = await wallet.getAccounts();
console.log('Connected accounts:', accounts);

// Sign transaction (usually done through transaction builder)
const signedTx = await wallet.signTransaction({
  cmd: pactCommand,
  networkId: "mainnet01",
});
```

## Integration with Transaction Builder

The wallet adapters integrate seamlessly with `@pact-toolbox/transaction`:

```typescript
import { setupWallets } from "@pact-toolbox/wallet-adapters";
import { execution } from "@pact-toolbox/transaction";

// Setup wallets first
await setupWallets({
  wallets: ['keypair', 'ecko', 'chainweaver'],
  autoConnect: true,
  preferredWallets: ['ecko']
});

// Transaction builder will automatically use connected wallet
const result = await execution('(coin.transfer "alice" "bob" 1.0)')
  .withSigner('alice-public-key', (signFor) => [
    signFor('coin.TRANSFER', 'alice', 'bob', 1.0)
  ])
  .sign() // Automatically shows wallet UI
  .submitAndListen();

console.log('Transaction result:', result);
```

## Testing Setup

### Unit Tests

```typescript
import { setupWallets, getPrimaryWallet } from "@pact-toolbox/wallet-adapters";
import { createTestEnv } from "@pact-toolbox/test";

describe("My Contract Tests", () => {
  const { local, send } = createTestEnv();

  beforeAll(async () => {
    // Setup test wallet
    await setupWallets({
      wallets: ['keypair'],
      autoConnect: true
    });
  });

  test("should deploy contract", async () => {
    const result = await send(
      "(module my-contract GOVERNANCE (defcap GOVERNANCE () true))"
    );
    
    expect(result.status).toBe("success");
  });
});
```

### Integration Tests

```typescript
import { setupWallets, connectWallet, getPrimaryWallet } from "@pact-toolbox/wallet-adapters";

// Test with fallback wallets
async function testWithFallback() {
  try {
    // Try browser wallet first
    await connectWallet("ecko");
  } catch {
    // Fall back to keypair wallet
    await setupWallets({
      wallets: ['keypair'],
      autoConnect: true
    });
  }

  // Now use wallet for tests
  const wallet = getPrimaryWallet();
  // ... test logic
}
```

## Advanced Usage

### Multi-Wallet Management

```typescript
import { walletService, connectWallet } from "@pact-toolbox/wallet-adapters";

// Connect to multiple wallets
const eckoWallet = await connectWallet("ecko");
const chainweaverWallet = await connectWallet("chainweaver");

// Set primary wallet
walletService.setPrimaryWallet(eckoWallet);

// Get all connected wallets
const connectedWallets = walletService.getConnectedWallets();
console.log(`Connected wallets:`, connectedWallets.map(w => w.metadata.name));

// Disconnect specific wallet
await walletService.disconnect("chainweaver");
```

### Custom Wallet Provider

```typescript
import { WalletProvider, Wallet, BaseWallet } from "@pact-toolbox/wallet-core";
import { walletService } from "@pact-toolbox/wallet-adapters";

class MyCustomWalletProvider implements WalletProvider {
  readonly metadata = {
    id: "my-wallet",
    name: "My Custom Wallet",
    description: "Custom wallet implementation",
    icon: "data:image/svg+xml;base64,...",
    platforms: ["browser" as const],
    downloadUrl: "https://mywallet.com"
  };

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && !!window.myWallet;
  }

  async createWallet(): Promise<Wallet> {
    return new MyCustomWallet();
  }
}

// Register custom provider
walletService.register(new MyCustomWalletProvider());
```

### Working with Different Networks

```typescript
import { connectWallet } from "@pact-toolbox/wallet-adapters";
import { execution } from "@pact-toolbox/transaction";
import { createNetwork } from "@pact-toolbox/network";

// Connect wallet
const wallet = await connectWallet('ecko');

// Create network contexts
const mainnet = createNetwork({ networkId: 'mainnet01' });
const testnet = createNetwork({ networkId: 'testnet04' });

// Use different networks
const mainnetResult = await execution('(coin.details "alice")', mainnet)
  .withChainId('0')
  .local();

const testnetResult = await execution('(coin.details "alice")', testnet)
  .withChainId('0')
  .local();
```

## API Reference

### Core Interfaces

- **`Wallet`**: Main wallet interface for signing and connection (from `@pact-toolbox/wallet-core`)
- **`WalletProvider`**: Factory for creating wallet instances
- **`WalletService`**: Central service for wallet management
- **`WalletMetadata`**: Wallet information and capabilities

### Key Functions

- **`setupWallets()`**: Initialize and optionally auto-connect wallets
- **`connectWallet()`**: Connect to a specific wallet
- **`autoConnectWallet()`**: Auto-connect to the best available wallet
- **`getAvailableWallets()`**: List all available wallet providers
- **`getConnectedWallets()`**: Get all connected wallets
- **`getPrimaryWallet()`**: Get the primary wallet for signing
- **`disconnectWallet()`**: Disconnect a specific wallet
- **`clearWallets()`**: Disconnect all wallets

## Migration Guide

If you're migrating from an older version:

### Wallet Connection

```typescript
// Old way
import { WalletManager } from "old-wallet-package";
const manager = new WalletManager();
await manager.connect("ecko");

// New way
import { connectWallet } from "@pact-toolbox/wallet-adapters";
const wallet = await connectWallet("ecko");
```

### Transaction Signing

```typescript
// Old way
const signedTx = await wallet.signTransaction(pactCommand);
await submitTransaction(signedTx);

// New way (integrated with transaction builder)
import { execution } from "@pact-toolbox/transaction";
const result = await execution('(coin.transfer "alice" "bob" 1.0)')
  .withSigner('alice-public-key', (signFor) => [
    signFor('coin.TRANSFER', 'alice', 'bob', 1.0)
  ])
  .sign() // Automatically signs with connected wallet
  .submitAndListen();
```

## Key Benefits

- **Unified Interface**: Same API for all wallet types
- **Auto-detection**: Automatically detects available wallets
- **Type Safety**: Full TypeScript support with detailed types
- **Lazy Loading**: Wallet providers are loaded on-demand
- **Error Handling**: Consistent error types across all wallets
- **Framework Agnostic**: Works with any JavaScript framework

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
