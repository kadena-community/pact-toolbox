---
title: "Package Overview"
description: "Overview of all packages in the Pact Toolbox ecosystem"
---

# Package Overview

Pact Toolbox is organized as a monorepo with multiple specialized packages. Each package serves a specific purpose in the development workflow.

## Core Packages

### Development Tools

#### [@pact-toolbox/unplugin](./unplugin)
Universal bundler plugin that works with 10+ build tools including Vite, Webpack, Next.js, Nuxt, Rollup, esbuild, and more. Provides hot module replacement and automatic TypeScript type generation.

#### [@pact-toolbox/test](./test)
Testing framework with REPL support for Pact contracts. Integrates with Vitest and provides utilities for comprehensive contract testing.

#### [@pact-toolbox/runtime](/packages/runtime)
Runtime execution environment for Pact code. Handles contract execution and provides a bridge between TypeScript and Pact.

### Blockchain Integration

#### [@pact-toolbox/chainweb-client](./chainweb-client)
Fast, zero-dependency Chainweb API client. Provides low-level access to Kadena's blockchain with full TypeScript support.

#### [@pact-toolbox/transaction](./transaction)
High-level transaction builder with a fluent API. Makes it easy to construct, sign, and submit transactions.

#### [@pact-toolbox/network](./network)
Network configuration and management. Handles connections to local DevNet, testnet, and mainnet.

### Wallet & Security

#### [@pact-toolbox/wallet-adapters](./wallet)
Unified interface for all major Kadena wallets including Chainweaver, Ecko, Zelcore, Magic, and WalletConnect.

#### [@pact-toolbox/crypto](/packages/crypto)
Cryptographic utilities including Ed25519 signatures, Blake2b hashing, and key management.

#### [@pact-toolbox/dev-wallet](/packages/dev-wallet)
Built-in development wallet with web UI for testing and development.

## Additional Packages

### Utilities

- **@pact-toolbox/config** - Configuration management and validation
- **@pact-toolbox/utils** - Common utilities and helpers
- **@pact-toolbox/types** - Shared TypeScript type definitions
- **@pact-toolbox/node-utils** - Node.js specific utilities

### Code Generation

- **@pact-toolbox/fabricator** - Smart contract and module generators
- **@pact-toolbox/prelude** - Kadena prelude management and deployment
- **pact-transformer** - Rust-powered Pact parser with TypeScript generation

### Services

- **@pact-toolbox/docker** - Docker orchestration for local development
- **@pact-toolbox/script** - Script execution and deployment utilities
- **@pact-toolbox/signers** - Transaction signing abstractions

### UI Components

- **@pact-toolbox/ui-shared** - Shared UI components and styles
- **@pact-toolbox/wallet-ui** - Wallet connection UI components
- **@pact-toolbox/wallet-core** - Base wallet functionality

## Package Architecture

All packages follow consistent patterns:

- **Zero or minimal dependencies** - Core packages like chainweb-client have zero runtime dependencies
- **Full TypeScript support** - Every package is written in TypeScript with comprehensive type definitions
- **Tree-shakeable** - Import only what you need
- **Well-tested** - Each package includes comprehensive test suites
- **Documentation** - Every package includes detailed documentation and examples

## Using Packages

### Installation

Install individual packages as needed:

```bash
# Install specific packages
pnpm add @pact-toolbox/transaction @pact-toolbox/chainweb-client

# Install development tools
pnpm add -D @pact-toolbox/unplugin @pact-toolbox/test
```

### Example Usage

```typescript
// Import what you need
import { execution } from '@pact-toolbox/transaction';
import { ChainwebClient, createTestnetClient } from '@pact-toolbox/chainweb-client';
import { connectWallet } from '@pact-toolbox/wallet-adapters';

// Create a testnet client
const client = createTestnetClient({ chainId: '0' });

// Connect to a wallet
const wallet = await connectWallet('chainweaver');

// Build and execute a transaction
const result = await execution('(coin.details "alice")')
  .withChainId('0')
  .sign(wallet)
  .submitAndListen();
```

