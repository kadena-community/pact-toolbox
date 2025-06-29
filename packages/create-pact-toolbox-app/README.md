# create-pact-toolbox-app

Create Pact Toolbox apps with one command. This package provides a CLI tool to quickly scaffold new applications using the Pact Toolbox development framework for building Pact smart contracts on the Kadena blockchain.

## Quick Start

```bash
# Using npm
npm create pact-toolbox-app@latest my-app

# Using pnpm (recommended)
pnpm create pact-toolbox-app my-app

# Using yarn
yarn create pact-toolbox-app my-app
```

## Usage

### Interactive Mode

Run the command without arguments to be prompted for project details:

```bash
pnpm create pact-toolbox-app
```

You'll be asked to:

- Choose a project name
- Select a template

### CLI Arguments

You can also specify options directly:

```bash
pnpm create pact-toolbox-app my-app --template default
```

#### Options

- `--name, -n <name>` - The name of the project to create
- `--template, -t <template>` - The template to use (currently: `default`)
- `--git, -g` - Initialize a git repository (default: `true`)
- `--no-git` - Skip git repository initialization

### Examples

```bash
# Create with specific name and template
pnpm create pact-toolbox-app todo-app --template default

# Create without git initialization
pnpm create pact-toolbox-app my-app --no-git

# Interactive mode
pnpm create pact-toolbox-app
```

## What's Included

The generated project includes:

### Frontend Framework

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Vitest** for testing with React Testing Library

### Pact Development Tools

- **Pact Toolbox CLI** for contract development
- **Sample Pact contracts** (hello-world, todos)
- **TypeScript type generation** from Pact contracts
- **Wallet integration** with multiple providers
- **Transaction builder** for easy blockchain interactions

### Development Experience

- **Hot reload** for Pact contracts during development
- **REPL-based testing** for Pact contracts
- **TypeScript** with strict configuration
- **ESLint & Prettier** for code quality
- **Git repository** automatically initialized

### Key Files

- `pact-toolbox.config.ts` - Configuration for Pact Toolbox
- `pact/` - Directory containing Pact smart contracts
- `src/api/` - API layer for blockchain interactions
- `src/components/` - React components
- `scripts/test.ts` - Test deployment script

## Getting Started

After creating your project:

1. **Install dependencies:**

   ```bash
   cd my-app
   pnpm install
   ```

2. **Start development server:**

   ```bash
   pnpm dev
   ```

3. **Start Pact development environment:**

   ```bash
   pnpm pact:start
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

## Available Scripts

The generated project includes these scripts:

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm test` - Run Pact contract tests
- `pnpm type-check` - TypeScript type checking
- `pnpm pact:start` - Start local Pact development network
- `pnpm pact:prelude` - Generate TypeScript types from Pact contracts
- `pnpm pact:run` - Execute Pact scripts

## Templates

### Default Template

The `default` template includes:

- React + TypeScript frontend
- Todo MVC example application
- Sample Pact contracts for learning
- Wallet integration setup
- Complete testing environment

## Requirements

- **Node.js** >=22.0.0
- **pnpm** (recommended) or npm/yarn
- **Git** (optional, for repository initialization)

## About Pact Toolbox

Pact Toolbox is a comprehensive development framework for building, testing, and deploying Pact smart contracts on the Kadena blockchain. It provides:

- Type-safe contract development
- Hot reload during development
- Multi-wallet support
- Testing utilities
- Deployment tools
- Network abstractions

Learn more at the [Pact Toolbox documentation](https://github.com/kadena-community/pact-toolbox).

## Contributing

Contributions are welcome! Please see the [contributing guidelines](../../CONTRIBUTING.md) in the main repository.

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
