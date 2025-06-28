# Pact Toolbox CLI

A comprehensive command-line interface for Pact smart contract development on the Kadena blockchain. This CLI provides everything you need to build, test, and deploy Pact contracts efficiently.

## Installation

```bash
# Install globally
npm install -g pact-toolbox

# Or use with npx
npx pact-toolbox <command>

# Or with pnpm
pnpm dlx pact-toolbox <command>
```

## Quick Start

```bash
# Check system dependencies
pact-toolbox doctor

# Initialize a new project
pact-toolbox init my-project

# Start local development network
pact-toolbox start

# Generate TypeScript types from contracts
pact-toolbox prelude

# Run tests
pact-toolbox test

# Deploy contracts
pact-toolbox run deploy
```

## Commands

### `doctor`

Check system dependencies and configuration for Pact development.

```bash
pact-toolbox doctor
```

**What it checks:**

- Node.js version (≥22.0.0)
- Pact compiler installation
- Docker availability
- pnpm installation
- System configuration

**Features:**

- Automatic Pact installation if missing
- Actionable recommendations for issues
- Comprehensive system health report

### `init`

Initialize a new Pact project with templates and boilerplate code.

```bash
pact-toolbox init [project-name]
pact-toolbox init my-dapp --template basic
```

**Options:**

- `--template`: Choose project template (basic, advanced, defi)
- `--git`: Initialize git repository (default: true)
- `--install`: Install dependencies automatically (default: true)

### `start`

Start local Pact development network for testing and development.

```bash
pact-toolbox start
pact-toolbox start --network devnet
pact-toolbox start --port 8080
```

**Options:**

- `--network`: Network type (devnet, testnet, minimal)
- `--port`: Port for the network (default: 8080)
- `--clean`: Start with clean state
- `--docker`: Use Docker for network (default: true)

### `prelude`

Generate TypeScript type definitions from Pact contracts.

```bash
pact-toolbox prelude
pact-toolbox prelude --watch
pact-toolbox prelude --output ./types
```

**Options:**

- `--watch`: Watch for changes and regenerate types
- `--output`: Output directory for generated types
- `--include`: Glob pattern for contract files to include

**Features:**

- Hot reload in development
- Type-safe contract interactions
- IntelliSense support in IDEs

### `run`

Execute Pact scripts and deployment workflows.

```bash
pact-toolbox run deploy
pact-toolbox run script ./scripts/setup.ts
pact-toolbox run --network testnet deploy
```

**Options:**

- `--network`: Target network for execution
- `--dry-run`: Simulate execution without applying changes
- `--config`: Custom configuration file

### `test`

Run Pact contract tests with REPL support.

```bash
pact-toolbox test
pact-toolbox test --watch
pact-toolbox test --pattern "*.repl"
```

**Options:**

- `--watch`: Watch mode for continuous testing
- `--pattern`: Glob pattern for test files
- `--coverage`: Generate test coverage report
- `--reporter`: Test reporter (default, json, xml)

**Features:**

- REPL-based testing
- Property-based testing
- Integration test support
- Coverage reporting

### `generate`

Generate boilerplate code for contracts, modules, and more.

```bash
pact-toolbox generate module MyModule
pact-toolbox generate contract Token
pact-toolbox generate station MyStation
```

**Subcommands:**

- `module`: Generate a new Pact module
- `contract`: Generate a complete contract with tests
- `station`: Generate a deployment station

## Configuration

The CLI uses `pact-toolbox.config.ts` for project configuration:

```typescript
import { defineConfig } from "@pact-toolbox/config";

export default defineConfig({
  networks: {
    development: {
      type: "devnet",
      port: 8080,
    },
    testnet: {
      type: "chainweb",
      networkId: "testnet04",
      chainIds: ["0", "1"],
    },
  },
  contracts: {
    include: ["pact/**/*.pact"],
    output: "pact-types",
  },
  testing: {
    include: ["**/*.repl"],
    coverage: true,
  },
});
```

## Development Workflow

1. **Setup**: Run `pact-toolbox doctor` to verify system requirements
2. **Initialize**: Create new project with `pact-toolbox init`
3. **Develop**: Start local network with `pact-toolbox start`
4. **Code**: Write Pact contracts in the `pact/` directory
5. **Types**: Generate TypeScript types with `pact-toolbox prelude`
6. **Test**: Run tests with `pact-toolbox test`
7. **Deploy**: Deploy to networks with `pact-toolbox run deploy`

## Advanced Usage

### Custom Networks

```typescript
// pact-toolbox.config.ts
export default defineConfig({
  networks: {
    custom: {
      type: "chainweb",
      networkId: "mainnet01",
      chainIds: ["0", "1", "2"],
      rpcUrl: "https://api.chainweb.com",
    },
  },
});
```

### Testing Strategies

```bash
# Unit tests only
pact-toolbox test --pattern "**/*.repl"

# Integration tests
pact-toolbox test --pattern "**/integration/*.repl"

# Performance tests
pact-toolbox test --pattern "**/perf/*.repl" --timeout 30000
```

### Deployment Workflows

```bash
# Development deployment
pact-toolbox run deploy --network development

# Staging deployment with verification
pact-toolbox run deploy --network testnet --verify

# Production deployment
pact-toolbox run deploy --network mainnet --confirm
```

## Environment Variables

- `PACT_TOOLBOX_CONFIG`: Path to configuration file
- `PACT_TOOLBOX_NETWORK`: Default network for operations
- `PACT_TOOLBOX_LOG_LEVEL`: Logging level (debug, info, warn, error)
- `PACT_TOOLBOX_CACHE_DIR`: Directory for CLI cache files

## Troubleshooting

### Common Issues

**Command not found**

```bash
# Make sure pact-toolbox is installed globally
npm list -g pact-toolbox

# Or use npx
npx pact-toolbox doctor
```

**Docker issues**

```bash
# Check Docker status
docker --version
docker ps

# Restart Docker if needed
```

**Pact compiler missing**

```bash
# Install Pact compiler
pact-toolbox doctor
# Follow the prompts to install
```

### Debug Mode

```bash
# Enable debug logging
PACT_TOOLBOX_LOG_LEVEL=debug pact-toolbox <command>

# Verbose output
pact-toolbox <command> --verbose
```

## Contributing

This CLI is part of the Pact Toolbox monorepo. See the [contributing guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT

## Support

- [GitHub Issues](https://github.com/kadena-community/pact-toolbox/issues)

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
