---
title: "Wallet System"
description: "Comprehensive wallet ecosystem for Kadena blockchain with multi-provider support, development wallet, and unified adapter interface."
---

# Wallet System

The Pact Toolbox wallet system provides a complete solution for wallet integration in Kadena applications. It includes wallet adapters for all major Kadena wallets, a built-in development wallet with UI, and core wallet functionality.

## Packages Overview

- **`@pact-toolbox/wallet-adapters`** - Unified interface for all Kadena wallets
- **`@pact-toolbox/wallet-core`** - Base wallet functionality and interfaces
- **`@pact-toolbox/wallet-ui`** - Wallet UI components
- **`@pact-toolbox/dev-wallet`** - Built-in development wallet with web UI

## Installation

```bash
# For wallet integration in your app
pnpm add @pact-toolbox/wallet-adapters

# For development wallet
pnpm add -D @pact-toolbox/dev-wallet

# For building custom wallets
pnpm add @pact-toolbox/wallet-core
```

## Quick Start

### Using Wallet Adapters

```typescript
import { 
  ChainweaverWallet,
  EckoWallet,
  ZelcoreWallet,
  WalletConnectWallet,
  MagicWallet
} from '@pact-toolbox/wallet-adapters';

// Create wallet instance
const ecko = new EckoWallet();

// Check availability
if (await ecko.isInstalled()) {
  // Connect to wallet
  await ecko.connect();
  
  // Get accounts
  const accounts = await ecko.getAccounts();
  console.log('Connected accounts:', accounts);
  
  // Sign transaction
  const signedTx = await ecko.signTransaction(transaction);
}
```

### Using Development Wallet

```typescript
import { DevWallet } from '@pact-toolbox/dev-wallet';

// Create development wallet
const devWallet = new DevWallet({
  networkId: 'development',
  port: 9467 // UI port
});

// Start wallet UI
await devWallet.start();

// The wallet UI is now available at http://localhost:9467
```

## Supported Wallets

### Chainweaver

Desktop wallet by Kadena:

```typescript
import { ChainweaverWallet } from '@pact-toolbox/wallet-adapters';

const chainweaver = new ChainweaverWallet();

// Check if installed (looks for local server)
if (await chainweaver.isInstalled()) {
  await chainweaver.connect();
  
  // Chainweaver-specific features
  const accounts = await chainweaver.getAccounts();
  const signedTx = await chainweaver.signTransaction(tx);
}
```

### Ecko Wallet

Popular browser extension wallet:

```typescript
import { EckoWallet } from '@pact-toolbox/wallet-adapters';

const ecko = new EckoWallet();

// Check if extension is installed
if (await ecko.isInstalled()) {
  // Request connection (prompts user)
  await ecko.connect();
  
  // Get connected account
  const account = await ecko.getAccount();
  console.log('Connected to:', account.account);
  
  // Sign and send transaction
  const result = await ecko.signAndSend(transaction);
}
```

### Zelcore

Multi-asset wallet with Kadena support:

```typescript
import { ZelcoreWallet } from '@pact-toolbox/wallet-adapters';

const zelcore = new ZelcoreWallet();

if (await zelcore.isInstalled()) {
  await zelcore.connect();
  
  // Zelcore returns multiple accounts
  const accounts = await zelcore.getAccounts();
  
  // Sign with specific account
  const signedTx = await zelcore.signTransaction(tx, {
    account: accounts[0]
  });
}
```

### WalletConnect

Mobile wallet connection via QR code:

```typescript
import { WalletConnectWallet } from '@pact-toolbox/wallet-adapters';

const walletConnect = new WalletConnectWallet({
  projectId: 'your-project-id',
  metadata: {
    name: 'My dApp',
    description: 'My Kadena dApp',
    url: 'https://mydapp.com',
    icons: ['https://mydapp.com/icon.png']
  }
});

// Initialize and show QR code
await walletConnect.connect();

// Listen for connection
walletConnect.on('connected', (accounts) => {
  console.log('Connected accounts:', accounts);
});
```

### Magic

Email/social login wallet:

```typescript
import { MagicWallet } from '@pact-toolbox/wallet-adapters';

const magic = new MagicWallet({
  apiKey: 'your-magic-api-key',
  network: 'mainnet' // or 'testnet'
});

// Login with email
await magic.loginWithEmail('user@example.com');

// Or login with social
await magic.loginWithSocial('google');

// Sign transaction
const signedTx = await magic.signTransaction(transaction);
```

## Development Wallet

The development wallet provides a full-featured wallet UI for testing:

```typescript
import { DevWallet } from '@pact-toolbox/dev-wallet';

// Create with options
const wallet = new DevWallet({
  networkId: 'development',
  port: 9467,
  accounts: [
    {
      name: 'Alice',
      keys: ['alice-public-key'],
      balance: 1000
    },
    {
      name: 'Bob', 
      keys: ['bob-public-key'],
      balance: 500
    }
  ]
});

// Start the wallet UI
await wallet.start();

// Access wallet API
const accounts = await wallet.getAccounts();
const signedTx = await wallet.signTransaction(tx);

// Stop when done
await wallet.stop();
```

### Development Wallet Features

- **Web UI** - Full-featured wallet interface at http://localhost:9467
- **Account Management** - Create, import, and manage accounts
- **Transaction Signing** - Visual transaction approval
- **Network Switching** - Easy network selection
- **Key Management** - Generate and store keys securely
- **Transaction History** - View past transactions

## Unified Wallet Interface

All wallet adapters implement the same interface:

```typescript
interface WalletAdapter {
  // Connection
  isInstalled(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Account Management
  getAccounts(): Promise<Account[]>;
  getAccount(): Promise<Account | null>;
  
  // Signing
  signTransaction(tx: Transaction): Promise<SignedTransaction>;
  signAndSend(tx: Transaction): Promise<TransactionResult>;
  
  // Events
  on(event: 'connected' | 'disconnected' | 'accountsChanged', handler: Function): void;
  off(event: string, handler: Function): void;
}
```

## Integration with Transaction Builder

The wallet adapters integrate seamlessly with the transaction builder:

```typescript
import { createTransaction } from '@pact-toolbox/transaction';
import { EckoWallet } from '@pact-toolbox/wallet-adapters';

const ecko = new EckoWallet();
await ecko.connect();

// Build transaction
const tx = createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .addCap('coin.TRANSFER', 'alice', 'bob', 1.0)
  .setMeta({ chainId: '0', sender: 'alice' })
  .build();

// Sign with wallet
const signedTx = await ecko.signTransaction(tx);

// Or use the transaction builder's wallet integration
const result = await createTransaction()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .sign({ wallet: ecko })
  .submitAndListen();
```

## Advanced Usage

### Multi-Wallet Support

Support multiple wallets in your app:

```typescript
import { 
  ChainweaverWallet, 
  EckoWallet, 
  ZelcoreWallet 
} from '@pact-toolbox/wallet-adapters';

class WalletManager {
  private wallets: Map<string, WalletAdapter> = new Map();
  private currentWallet: WalletAdapter | null = null;
  
  constructor() {
    this.registerWallet('chainweaver', new ChainweaverWallet());
    this.registerWallet('ecko', new EckoWallet());
    this.registerWallet('zelcore', new ZelcoreWallet());
  }
  
  registerWallet(id: string, wallet: WalletAdapter) {
    this.wallets.set(id, wallet);
  }
  
  async getAvailableWallets() {
    const available = [];
    for (const [id, wallet] of this.wallets) {
      if (await wallet.isInstalled()) {
        available.push({ id, wallet });
      }
    }
    return available;
  }
  
  async connect(walletId: string) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error(`Wallet ${walletId} not found`);
    
    await wallet.connect();
    this.currentWallet = wallet;
    return wallet;
  }
  
  getCurrentWallet() {
    return this.currentWallet;
  }
}
```

### Custom Wallet Adapter

Create your own wallet adapter:

```typescript
import { WalletAdapter, Account, Transaction } from '@pact-toolbox/wallet-core';

class CustomWallet implements WalletAdapter {
  private connected = false;
  
  async isInstalled(): Promise<boolean> {
    return typeof window.customWallet !== 'undefined';
  }
  
  async connect(): Promise<void> {
    if (!await this.isInstalled()) {
      throw new Error('Custom wallet not installed');
    }
    
    // Your connection logic
    await window.customWallet.requestAccess();
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    await window.customWallet.disconnect();
    this.connected = false;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async getAccounts(): Promise<Account[]> {
    return window.customWallet.getAccounts();
  }
  
  async signTransaction(tx: Transaction): Promise<SignedTransaction> {
    return window.customWallet.sign(tx);
  }
  
  // Implement other required methods...
}
```

### React Integration

Use wallets in React applications:

```typescript
import { useState, useEffect } from 'react';
import { EckoWallet } from '@pact-toolbox/wallet-adapters';

function useWallet() {
  const [wallet] = useState(() => new EckoWallet());
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  
  useEffect(() => {
    wallet.on('connected', async () => {
      setConnected(true);
      const acc = await wallet.getAccount();
      setAccount(acc);
    });
    
    wallet.on('disconnected', () => {
      setConnected(false);
      setAccount(null);
    });
    
    // Check if already connected
    if (wallet.isConnected()) {
      wallet.getAccount().then(setAccount);
      setConnected(true);
    }
  }, [wallet]);
  
  const connect = async () => {
    try {
      await wallet.connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };
  
  const disconnect = async () => {
    await wallet.disconnect();
  };
  
  return { wallet, connected, account, connect, disconnect };
}

// Use in component
function WalletButton() {
  const { connected, account, connect, disconnect } = useWallet();
  
  if (connected) {
    return (
      <div>
        <p>Connected: {account?.account}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }
  
  return <button onClick={connect}>Connect Wallet</button>;
}
```

## Error Handling

Handle wallet errors gracefully:

```typescript
import { WalletError, ErrorCode } from '@pact-toolbox/wallet-adapters';

try {
  await wallet.connect();
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case ErrorCode.NOT_INSTALLED:
        console.error('Wallet not installed');
        // Show installation instructions
        break;
        
      case ErrorCode.USER_REJECTED:
        console.error('User rejected connection');
        break;
        
      case ErrorCode.ALREADY_CONNECTED:
        console.error('Already connected');
        break;
        
      case ErrorCode.CHAIN_MISMATCH:
        console.error('Wrong network');
        break;
        
      default:
        console.error('Wallet error:', error.message);
    }
  }
}
```

## Best Practices

### 1. Check Wallet Availability

Always check if a wallet is installed before trying to connect:

```typescript
const wallet = new EckoWallet();

if (!await wallet.isInstalled()) {
  // Show message to install wallet
  showInstallPrompt('Ecko Wallet');
  return;
}

await wallet.connect();
```

### 2. Handle Network Mismatches

```typescript
wallet.on('chainChanged', (chainId) => {
  if (chainId !== expectedChainId) {
    alert('Please switch to the correct network');
  }
});
```

### 3. Persist Wallet Selection

```typescript
// Save user's wallet choice
localStorage.setItem('selectedWallet', 'ecko');

// Restore on app load
const savedWallet = localStorage.getItem('selectedWallet');
if (savedWallet) {
  await connectWallet(savedWallet);
}
```

### 4. Provide Wallet Options

Let users choose their preferred wallet:

```typescript
const availableWallets = await getAvailableWallets();

if (availableWallets.length === 0) {
  showNoWalletsMessage();
} else if (availableWallets.length === 1) {
  // Auto-connect to the only available wallet
  await connectWallet(availableWallets[0]);
} else {
  // Show wallet selection UI
  showWalletSelector(availableWallets);
}
```

## Testing with Dev Wallet

The development wallet is perfect for testing:

```typescript
import { DevWallet } from '@pact-toolbox/dev-wallet';

describe('Token Transfer', () => {
  let wallet: DevWallet;
  
  beforeAll(async () => {
    wallet = new DevWallet({
      accounts: [
        { name: 'alice', balance: 1000 },
        { name: 'bob', balance: 0 }
      ]
    });
    await wallet.start();
  });
  
  afterAll(async () => {
    await wallet.stop();
  });
  
  test('transfer tokens', async () => {
    const tx = createTransaction()
      .code('(coin.transfer "alice" "bob" 100.0)')
      .build();
      
    const signed = await wallet.signTransaction(tx);
    expect(signed).toBeDefined();
    
    // Verify balances changed
    const aliceBalance = await wallet.getBalance('alice');
    expect(aliceBalance).toBe(900);
  });
});
```