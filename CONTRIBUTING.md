# Contributing to Pact Toolbox

Thank you for your interest in contributing to Pact Toolbox! This guide will help you get started with contributing to this comprehensive development toolchain for building, testing, and deploying Pact smart contracts on the Kadena blockchain.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Writing Code](#writing-code)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>=22.0.0) - Required for all packages
- **pnpm** (>=9.0.0) - Package manager for the monorepo
- **Rust** (latest stable) - Required for building crates
- **Git** - Version control
- **Docker** (optional) - For testing DevNet orchestration
- **Pact** (optional) - For testing Pact-specific features

### Quick Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/pact-toolbox.git
   cd pact-toolbox
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Run the build** to ensure everything works:
   ```bash
   pnpm build
   ```
5. **Run tests**:
   ```bash
   pnpm test
   ```

## Development Setup

### Install Pact (Recommended)

For the full development experience, install Pact:

```bash
# Using pactup (recommended)
npx pactup install nightly

# Or use the toolbox doctor command
npx pact-toolbox doctor
```

### Environment Variables

Create a `.env.local` file in the root directory for development:

```bash
# Optional: Enable debug logging
DEBUG=pact-toolbox:*

# Optional: Custom network configuration
PACT_NETWORK_ID=development
PACT_RPC_URL=http://localhost:8080

# Optional: Skip network startup in tests
PACT_TOOLBOX_NO_NETWORK=true
```

### Editor Setup

We recommend using **VS Code** with the following extensions:

- **TypeScript** - Built-in TypeScript support
- **Prettier** - Code formatting
- **ESLint** - Code linting (we use oxlint, but ESLint extension helps with IDE integration)
- **GitLens** - Git integration
- **Thunder Client** - API testing (for network endpoints)

### Development Commands

```bash
# Start development mode with file watching
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests in watch mode (package-specific)
cd packages/client && pnpm test:watch

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format:fix

# Type check
pnpm typecheck

# Run specific package commands
pnpm --filter @pact-toolbox/transaction build
pnpm --filter @pact-toolbox/network test
```

## Project Structure

Pact Toolbox is a TypeScript/Rust monorepo using pnpm workspaces and Turbo for build orchestration:

```
pact-toolbox/
├── apps/                          # Applications
│   ├── cli/                       # Main pact-toolbox CLI
│   └── docs/                      # Documentation site
├── packages/                      # Core library packages
│   ├── chainweb-client/          # Zero-dependency Chainweb API client
│   ├── config/                   # Configuration management
│   ├── create-pact-toolbox-app/  # Project scaffolding
│   ├── crypto/                   # Ed25519, Blake2b cryptographic utilities
│   ├── dev-wallet/               # Development wallet with UI
│   ├── docker/                   # Docker orchestration for DevNet
│   ├── fabricator/               # Smart contract generators
│   ├── init/                     # Project initialization
│   ├── kda/                      # Kadena-specific services
│   ├── network/                  # Network management
│   ├── node-utils/               # Node.js utilities
│   ├── playground/               # Interactive playground components
│   ├── prelude/                  # Prelude management
│   ├── runtime/                  # Pact runtime execution
│   ├── script/                   # Script execution & deployment
│   ├── signers/                  # Transaction signing
│   ├── test/                     # REPL testing framework
│   ├── transaction/              # Transaction builder
│   ├── types/                    # Shared TypeScript types
│   ├── ui-shared/                # Shared UI components
│   ├── unplugin/                 # Universal bundler plugin (10+ bundlers)
│   ├── utils/                    # Common utilities
│   ├── wallet-adapters/          # Multi-wallet support
│   ├── wallet-core/              # Base wallet functionality
│   └── wallet-ui/                # Wallet UI components
├── crates/                        # Rust components
│   ├── mining-trigger/           # Mining service for DevNet
│   └── pact-transformer/         # Tree-sitter parser & TypeScript generator
├── examples/                      # Example applications
│   ├── todo-mvc-vite/            # Vite example
│   └── todo-mvc-nextjs/          # Next.js example
├── tooling/                       # Shared development tools
│   ├── oxlint/                   # Linting configuration
│   ├── prettier/                 # Code formatting
│   ├── tsconfig/                 # TypeScript configurations
│   ├── tsdown/                   # Build configurations
│   └── vitest/                   # Test configurations
└── turbo.json                     # Turbo build configuration
```

### Key Technologies

- **TypeScript** - Primary language for all packages
- **Rust** - Performance-critical components (parser, playground server)
- **Turbo** - Build system and task orchestration
- **Vitest** - Testing framework with REPL support
- **tsdown** - TypeScript compilation and bundling
- **NAPI-RS** - Rust-Node.js bindings for native performance
- **Tree-sitter** - Advanced parsing for Pact contracts
- **unplugin** - Universal bundler integration (10+ bundlers)
- **oxlint** - Fast, modern linting (not ESLint)
- **pnpm** - Efficient monorepo package management

## Development Workflow

### Branch Naming

Use descriptive branch names following this pattern:

- `feature/add-wallet-integration` - New features
- `fix/transaction-signing-bug` - Bug fixes
- `docs/update-client-readme` - Documentation updates
- `refactor/simplify-network-config` - Code refactoring
- `test/add-process-manager-tests` - Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

Examples:
feat(client): add multi-wallet support
fix(network): resolve port allocation race condition
docs(unplugin): update configuration examples
test(signer): add ed25519 signing tests
refactor(utils): simplify async polling logic
```

### Development Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Write tests** for new functionality

4. **Update documentation** if needed

5. **Run the full test suite**:

   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

6. **Commit your changes** with conventional commit messages

7. **Push to your fork** and create a pull request

## Writing Code

### Coding Standards

#### TypeScript Guidelines

```typescript
// ✅ Good: Use explicit types for public APIs
export interface NetworkConfig {
  networkId: string;
  rpcUrl: string;
  chainId: ChainId;
}

// ✅ Good: Use type assertions carefully
const config = data as NetworkConfig;

// ✅ Good: Use optional chaining and nullish coalescing
const port = config.networks?.devnet?.port ?? 8080;

// ❌ Bad: Avoid 'any' type
const data: any = response;

// ❌ Bad: Don't use non-null assertion without good reason
const value = data!.value;
```

#### Error Handling

```typescript
// ✅ Good: Create custom error classes
export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

// ✅ Good: Provide context in errors
throw new NetworkError(`Failed to connect to ${url}`, originalError);

// ✅ Good: Handle errors appropriately
try {
  await operation();
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout specifically
  } else {
    // Re-throw or handle generically
    throw error;
  }
}
```

#### Async/Await Patterns

```typescript
// ✅ Good: Use async/await consistently
export async function deployContract(contractPath: string, options: DeployOptions): Promise<DeployResult> {
  try {
    const contract = await readContract(contractPath);
    const result = await client.deploy(contract, options);
    return result;
  } catch (error) {
    throw new DeploymentError(`Failed to deploy ${contractPath}`, error);
  }
}

// ✅ Good: Handle Promise.all for concurrent operations
const [account, balance, nonce] = await Promise.all([
  client.getAccount(address),
  client.getBalance(address),
  client.getNonce(address),
]);
```

### Package-Specific Guidelines

#### Transaction Package

- Always validate transaction parameters before signing
- Provide type-safe APIs with comprehensive TypeScript definitions
- Support builder pattern for fluent transaction creation
- Include proper error handling for network failures

#### Chainweb-Client Package

- Maintain zero runtime dependencies
- Optimize for performance and small bundle size
- Support all Chainweb API endpoints
- Provide comprehensive error messages

#### Network Package

- Ensure proper cleanup of Docker containers and processes
- Support graceful shutdown and resource cleanup
- Provide health checks for all managed services
- Handle port conflicts and resource allocation

#### Unplugin Package

- Maintain compatibility with all 10+ supported bundlers
- Cache transformation results for better performance
- Provide clear error messages with file location context
- Support hot module replacement where possible

#### Wallet Packages

- Ensure secure key management practices
- Support multiple wallet providers through unified interface
- Provide clear user feedback for all operations
- Handle edge cases like network disconnections gracefully

#### Rust Crates

- Follow Rust idioms and best practices
- Use proper error handling with Result types
- Optimize for performance while maintaining safety
- Provide comprehensive documentation for NAPI exports

### Documentation in Code

````typescript
/**
 * Creates a new Pact transaction with the specified parameters.
 *
 * @param code - The Pact code to execute
 * @param data - Environment data for the transaction
 * @param options - Transaction options including gas and TTL
 * @returns A promise that resolves to the transaction result
 *
 * @example
 * ```typescript
 * const result = await client.local(
 *   '(coin.transfer "alice" "bob" 1.0)',
 *   { 'alice-ks': { keys: ['alice-key'], pred: 'keys-all' } },
 *   { gasLimit: 1000 }
 * );
 * ```
 */
export async function local(
  code: string,
  data: Record<string, unknown> = {},
  options: TransactionOptions = {},
): Promise<LocalResult> {
  // Implementation...
}
````

## Testing

### Testing Strategy

We use **Vitest** for all testing with these principles:

1. **Unit Tests** - Test individual functions and classes in isolation
2. **Integration Tests** - Test interactions between components
3. **E2E Tests** - Test complete workflows from user perspective

### Test Structure

```typescript
// tests/transaction.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTransaction } from "../src/builder";

describe("Transaction Builder", () => {
  let client: ReturnType<typeof createTransaction>;

  beforeEach(async () => {
    // Setup test environment
    client = createTransaction({
      networkId: "testnet04",
      chainId: "0",
    });
  });

  describe("transaction building", () => {
    it("should create valid transaction with builder pattern", async () => {
      const tx = await client.code("(coin.transfer 'alice' 'bob' 1.0)").data({ amount: 1.0 }).gasLimit(1000).build();

      expect(tx.cmd).toBeDefined();
      expect(tx.hash).toBeDefined();
    });

    it("should support type-safe contract imports", async () => {
      // Example with auto-generated types
      const result = await todos
        .createTodo({
          id: "test-1",
          title: "Test todo",
          completed: false,
        })
        .sign()
        .submitAndListen();

      expect(result.status).toBe("success");
    });
  });
});
```

### Mocking Guidelines

```typescript
// Mock external dependencies
vi.mock("@kadena/client", () => ({
  Pact: {
    builder: {
      execution: vi.fn(),
      continuation: vi.fn(),
    },
  },
}));

// Mock file system operations
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock network calls
global.fetch = vi.fn();
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @pact-toolbox/transaction test

# Run tests in watch mode
cd packages/client && pnpm test:watch

# Run tests with coverage
pnpm test -- --coverage

# Run tests matching pattern
pnpm test -- --grep "transaction"
```

### Test Coverage

We aim for high test coverage:

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

## Documentation

### README Files

Each package should have a comprehensive README with:

1. **Overview** - What the package does
2. **Installation** - How to install and setup
3. **Quick Start** - Simple usage example
4. **API Reference** - Complete API documentation
5. **Examples** - Real-world usage patterns
6. **Best Practices** - Recommended usage
7. **Troubleshooting** - Common issues and solutions

### API Documentation

Use JSDoc comments for all public APIs:

```typescript
/**
 * Configuration options for network setup
 */
export interface NetworkOptions {
  /** Network identifier (e.g., 'mainnet01', 'testnet04') */
  networkId: string;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Default chain ID for transactions */
  chainId?: ChainId;
  /** Network-specific metadata */
  meta?: NetworkMeta;
}
```

### Examples

Provide working examples in the `examples/` directory:

```typescript
// examples/basic-transfer/src/main.ts
import { createClient } from "@pact-toolbox/transaction";

async function main() {
  const client = await createClient({
    networkId: "testnet04",
    rpcUrl: "https://api.testnet.chainweb.com",
  });

  const result = await client.transfer({
    from: "alice",
    to: "bob",
    amount: 1.0,
  });

  console.log("Transfer result:", result);
}

main().catch(console.error);
```

## Submitting Changes

### Pull Request Guidelines

1. **Keep PRs focused** - One feature or fix per PR
2. **Write descriptive titles** - Clearly explain what the PR does
3. **Include tests** - All new code should have tests
4. **Update documentation** - Keep docs in sync with code changes
5. **Fill out PR template** - Provide context and testing information

### PR Template

```markdown
## Description

Brief description of the changes and why they're needed.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

Describe the tests you ran and how to reproduce them.

## Checklist

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Process

1. **Automated checks** must pass (tests, linting, type checking)
2. **At least one maintainer review** is required
3. **Address feedback** promptly and thoroughly
4. **Squash commits** before merging (maintainers will handle this)

## Release Process

We use [Changesets](https://github.com/changesets/changesets) for version management:

### Adding a Changeset

When making changes that should trigger a release:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select affected packages
2. Choose version bump type (major, minor, patch)
3. Write a summary of changes

### Release Types

- **Patch** (0.0.X) - Bug fixes, documentation updates
- **Minor** (0.X.0) - New features, non-breaking changes
- **Major** (X.0.0) - Breaking changes

### Example Changeset

```markdown
---
"@pact-toolbox/transaction": minor
"@pact-toolbox/types": patch
---

Add support for multi-wallet integration. This allows users to connect multiple wallet providers simultaneously and switch between them seamlessly.
```

## Getting Help

### Community

- **GitHub Discussions** - Ask questions and share ideas
- **Issues** - Report bugs and request features
- **Discord** - Join the Kadena Discord for real-time chat

### Maintainer Contact

For urgent issues or security concerns, contact the maintainers directly through GitHub or Kadena Discord.

### Resources

- [Pact Documentation](https://docs.kadena.io/pact)
- [Kadena Developer Portal](https://docs.kadena.io/)
- [Chainweb API Reference](https://api.chainweb.com/openapi)

## License

By contributing to Pact Toolbox, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Pact Toolbox! Your efforts help make Pact smart contract development more accessible and enjoyable for everyone. 🚀
