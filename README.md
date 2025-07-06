# 🛠️ Pact Toolbox

**Modern TypeScript/Rust development toolchain for building, testing, and deploying Pact smart contracts on Kadena**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@pact-toolbox/unplugin.svg)](https://www.npmjs.com/package/@pact-toolbox/unplugin)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)

> **⚠️ Work in Progress**: This project is currently under active development. APIs and features may change. We welcome feedback and contributions!

## 🎯 What is Pact Toolbox?

Pact Toolbox is a comprehensive development ecosystem that revolutionizes Kadena blockchain development. It combines the performance of Rust with the flexibility of TypeScript to provide a modern, type-safe development experience for Pact smart contracts. With support for 10+ bundlers, automatic TypeScript type generation, and seamless wallet integration, it's the complete toolchain for professional Kadena development.

### 🚀 Quick Start

Get started in under a minute:

```bash
# Create a new Pact dApp
pnpm create pact-toolbox-app my-dapp

# Navigate to your project
cd my-dapp

# Start developing with hot reload
pnpm dev
```

That's it! You now have a fully configured Pact development environment with:

- ✅ TypeScript types auto-generated from your Pact contracts
- ✅ Hot module replacement for instant feedback
- ✅ Local blockchain running in the background
- ✅ Example todo-list smart contract
- ✅ Production-ready build setup

## 🌟 Why Pact Toolbox?

### Developer Experience First

```typescript
// Import your Pact contract like any TypeScript module
import { todos } from "./pact/todos.pact";

// Enjoy full type safety and IntelliSense
const result = await todos
  .createTodo({
    id: "todo-1",
    title: "Build amazing dApps",
    completed: false,
  })
  .sign()
  .submitAndListen();
```

### Key Features

- **🔥 Hot Module Replacement** - See contract changes instantly without restarting
- **📝 Automatic TypeScript Types** - Full type safety from Pact to TypeScript with framework-specific code generation
- **🦀 Rust-Powered Performance** - Lightning-fast parsing with tree-sitter and WebAssembly support
- **🔌 Universal Plugin** - Works with Vite, Webpack, Next.js, Nuxt, Rollup, esbuild, RSpack, Rsbuild, Farm, and Jest
- **🧪 Modern Testing** - REPL-based testing with Vitest integration and multiple test frameworks support
- **💼 Multi-Wallet Support** - Unified API for Chainweaver, Ecko, Zelcore, Magic, and WalletConnect
- **🌐 Network Management** - Seamless local DevNet, testnet, and mainnet development with Docker orchestration
- **📊 Visual Tools** - Admin dashboard, interactive playground, and real-time monitoring
- **🔐 Comprehensive Security** - Built-in cryptography (Ed25519, Blake2b), key management, and signing
- **📦 Zero Dependencies** - Core packages like chainweb-client have zero runtime dependencies

## 📦 What's Included?

### Core Libraries

#### **Development Tools**

- **`@pact-toolbox/unplugin`** - Universal bundler plugin supporting 10+ build tools
- **`@pact-toolbox/runtime`** - Runtime execution environment for Pact code
- **`@pact-toolbox/test`** - Testing framework with REPL support and Vitest integration
- **`@pact-toolbox/script`** - Script execution and deployment utilities

#### **Blockchain Integration**

- **`@pact-toolbox/chainweb-client`** - Fast, zero-dependency Chainweb API client
- **`@pact-toolbox/transaction`** - High-level transaction builder with fluent API
- **`@pact-toolbox/network`** - Network configuration and management
- **`@pact-toolbox/docker`** - Docker orchestration for local DevNet
- **`@pact-toolbox/kda`** - Kadena-specific services (coin, marmalade, namespace)

#### **Wallet & Security**

- **`@pact-toolbox/crypto`** - Ed25519, Blake2b, and cryptographic utilities
- **`@pact-toolbox/signers`** - Transaction signing abstractions
- **`@pact-toolbox/wallet-core`** - Base wallet functionality
- **`@pact-toolbox/wallet-adapters`** - Unified interface for all Kadena wallets
- **`@pact-toolbox/dev-wallet`** - Built-in development wallet with UI

#### **Code Generation & Utilities**

- **`@pact-toolbox/fabricator`** - Smart contract and module generators
- **`@pact-toolbox/prelude`** - Prelude management and deployment
- **`pact-transformer`** - Rust-powered parser with TypeScript type generation

### Applications

- **`pact-toolbox` CLI** - Command-line interface with commands for init, start, test, run, generate, and more
- **`docs`** - Comprehensive documentation site built with Rspress

### Development Workflow

1. **Write Pact contracts** with syntax highlighting and validation
2. **Import directly** into TypeScript with full type inference
3. **Test contracts** using familiar testing patterns
4. **Deploy** to any Kadena network with one command

## 🏗️ Architecture

Pact Toolbox is built as a polyglot monorepo combining TypeScript and Rust for optimal performance and developer experience:

```
pact-toolbox/
├── packages/           # Core TypeScript packages
│   ├── unplugin/      # Universal bundler plugin (10+ bundlers)
│   ├── transaction/   # Transaction builder with fluent API
│   ├── chainweb-client/ # Zero-dependency Chainweb client
│   ├── test/          # REPL-based testing framework
│   ├── crypto/        # Cryptographic utilities
│   ├── wallet-*/      # Wallet ecosystem packages
│   └── ...            # 20+ specialized packages
├── apps/              # Applications
│   ├── cli/           # pact-toolbox CLI
│   └── docs/          # Documentation site
├── crates/            # Rust components
│   ├── pact-transformer/ # Tree-sitter parser & TypeScript generator
│   └── mining-trigger/   # Mining service for DevNet
├── examples/          # Example projects
│   ├── todo-mvc-vite/    # Vite example
│   └── todo-mvc-nextjs/  # Next.js example
└── tooling/           # Shared configurations
    ├── oxlint/        # Linting (not ESLint)
    ├── prettier/      # Code formatting
    ├── tsconfig/      # TypeScript configs
    └── vitest/        # Testing configs
```

### Technology Stack

- **TypeScript** - Primary language for all packages and tools
- **Rust** - Performance-critical components (parser, mining trigger)
- **Tree-sitter** - Advanced parsing for Pact contracts
- **NAPI-RS** - Rust-TypeScript bridge for native performance
- **Vitest** - Modern testing framework
- **Turbo** - Build orchestration and caching
- **pnpm** - Fast, efficient package management

## 🎯 Use Cases

### For dApp Developers

Build production-ready decentralized applications with the same tools and workflows you already know and love.

### For Smart Contract Engineers

Test and deploy Pact contracts with confidence using modern testing practices and deployment automation.

### For Teams

Standardize on a single toolchain that works across your entire stack, from smart contracts to frontend.

## 📚 Documentation

### View Online

Visit our documentation at [https://kadena-community.github.io/pact-toolbox/](https://kadena-community.github.io/pact-toolbox/)

- **[Introduction](https://kadena-community.github.io/pact-toolbox/intro)** - Learn what makes Pact Toolbox special
- **[First Project](https://kadena-community.github.io/pact-toolbox/getting-started/first-project)** - Build your first Kadena app
- **[API Reference](https://kadena-community.github.io/pact-toolbox/api/)** - Complete API documentation for all packages
- **[Examples](./examples)** - Full example applications

### Run Locally

```bash
# Start documentation dev server
pnpm docs:dev

# Build documentation
pnpm docs:build

# Preview production build
pnpm docs:preview
```

## 🏗️ Architecture

### Dependency Injection

Pact Toolbox uses a lightweight dependency injection container for managing global state and services. This provides clean separation of concerns and makes testing easier.

```typescript
import { setupWalletDI } from '@pact-toolbox/wallet-adapters';
import { register, TOKENS } from '@pact-toolbox/utils';

// Configure services at app startup
await setupWalletDI({
  wallets: {
    chainweaver: true,
    walletconnect: { projectId: 'your-project-id' }
  }
});

// Services are automatically available throughout your app
const tx = await execution('(coin.transfer "alice" "bob" 10.0)')
  .sign()  // Uses configured wallet system
  .submitAndListen();
```

See [DI-CONTAINER.md](./DI-CONTAINER.md) for detailed documentation.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Prerequisites
# - Node.js >= 22.0.0
# - pnpm >= 9.0.0
# - Rust (for building crates)

# Clone the repository
git clone https://github.com/kadena-community/pact-toolbox.git
cd pact-toolbox

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode (watch)
pnpm dev

# Lint and format
pnpm lint
pnpm format:fix
```

### Project Structure Guidelines

- **Packages** follow `@pact-toolbox/*` naming convention
- **Apps** are standalone applications
- **Crates** are Rust components exposed to TypeScript
- **Examples** demonstrate real-world usage patterns
- **Tooling** contains shared development configurations

## 📄 License

MIT - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush) and the Kadena community

Special thanks to:

- The Kadena team for creating Pact and Chainweb
- The Rust community for excellent tooling
- All contributors who have helped shape this project
