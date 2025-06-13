# create-pact-toolbox-app

> Scaffold a new Pact Toolbox application with a single command

## Overview

`create-pact-toolbox-app` is a scaffolding tool that helps you quickly create a new Pact smart contract development project. It sets up a modern development environment with React, TypeScript, Vite, and all the necessary Pact Toolbox integrations, allowing you to start building immediately.

## Usage

Create a new Pact Toolbox application using one of the following commands:

```bash
# NPM
npx create-pact-toolbox-app my-app

# PNPM (recommended)
pnpm create pact-toolbox-app my-app

# Yarn
yarn create pact-toolbox-app my-app
```

## Features

- ⚛️ **React + TypeScript** - Modern frontend stack with type safety
- ⚡ **Vite** - Lightning-fast development server and build tool
- 🔧 **Pre-configured** - Pact Toolbox integration out of the box
- 📝 **Sample Contracts** - Working examples to learn from
- 🧪 **Testing Setup** - Unit tests and REPL tests configured
- 🎨 **Hot Module Replacement** - Instant feedback during development
- 🚀 **Production Ready** - Optimized build configuration
- 📦 **Type Generation** - Automatic TypeScript types from Pact contracts

## Command Options

```bash
create-pact-toolbox-app [project-name] [options]

Arguments:
  project-name              Name of your project (default: "my-pact-app")

Options:
  -t, --template <name>     Project template to use (default: "default")
  -g, --git                 Initialize git repository (default: true)
  --no-git                  Skip git initialization
  -h, --help               Display help information
  -v, --version            Display version number
```

## Interactive Mode

If you run the command without arguments, it will guide you through an interactive setup:

```bash
npx create-pact-toolbox-app
```

You'll be prompted for:
1. **Project name** - The name of your new application
2. **Template** - Choose from available templates
3. **Git initialization** - Whether to initialize a git repository

## Project Structure

The generated project includes:

```
my-pact-app/
├── pact/                    # Pact contracts and tests
│   ├── hello-world.pact     # Sample hello-world contract
│   ├── hello-world.repl     # REPL tests for hello-world
│   ├── todos.pact          # Sample todos contract
│   └── todos.repl          # REPL tests for todos
├── public/                  # Static assets
│   └── kadena.svg          # Kadena logo
├── scripts/                 # Utility scripts
│   └── test.ts             # Custom test runner
├── src/                     # Application source code
│   ├── api/                # API layer for contract interaction
│   │   ├── api.ts          # Contract API implementation
│   │   ├── api.spec.ts     # API unit tests
│   │   └── queryClient.ts  # React Query configuration
│   ├── components/         # React components
│   │   ├── TodoAddForm.tsx # Add todo form component
│   │   ├── TodoEditForm.tsx # Edit todo form component
│   │   ├── TodoItem.tsx    # Individual todo component
│   │   └── TodoList.tsx    # Todo list component
│   ├── App.css             # Application styles
│   ├── App.tsx             # Main application component
│   ├── index.css           # Global styles
│   ├── main.tsx            # Application entry point
│   └── vite-env.d.ts       # Vite type definitions
├── .gitignore              # Git ignore patterns
├── index.html              # HTML entry point
├── package.json            # Project dependencies and scripts
├── pact-toolbox.config.ts  # Pact Toolbox configuration
├── README.md               # Project documentation
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # TypeScript config for Node.js
└── vite.config.ts          # Vite configuration
```

## Available Scripts

The generated project includes several npm scripts:

### Development

```bash
# Start development server
pnpm dev

# Start Pact development server
pnpm pact:start

# Run development server and Pact server concurrently
pnpm start
```

### Building

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Testing

```bash
# Run all tests (REPL + Vitest)
pnpm test

# Run only REPL tests
pnpm test:repl

# Run only Vitest tests
pnpm test:unit

# Run tests in watch mode
pnpm test:watch
```

### Pact Commands

```bash
# Download and deploy preludes
pnpm pact:prelude

# Run a Pact script
pnpm pact:run <script-name>

# Execute Pact code
pnpm pact:exec <code>
```

### Code Quality

```bash
# Type check TypeScript
pnpm typecheck

# Lint code
pnpm lint

# Format code
pnpm format
```

## Sample Application

The default template includes a fully functional Todo application that demonstrates:

### Smart Contract Features
- Creating todos with unique IDs
- Reading all todos or by ID
- Updating todo content and completion status
- Deleting todos
- Owner-based access control

### Frontend Features
- React components with TypeScript
- React Query for data fetching and caching
- Optimistic updates for better UX
- Form handling with validation
- Error handling and loading states

### Development Features
- Hot module replacement
- Automatic type generation from Pact contracts
- REPL tests for contract testing
- Unit tests for frontend code

## Configuration

### Pact Toolbox Configuration

The `pact-toolbox.config.ts` file configures your development environment:

```typescript
import { defineConfig } from "pact-toolbox";

export default defineConfig({
  // Directory containing Pact contracts
  contractsDir: "./pact",
  
  // Enable prelude deployment
  deployPreludes: true,
  
  // Network configurations
  network: "pactServer",
  networks: {
    pactServer: {
      type: "pact-server",
      url: "http://localhost:9001"
    },
    devnet: {
      type: "devnet",
      url: "http://localhost:8080"
    },
    testnet: {
      type: "chainweb",
      networkId: "testnet04",
      apiHost: "https://api.testnet.chainweb.com"
    },
    mainnet: {
      type: "chainweb",
      networkId: "mainnet01",
      apiHost: "https://api.chainweb.com"
    }
  }
});
```

### Vite Configuration

The `vite.config.ts` includes the Pact Toolbox plugin:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import PactToolbox from "@pact-toolbox/unplugin/vite";

export default defineConfig({
  plugins: [
    react(),
    PactToolbox() // Enables Pact contract imports
  ]
});
```

## Customizing the Template

After creating your project, you can customize it:

### Adding New Contracts

1. Create a new `.pact` file in the `pact/` directory
2. Import it in your TypeScript code:
   ```typescript
   import { myContract } from "../pact/my-contract.pact";
   ```
3. TypeScript types will be automatically generated

### Modifying Network Configuration

Edit `pact-toolbox.config.ts` to add or modify networks:

```typescript
networks: {
  custom: {
    type: "chainweb",
    networkId: "custom-network",
    apiHost: "https://custom.example.com"
  }
}
```

### Changing Build Configuration

Modify `vite.config.ts` for custom build settings:

```typescript
export default defineConfig({
  plugins: [react(), PactToolbox()],
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  }
});
```

## Deployment

To deploy your application:

1. **Build the application:**
   ```bash
   pnpm build
   ```

2. **Deploy contracts to your target network:**
   ```bash
   pnpm pact:deploy --network testnet
   ```

3. **Deploy the frontend:**
   The `dist/` folder contains static files that can be deployed to any static hosting service (Vercel, Netlify, AWS S3, etc.)

## Troubleshooting

### Common Issues

1. **"Port already in use"**
   - The development server (default: 5173) or Pact server (9001) port is occupied
   - Solution: Kill the process or change the port in configuration

2. **"Cannot find module '../pact/contract.pact'"**
   - The Pact contract file doesn't exist
   - Solution: Ensure the contract file exists in the `pact/` directory

3. **"Pact server not responding"**
   - The Pact development server isn't running
   - Solution: Run `pnpm pact:start` or `pnpm start`

4. **Type generation issues**
   - Types aren't being generated from Pact contracts
   - Solution: Restart the development server or check for syntax errors in contracts

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Enable debug mode
DEBUG=pact-toolbox:* pnpm dev

# Verbose output
VERBOSE=true pnpm build
```

## Next Steps

After creating your project:

1. **Explore the sample contracts** in the `pact/` directory
2. **Run the tests** with `pnpm test` to see how testing works
3. **Start the development server** with `pnpm dev`
4. **Modify the sample application** to build your own features
5. **Read the Pact documentation** to learn more about smart contract development

## Contributing

To contribute to the templates or scaffolding tool:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

- **Documentation**: [pact-toolbox.kadena.io](https://pact-toolbox.kadena.io)
- **Issues**: [GitHub Issues](https://github.com/kadena/pact-toolbox/issues)
- **Discord**: [Kadena Discord](https://discord.gg/kadena)