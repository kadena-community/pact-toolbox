# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

pact-toolbox is a comprehensive development toolchain for building, testing, and deploying Pact smart contracts on the Kadena blockchain. It's a TypeScript/Rust monorepo using pnpm workspaces.

## Essential Commands

### Development

```bash
# Install dependencies (requires Node.js >=22.0.0)
pnpm install

# Build all packages
pnpm build

# Watch mode - rebuilds on changes
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode (at package level)
cd packages/<package-name> && pnpm test:watch

# Lint code
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format code
pnpm format:fix

# Type check
pnpm typecheck
```

### Testing Specific Files

```bash
# Run a specific test file
cd packages/<package-name> && pnpm vitest run path/to/test.spec.ts

# Run tests matching a pattern
cd packages/<package-name> && pnpm vitest run -t "pattern"
```

### Working with Rust Components

```bash
# Build Rust crates
cd crates/pact-transformer && cargo build

# Run Rust tests
cd crates/pact-transformer && cargo test
```

## Architecture Overview

### Monorepo Structure

- **packages/**: Core library packages (25+ packages including transaction, chainweb-client, wallet-\*, etc.)
- **apps/**: Applications
  - `cli/`: Main pact-toolbox CLI with commands for init, start, test, run, generate, doctor, prelude
  - `docs/`: Documentation site built with Next.js and Fumadocs
- **crates/**: Rust components
  - `pact-transformer/`: Tree-sitter based parser with TypeScript type generation
  - `mining-trigger/`: Mining service for local DevNet
- **tooling/**: Shared development configurations (oxlint, prettier, tsconfig, tsdown, vitest)
- **examples/**: Example applications (todo-mvc-vite, todo-mvc-nextjs)

### Key Architectural Patterns

1. **Plugin System**: Universal plugin (`@pact-toolbox/unplugin`) supports 10+ bundlers (Vite, Webpack, Next.js, Nuxt, Rollup, esbuild, RSpack, Rsbuild, Farm, Jest) through a unified interface.

2. **Transaction Architecture**: The `@pact-toolbox/transaction` uses a fluent builder pattern for type-safe transaction construction and supports multiple wallet providers through `@pact-toolbox/wallet-adapters`.

3. **Rust-TypeScript Bridge**: Multiple Rust crates use NAPI-RS to expose high-performance functionality:
   - `pact-transformer`: Pact parsing and TypeScript/framework-specific code generation

4. **Testing Framework**: Built on Vitest with REPL-based testing for Pact contracts. The `@pact-toolbox/test` package provides utilities for testing Pact code with `.repl` file support.

5. **Zero-Dependency Design**: Core packages like `@pact-toolbox/chainweb-client` have zero runtime dependencies for optimal performance and small bundle sizes.

### Technology Stack

- **TypeScript**: Primary language for all packages
- **Rust**: Performance-critical components (parser, playground server)
- **Build Tools**: tsdown (TypeScript bundling), Turbo (build orchestration)
- **Testing**: Vitest with REPL-based Pact testing utilities
- **Linting**: oxlint (fast, modern alternative to ESLint)
- **Formatting**: Prettier for TypeScript, dprint for Rust
- **Package Manager**: pnpm with workspaces
- **Native Bindings**: NAPI-RS for Rust-TypeScript interop

### Development Workflow

1. Changes trigger Turbo's dependency graph to rebuild affected packages
2. The unplugin system hot-reloads Pact contracts during development
3. Tests can be run at package level or across the entire monorepo
4. Type checking and linting are enforced before commits via Husky

## Important Package Details

### Core Packages

- **@pact-toolbox/chainweb-client**: Zero-dependency Chainweb API client with full TypeScript support
- **@pact-toolbox/transaction**: Fluent API for building Pact transactions with type safety
- **@pact-toolbox/unplugin**: Universal bundler plugin supporting hot module replacement
- **@pact-toolbox/test**: REPL-based testing framework for Pact contracts
- **@pact-toolbox/wallet-adapters**: Unified interface for Chainweaver, Ecko, Zelcore, Magic, WalletConnect
- **@pact-toolbox/dev-wallet**: Built-in development wallet with web UI
- **@pact-toolbox/crypto**: Ed25519 and Blake2b cryptographic utilities
- **@pact-toolbox/docker**: Docker orchestration for local DevNet development

### CLI Commands

The main `pact-toolbox` CLI provides these commands:

- `init`: Initialize a new Pact project
- `start`: Start local development environment with DevNet
- `test`: Run Pact contract tests
- `run`: Execute Pact scripts
- `generate`: Generate modules, stations, and other code
- `doctor`: Check system requirements and setup
- `prelude`: Manage Pact prelude deployment

### Configuration

Projects use `pact-toolbox.config.ts` for configuration:

```typescript
import { defineConfig } from "@pact-toolbox/config";

export default defineConfig({
  contracts: ["./pact/*.pact"],
  network: {
    networkId: "development",
    chainId: "0",
  },
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
```

## Commit Guidelines

- **Commit Signatures**:
  - Do not add Anthropic/Claude signatures to the commit messages

## Development Instructions

- **Important Notes**:
  - Never commit or push anything until explicitly mentioned

## Code Guidelines

- **Versioning and File Naming**:
  - Never create duplicate versions with suffixes like "*-refactored.*" or "-enhanced"
  - Always implement improvements directly in the main version of the file/code

## CRITICAL: Migration Guidelines

**NEVER do migrations like this:**
- Delete files then recreate from memory
- Make massive changes without testing
- Mix framework code (e.g., Lit + SolidJS) incorrectly
- Ignore user warnings about problems
- Continue making changes after user indicates something is wrong
- Do 1:1 mechanical translation of old patterns
- Try to preserve old framework's patterns in new framework

**ALWAYS do migrations like this:**
1. Study the target framework's best practices and patterns FIRST
2. Understand how the new framework wants things done
3. Rewrite using the NEW framework's paradigm while maintaining functionality
4. Create parallel implementations alongside originals
5. Test EACH component individually after changes
6. Never delete original files until migration is verified working
7. Use TodoWrite to meticulously track every single step
8. Stop IMMEDIATELY when user indicates any problem

**Key Migration Principles:**
- **Maintain functionality, not code structure** - The end result should do the same thing but implemented the RIGHT way for the new framework
- **Embrace new patterns** - Use the new framework's idioms and best practices, not old patterns forced into new syntax
- **Improve where possible** - Migration is an opportunity to modernize and improve, not just translate

**Example - Lit to SolidJS:**
- Lit `@customElement` decorators → SolidJS functional components
- Lit `@property` decorators → SolidJS props and signals
- Lit lifecycle methods → SolidJS createEffect, onMount, onCleanup
- Lit's shadow DOM → SolidJS's simpler component model
- Lit's template strings → SolidJS JSX
- Lit's imperative updates → SolidJS reactive primitives

**Migration Testing Protocol:**
- Run `pnpm build` after each component migration
- Run `pnpm test` to verify functionality preserved
- Check that all exports still work
- Verify UI components render correctly
- Test all event handlers and state management

**If user says "you deleted things without migrating":**
- STOP immediately
- Restore deleted files
- Start over with proper migration approach

**If user says migration is "terrible" or "wrong":**
- Understand you likely did mechanical translation instead of proper rewrite
- Review the new framework's documentation
- Start fresh with new framework's best practices