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
pnpm verify
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
- **packages/**: Core library packages (client, network, test, unplugin, etc.)
- **apps/**: CLI tool (`pact-toolbox`)
- **crates/**: Rust components (pact-transformer using tree-sitter)
- **tooling/**: Shared development configurations
- **examples/**: Example applications

### Key Architectural Patterns

1. **Plugin System**: Universal plugin (`@pact-toolbox/unplugin`) supports multiple bundlers (Vite, Webpack, Rollup, etc.) through a unified interface.

2. **Client Architecture**: The `@pact-toolbox/client` uses a builder pattern for configuration and supports multiple wallet providers through a unified interface.

3. **Rust-TypeScript Bridge**: The `pact-transformer` crate uses NAPI-RS to expose high-performance Pact parsing to JavaScript, enabling TypeScript type generation from Pact contracts.

4. **Testing Framework**: Built on Vitest with REPL-based testing for Pact contracts. Test files use `.repl` extension for Pact-specific tests.

### Technology Stack
- **TypeScript**: Primary language
- **Rust**: Performance-critical components (parser)
- **Build Tools**: tsdown (TypeScript), Turbo (orchestration)
- **Testing**: Vitest with custom Pact testing utilities
- **Linting**: oxlint (not ESLint)
- **Package Manager**: pnpm with workspaces

### Development Workflow
1. Changes trigger Turbo's dependency graph to rebuild affected packages
2. The unplugin system hot-reloads Pact contracts during development
3. Tests can be run at package level or across the entire monorepo
4. Type checking and linting are enforced before commits via Husky