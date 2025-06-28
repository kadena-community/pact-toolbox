# @pact-toolbox/wallet-core

Core wallet interfaces and base implementations for the Pact Toolbox ecosystem. This package provides the foundational types and abstractions for wallet integrations.

## Installation

```bash
npm install @pact-toolbox/wallet-core
# or
pnpm add @pact-toolbox/wallet-core
# or
yarn add @pact-toolbox/wallet-core
```

## Overview

`@pact-toolbox/wallet-core` defines the standard interfaces and base implementations that all wallet providers must implement. It ensures consistent behavior across different wallet types (browser extensions, mobile wallets, hardware wallets, etc.).

## Key Features

- 🔌 **Unified Wallet Interface** - Standard API for all wallet types
- 🔐 **Transaction Signing** - Support for single and batch transaction signing using Pact's `PartiallySignedTransaction` format
- 🌐 **Multi-Network Support** - Handle different Kadena networks (mainnet, testnet, devnet)
- 📱 **Multiple Wallet Types** - Browser extensions, mobile, hardware, built-in, desktop, and web wallets
- ⚡ **Event System** - React to wallet state changes
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive types

## Core Interfaces

### Wallet

The main interface that all wallets must implement:

```typescript
interface Wallet {
  // Check if wallet is installed/available
  isInstalled(): boolean;
  
  // Connection management
  connect(networkId?: string): Promise<WalletAccount>;
  disconnect(networkId?: string): Promise<void>;
  isConnected(networkId?: string): Promise<boolean>;
  
  // Account information
  getAccount(networkId?: string): Promise<WalletAccount>;
  
  // Network information
  getNetwork(): Promise<WalletNetwork>;
  
  // Transaction signing (with overloads)
  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
}
```

### WalletProvider

Factory interface for creating wallet instances:

```typescript
interface WalletProvider {
  readonly metadata: WalletMetadata;
  isAvailable(): Promise<boolean>;
  createWallet(): Promise<Wallet>;
}
```

### WalletAccount

Account information structure:

```typescript
interface WalletAccount {
  address: string;              // Public key address (k:publicKey format)
  publicKey: string;            // Public key
  balance?: number;             // Account balance (optional)
  connectedSites?: string[];    // Connected sites/dApps (optional)
  connectedAt?: Date;           // Connection timestamp (optional)
}
```

### WalletNetwork

Network configuration with enhanced details:

```typescript
interface WalletNetwork {
  id: string;               // Network unique identifier
  networkId: string;        // Kadena network ID (mainnet01, testnet04, etc.)
  name: string;             // Human-readable network name
  url: string;              // RPC endpoint URL
  explorer?: string;        // Network explorer URL (optional)
  isDefault?: boolean;      // Whether this is the default network (optional)
}
```

## Base Implementation

The package provides `BaseWallet`, an abstract class that implements common functionality:

```typescript
import { BaseWallet } from '@pact-toolbox/wallet-core';
import type { PartiallySignedTransaction, SignedTransaction } from '@pact-toolbox/types';

class MyCustomWallet extends BaseWallet {
  isInstalled(): boolean {
    // Check if wallet is available
    return true;
  }

  async connect(networkId?: string): Promise<WalletAccount> {
    // Implement connection logic
    this.connected = true;
    this.account = { 
      address: 'k:public-key-here',
      publicKey: 'public-key-here'
    };
    this.network = {
      id: networkId || 'development',
      networkId: networkId || 'development',
      name: 'Development',
      url: 'http://localhost:8080'
    };
    return this.account;
  }
  
  // Method overloads for TypeScript
  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[]): Promise<SignedTransaction | SignedTransaction[]> {
    // Implement signing logic for both single and batch
    if (Array.isArray(txOrTxs)) {
      // Batch signing
      return txOrTxs.map(tx => ({ ...tx, sigs: [{ sig: 'signature' }] }));
    } else {
      // Single signing
      return { ...txOrTxs, sigs: [{ sig: 'signature' }] };
    }
  }
}
```

The base class provides:
- Connection state management (`connected`, `account`, `network` properties)
- Default implementations for `getAccount()` and `getNetwork()` that auto-connect if needed
- Default implementations for `isConnected()` and `disconnect()`

## Error Handling

The package provides a standardized error system:

```typescript
import { WalletError } from '@pact-toolbox/wallet-core';

// Create errors with specific types
throw new WalletError('CONNECTION_FAILED', 'Failed to connect to wallet');

// Available error types:
type WalletErrorType = 
  | "NOT_FOUND"          // Wallet not found or not installed
  | "NOT_CONNECTED"      // Wallet is not connected
  | "CONNECTION_FAILED"  // Connection attempt failed
  | "USER_REJECTED"      // User rejected the request
  | "SIGNING_FAILED"     // Transaction signing failed
  | "NETWORK_MISMATCH"   // Network mismatch between wallet and dApp
  | "TIMEOUT"            // Operation timed out
  | "UNKNOWN"            // Unknown error

// WalletError includes:
class WalletError extends Error {
  type: WalletErrorType;
  cause?: unknown;       // Original error if any
}

// Static factory methods for common errors:
WalletError.notFound(walletId: string)
WalletError.notConnected(walletId: string)
WalletError.connectionFailed(reason: string)
WalletError.userRejected(operation: string)
WalletError.signingFailed(reason: string)
WalletError.networkMismatch(expected: string, actual: string)
WalletError.timeout(operation: string, timeout: number)
WalletError.unknown(message: string, cause?: unknown)
```

## Utility Functions

### detectBrowserExtension

Detect if a browser extension wallet is available:

```typescript
import { detectBrowserExtension } from '@pact-toolbox/wallet-core';

// Check if Ecko wallet is installed
const isEckoAvailable = await detectBrowserExtension('kadena', 3000);

// Check if Chainweaver is installed  
const isChainweaverAvailable = await detectBrowserExtension('kadenaSpireKey', 3000);
```

## Events

Wallets can emit events for state changes through the WalletService:

```typescript
interface WalletEvents {
  accountChanged: (account: WalletAccount) => void;
  networkChanged: (network: WalletNetwork) => void;
  connected: (wallet: Wallet) => void;
  disconnected: (walletId: string) => void;
  error: (error: WalletError) => void;
}
```

## Connection Options

Configure wallet connections:

```typescript
interface ConnectOptions {
  networkId?: string;     // Target network ID
  force?: boolean;        // Force reconnection even if already connected
  timeout?: number;       // Connection timeout in milliseconds
}

interface AutoConnectOptions extends ConnectOptions {
  preferredWallets?: string[];  // Wallet IDs in order of preference
  skipUnavailable?: boolean;    // Skip wallets that aren't available (default: true)
}
```

## Transaction Types

The package works with Pact transaction types from `@pact-toolbox/types`:

```typescript
import type {
  PartiallySignedTransaction,
  SignedTransaction
} from '@pact-toolbox/wallet-core';

// PartiallySignedTransaction structure:
interface PartiallySignedTransaction {
  cmd: string;           // Stringified Pact command
  hash: string;          // Transaction hash
  sigs: Array<{          // Existing signatures (if any)
    sig: string;
  }>;
}

// SignedTransaction adds signatures:
interface SignedTransaction extends PartiallySignedTransaction {
  sigs: Array<{
    sig: string;         // Cryptographic signature
  }>;
}
```

## Examples

### Creating a Custom Wallet Provider

```typescript
import { BaseWallet, WalletProvider, WalletMetadata, detectBrowserExtension } from '@pact-toolbox/wallet-core';
import type { Wallet } from '@pact-toolbox/wallet-core';

class MyWallet extends BaseWallet {
  isInstalled(): boolean {
    return typeof window !== 'undefined' && !!(window as any).myWallet;
  }
  
  async connect(networkId?: string): Promise<WalletAccount> {
    // Implementation details...
    const account = await (window as any).myWallet.connect();
    this.connected = true;
    this.account = {
      address: `k:${account.publicKey}`,
      publicKey: account.publicKey
    };
    this.network = {
      id: networkId || 'mainnet01',
      networkId: networkId || 'mainnet01',
      name: 'Mainnet',
      url: 'https://api.chainweb.com'
    };
    return this.account;
  }
  
  sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[]): Promise<SignedTransaction | SignedTransaction[]> {
    // Delegate to wallet extension
    return (window as any).myWallet.sign(txOrTxs);
  }
}

class MyWalletProvider implements WalletProvider {
  readonly metadata: WalletMetadata = {
    id: 'my-wallet',
    name: 'My Custom Wallet',
    description: 'A custom Kadena wallet',
    icon: 'https://example.com/icon.png',
    type: 'browser-extension',
    features: ['sign', 'batch-sign']
  };
  
  async isAvailable(): Promise<boolean> {
    return detectBrowserExtension('myWallet', 3000);
  }
  
  async createWallet(): Promise<Wallet> {
    return new MyWallet();
  }
}
```

### Using Error Handling

```typescript
try {
  const account = await wallet.connect();
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.type) {
      case 'USER_REJECTED':
        console.log('User rejected connection');
        break;
      case 'NETWORK_MISMATCH':
        console.log('Wrong network');
        break;
      case 'NOT_FOUND':
        console.log('Wallet not installed');
        break;
      case 'CONNECTION_FAILED':
        console.log('Failed to connect:', error.message);
        break;
      default:
        console.error('Wallet error:', error.message);
    }
  }
}

// Using static factory methods
try {
  await wallet.sign(transaction);
} catch (error) {
  throw WalletError.signingFailed('User declined transaction');
}
```

## Best Practices

1. **Always check availability** before creating wallet instances
2. **Handle errors gracefully** using the provided error types
3. **Implement all required methods** when extending BaseWallet
4. **Emit appropriate events** for state changes
5. **Support multiple networks** when possible
6. **Validate transactions** before signing

## Related Packages

- `@pact-toolbox/wallet-adapters` - Wallet provider implementations
- `@pact-toolbox/wallet-ui` - UI components for wallet selection
- `@pact-toolbox/transaction` - Transaction building with wallet integration

## License

MIT