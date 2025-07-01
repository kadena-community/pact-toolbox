---
title: "CLI"
description: "Command-line interface for Pact smart contract development"
---

# Pact Toolbox CLI

The `pact-toolbox` CLI is a comprehensive command-line interface for Pact smart contract development on the Kadena blockchain. It provides everything you need to build, test, and deploy Pact contracts efficiently.

## Installation

### Global Installation

```bash
# npm
npm install -g pact-toolbox

# pnpm
pnpm add -g pact-toolbox

# yarn
yarn global add pact-toolbox
```

### Project-Local Installation

```bash
# Add as dev dependency
pnpm add -D pact-toolbox

# Run with npx
npx pact-toolbox <command>

# Or with pnpm
pnpm pact-toolbox <command>
```

## Commands Overview

- **`doctor`** - Check system requirements and setup
- **`init`** - Initialize a new Pact project
- **`start`** - Start local development network
- **`test`** - Run Pact contract tests
- **`run`** - Execute scripts and deployments
- **`generate`** - Generate code and boilerplate
- **`prelude`** - Manage Pact prelude deployment

## Command Reference

### `doctor`

Check and fix your development environment:

```bash
pact-toolbox doctor
```

**What it checks:**
- Node.js version (≥22.0.0)
- Pact compiler installation
- Docker availability
- Package manager (pnpm recommended)
- System architecture compatibility

**Features:**
- Automatic Pact installation if missing
- Actionable fix suggestions
- Detailed system report

**Example output:**
```
✓ Node.js v22.3.0 - Compatible
✓ pnpm 9.1.0 - Installed
✗ Pact - Not found
  → Installing Pact compiler...
✓ Docker 24.0.2 - Running
✓ System - darwin arm64 supported

All checks passed! Your system is ready for Pact development.
```

### `init`

Initialize Pact Toolbox in an existing project:

```bash
# Initialize in current directory
pact-toolbox init

# With custom contracts directory
pact-toolbox init --contractsDir ./contracts
```

**Options:**
- `--cwd <path>` - Working directory path (default: current directory)
- `--contractsDir <path>` - Path to contracts directory (default: "pact")

**What it does:**

1. **Installs dependencies:**
   - `@pact-toolbox/chainweb-client` - Chainweb API client
   - `@pact-toolbox/transaction` - Transaction builder
   - `pact-toolbox` - CLI tool (dev dependency)
   - `@pact-toolbox/unplugin` - Bundler plugin (dev dependency)

2. **Creates configuration file:**
   - `pact-toolbox.config.ts` for TypeScript projects
   - `pact-toolbox.config.js` for JavaScript projects

3. **Updates package.json:**
   - Adds `pact:start` script
   - Adds `pact:run` script
   - Adds `pact:prelude` script
   - Adds `pact:types` script
   - Adds `pact:test` script

4. **Updates tsconfig.json:**
   - Adds `.pact-toolbox/pactjs-generated` to types array

5. **Creates example contract:**
   - `hello-world.pact` in contracts directory
   - `hello-world.repl` test file

6. **Downloads preludes:**
   - Fetches standard library contracts

### `start`

Start local development environment:

```bash
# Start with defaults (local network)
pact-toolbox start

# Start specific network
pact-toolbox start devnet

# Quiet mode with tunnel
pact-toolbox start --quiet --tunnel

# Without clipboard copy
pact-toolbox start --no-clipboard
```

**Options:**
- `network` - Network to start (positional argument, default: "local")
- `-q, --quiet` - Silence logs
- `-t, --tunnel` - Start a cloudflare tunnel to the network
- `-c, --clipboard` - Copy the network url to the clipboard (default: true)

**Network Details:**

**DevNet (default)**
- 10 chains (0-9)
- Automatic mining every 5 seconds
- Includes coin contract
- Gas station enabled

**Minimal**
- Single chain (0)
- Instant mining
- Faster startup
- Ideal for unit tests

**Compact**
- 5 chains (0-4)
- Balance between features and performance

### `test`

Run contract tests with REPL and JavaScript/TypeScript support:

```bash
# Run all tests (REPL and JS)
pact-toolbox test

# Watch mode
pact-toolbox test --watch

# REPL tests only
pact-toolbox test --repl --no-js

# With coverage and verbose output
pact-toolbox test --coverage --verbose

# Silent mode
pact-toolbox test --silent
```

**Options:**
- `-w, --watch` - Watch for changes and re-run tests
- `-r, --repl` - Run REPL tests (default: true)
- `-j, --js` - Run JavaScript/TypeScript tests (default: true)
- `-t, --trace` - Enable trace output for REPL tests
- `-c, --coverage` - Enable coverage reporting for REPL tests
- `-v, --verbose` - Enable verbose output
- `-b, --bail` - Stop on first test failure
- `-s, --silent` - Silent mode - suppress output

**Test file formats:**
- `.repl` - REPL-based Pact tests
- `.test.ts` - TypeScript tests (via Vitest)
- `.spec.ts` - Unit tests (via Vitest)

### `run`

Execute scripts and deployments:

```bash
# Run deployment script
pact-toolbox run deploy

# Run custom script
pact-toolbox run scripts/setup.ts

# With network selection
pact-toolbox run deploy --network testnet

# Dry run mode
pact-toolbox run deploy --dry-run
```

**Options:**
- `--network <name>` - Target network
  - `development` - Local DevNet
  - `testnet` - Kadena testnet
  - `mainnet` - Kadena mainnet
- `--dry-run` - Simulate without executing
- `--config <file>` - Custom config file
- `--env <file>` - Environment variables

**Script examples:**

```typescript
// scripts/deploy.ts
import { createTransaction } from '@pact-toolbox/transaction';
import { readFileSync } from 'fs';

export default async function deploy() {
  const contract = readFileSync('./pact/token.pact', 'utf8');
  
  const result = await createTransaction()
    .code(contract)
    .setMeta({ chainId: '0', sender: 'deployer' })
    .sign()
    .submitAndListen();
    
  console.log('Deployed:', result);
}
```

### `generate`

Generate boilerplate code:

```bash
# Generate a module
pact-toolbox generate module token

# Generate a complete contract
pact-toolbox generate contract nft-marketplace

# Generate deployment station
pact-toolbox generate station mainnet-deploy
```

**Subcommands:**

#### `generate module`

Create a new Pact module:

```bash
pact-toolbox generate module [name] [options]
```

Options:
- `--capabilities` - Include capabilities
- `--schema` - Add schema definitions
- `--interfaces` - Implement interfaces
- `--guards` - Add guard functions

Generated file:
```lisp
;; pact/token.pact
(module token GOVERNANCE
  "Token module with transfer functionality"
  
  (defcap GOVERNANCE () true)
  
  (defschema token-schema
    balance:decimal
    guard:guard)
    
  (deftable tokens:{token-schema})
  
  ;; Module implementation...
)
```

#### `generate contract`

Create complete contract with tests:

```bash
pact-toolbox generate contract [name] [options]
```

Options:
- `--type <type>` - Contract type
  - `fungible` - Token contract
  - `nft` - NFT contract
  - `dao` - DAO contract
  - `defi` - DeFi protocol
- `--standard <name>` - Token standard
  - `fungible-v2` - KIP-0005
  - `poly-fungible-v2` - KIP-0013

Creates:
- Contract file (`name.pact`)
- Test file (`name.repl`)
- TypeScript integration (`name.ts`)
- Deployment script

#### `generate station`

Create deployment station:

```bash
pact-toolbox generate station [name]
```

Generates a deployment configuration for multiple networks.

### `prelude`

Download and manage Pact preludes (standard library contracts):

```bash
# Download configured preludes
pact-toolbox prelude

# Use specific network
pact-toolbox prelude --network testnet

# Force re-download
pact-toolbox prelude --force

# Clean cache before downloading
pact-toolbox prelude --clean
```

**Options:**
- `-n, --network <name>` - Network to use for prelude deployment
- `-f, --force` - Force re-download even if preludes are cached
- `-c, --clean` - Clean cache before downloading

**Features:**
- Downloads preludes from configured repositories
- Caches preludes for faster subsequent runs
- Generates init.repl for loading in REPL
- Checksum verification for integrity
- Progress tracking with timing information

## Configuration

### Project Configuration

Create `pact-toolbox.config.ts`:

```typescript
import { defineConfig } from '@pact-toolbox/config';

export default defineConfig({
  // Contract locations
  contracts: {
    include: ['pact/**/*.pact'],
    exclude: ['pact/**/*.repl']
  },
  
  // Network configuration
  networks: {
    development: {
      type: 'devnet',
      port: 8080,
      miningDelay: 5
    },
    testnet: {
      type: 'chainweb',
      networkId: 'testnet04',
      apiUrl: 'https://api.testnet.chainweb.com'
    },
    mainnet: {
      type: 'chainweb',
      networkId: 'mainnet01',
      apiUrl: 'https://api.chainweb.com'
    }
  },
  
  // Testing configuration
  test: {
    include: ['**/*.repl', '**/*.test.ts'],
    coverage: {
      enabled: true,
      threshold: 80
    }
  },
  
  // Code generation
  generate: {
    outputDir: 'src/contracts',
    typescript: true,
    framework: 'react'
  }
});
```

### Environment Variables

```bash
# .env.local
PACT_TOOLBOX_NETWORK=development
PACT_TOOLBOX_CHAIN_ID=0
PACT_TOOLBOX_LOG_LEVEL=info
PACT_TOOLBOX_DOCKER=true
```

## Advanced Usage

### Custom Commands

Add custom commands via plugins:

```typescript
// pact-toolbox.config.ts
import { defineConfig } from '@pact-toolbox/config';

export default defineConfig({
  plugins: [
    {
      name: 'custom-commands',
      commands: {
        'validate': {
          description: 'Validate all contracts',
          action: async (args) => {
            // Implementation
          }
        }
      }
    }
  ]
});
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: Test and Deploy

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pact-toolbox doctor
      - run: pact-toolbox test --coverage
      - run: pact-toolbox run deploy --network testnet --dry-run
```

#### GitLab CI

```yaml
stages:
  - test
  - deploy

test:
  stage: test
  image: node:22
  script:
    - npm install -g pnpm pact-toolbox
    - pnpm install
    - pact-toolbox test --reporter junit
  artifacts:
    reports:
      junit: test-results.xml

deploy:
  stage: deploy
  script:
    - pact-toolbox run deploy --network $CI_ENVIRONMENT_NAME
  only:
    - main
```

### Docker Usage

Run CLI in Docker:

```bash
# Build image
docker build -t pact-toolbox .

# Run commands
docker run -v $(pwd):/app pact-toolbox test
docker run -v $(pwd):/app pact-toolbox run deploy
```

### Debugging

Enable debug output:

```bash
# Debug logging
DEBUG=pact-toolbox:* pact-toolbox test

# Verbose output
pact-toolbox test --verbose

# Trace mode
pact-toolbox test --trace
```

## Common Workflows

### New Project Setup

```bash
# 1. Create project
pact-toolbox init my-dapp

# 2. Navigate to project
cd my-dapp

# 3. Start development network
pact-toolbox start

# 4. In another terminal, run tests
pact-toolbox test --watch

# 5. Deploy contracts
pact-toolbox run deploy
```

### Contract Development

```bash
# 1. Generate new contract
pact-toolbox generate contract token --type fungible

# 2. Start dev environment
pact-toolbox start

# 3. Watch tests
pact-toolbox test token.repl --watch

# 4. Deploy to local
pact-toolbox run scripts/deploy-token.ts
```

### Production Deployment

```bash
# 1. Run all tests
pact-toolbox test --coverage

# 2. Dry run deployment
pact-toolbox run deploy --network mainnet --dry-run

# 3. Actual deployment
pact-toolbox run deploy --network mainnet

# 4. Verify deployment
pact-toolbox run verify --network mainnet
```

## Troubleshooting

### Common Issues

**Command not found**

```bash
# Check installation
npm list -g pact-toolbox

# Reinstall
npm install -g pact-toolbox
```

**Port already in use**

```bash
# Use different port
pact-toolbox start --port 8081

# Or kill existing process
lsof -ti:8080 | xargs kill
```

**Docker not available**

```bash
# Start Docker
open -a Docker  # macOS
sudo systemctl start docker  # Linux

# Or use native mode
pact-toolbox start --native
```

**Pact compiler missing**

```bash
# Auto-install
pact-toolbox doctor

# Or manual install
npx pactup install latest
```

### Debug Mode

```bash
# Maximum verbosity
pact-toolbox test -vvv

# Debug specific module
DEBUG=pact-toolbox:network pact-toolbox start

# Save debug log
pact-toolbox test --verbose 2> debug.log
```

## Best Practices

1. **Use configuration files** - Define settings in `pact-toolbox.config.ts`
2. **Version control scripts** - Keep deployment scripts in `scripts/`
3. **Test before deploying** - Always run tests and dry-run
4. **Use environment variables** - For sensitive data and network selection
5. **Automate with CI/CD** - Integrate testing and deployment