# @pact-toolbox/init

> Add Pact Toolbox to your existing JavaScript/TypeScript project

## Overview

The `@pact-toolbox/init` package provides utilities to integrate Pact smart contract development capabilities into existing projects. Unlike `create-pact-toolbox-app` which scaffolds new projects, this package retrofits your current project with Pact Toolbox functionality.

## Installation

```bash
npm install --save-dev @pact-toolbox/init
# or
pnpm add -D @pact-toolbox/init
# or
yarn add -D @pact-toolbox/init
```

## Usage

### Programmatic API

```typescript
import { initToolbox } from '@pact-toolbox/init';

// Initialize Pact Toolbox in your project
await initToolbox({
  contractsDir: './pact',      // Directory for Pact contracts
  skipInstall: false,          // Skip dependency installation
  packageManager: 'pnpm'       // Force specific package manager
});
```

### CLI Usage

The package is typically used through the main Pact Toolbox CLI:

```bash
# Initialize Pact Toolbox in current directory
pact-toolbox init

# Specify contracts directory
pact-toolbox init --contracts-dir ./contracts

# Skip dependency installation
pact-toolbox init --skip-install
```

## Features

- =æ **Dependency Management** - Automatically installs required Pact packages
- ™ **Configuration Generation** - Creates `pact-toolbox.config.js/ts`
- =Ý **NPM Scripts** - Adds helpful Pact development scripts
- =' **TypeScript Integration** - Updates tsconfig.json for Pact types
- <¨ **Vite Plugin** - Adds Pact plugin to existing Vite config
- =Ä **Sample Contracts** - Creates hello-world example to get started
- = **Auto-Detection** - Detects project type and package manager

## What Gets Added

### Dependencies

**Production:**
- `@kadena/client` - Kadena client library
- `@pact-toolbox/client` - High-level Pact client

**Development:**
- `pact-toolbox` - Main CLI and development tools
- `@pact-toolbox/unplugin` - Build tool integration

### Configuration File

Creates `pact-toolbox.config.js` or `pact-toolbox.config.ts`:

```typescript
import { defineConfig } from 'pact-toolbox';

export default defineConfig({
  // Contracts directory
  contractsDir: './pact',
  
  // Default network
  network: 'local',
  
  // Network configurations
  networks: {
    local: {
      type: 'pact-server',
      name: 'local',
      pactServer: {
        url: 'http://localhost:9001',
        port: 9001
      }
    },
    devnet: {
      type: 'devnet',
      name: 'devnet',
      devnet: {
        url: 'http://localhost:8080',
        containerConfig: {
          onDemand: true
        }
      }
    },
    testnet: {
      type: 'chainweb',
      name: 'testnet',
      chainweb: {
        networkId: 'testnet04',
        apiHost: 'https://api.testnet.chainweb.com'
      }
    },
    mainnet: {
      type: 'chainweb',
      name: 'mainnet',
      chainweb: {
        networkId: 'mainnet01',
        apiHost: 'https://api.chainweb.com'
      }
    }
  }
});
```

### NPM Scripts

Adds the following scripts to `package.json`:

```json
{
  "scripts": {
    "pact:start": "pact-toolbox start",
    "pact:run": "pact-toolbox run",
    "pact:prelude": "pact-toolbox prelude fetch",
    "pact:types": "pact-toolbox types",
    "pact:test": "pact-toolbox test"
  }
}
```

### TypeScript Configuration

Updates `tsconfig.json` to include generated types:

```json
{
  "include": [
    "src",
    ".pact-toolbox/pactjs-generated"
  ]
}
```

### Sample Contract

Creates a hello-world example:

**`pact/hello-world.pact`:**
```lisp
(module hello-world GOVERNANCE
  (defcap GOVERNANCE () true)
  
  (defun say-hello (name:string)
    (format "Hello, {}!" [name]))
)
```

**`pact/hello-world.repl`:**
```lisp
(load "hello-world.pact")

(say-hello "World")
```

## API Reference

### `initToolbox(options)`

Initializes Pact Toolbox in the current project.

```typescript
interface InitOptions {
  // Directory for Pact contracts (default: './pact')
  contractsDir?: string;
  
  // Skip dependency installation (default: false)
  skipInstall?: boolean;
  
  // Force specific package manager (auto-detected by default)
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  
  // Working directory (default: process.cwd())
  cwd?: string;
}
```

### `updateViteConfig(configPath)`

Updates an existing Vite configuration to include the Pact plugin.

```typescript
// Before
export default {
  plugins: [react()]
};

// After
export default {
  plugins: [
    react(),
    PactToolbox()
  ]
};
```

### `getPackageManagerCommands(packageManager)`

Returns commands for the detected package manager.

```typescript
const commands = getPackageManagerCommands('pnpm');
// {
//   install: ['pnpm', 'install'],
//   add: ['pnpm', 'add'],
//   addDev: ['pnpm', 'add', '-D']
// }
```

## Integration Examples

### Adding to React Project

```bash
# In your React project directory
pact-toolbox init

# Start development
npm run pact:start
npm run dev
```

### Adding to Vue Project

```bash
# Initialize Pact Toolbox
pact-toolbox init --contracts-dir ./contracts

# Update vite.config.js manually to add plugin
# import PactToolbox from '@pact-toolbox/unplugin/vite'
# plugins: [..., PactToolbox()]
```

### Adding to Next.js Project

```bash
# Initialize
pact-toolbox init

# Add to next.config.js
const PactToolbox = require('@pact-toolbox/unplugin/webpack');

module.exports = {
  webpack: (config) => {
    config.plugins.push(PactToolbox());
    return config;
  }
};
```

### Adding to Plain Node.js Project

```bash
# Initialize with CommonJS config
pact-toolbox init

# Use in your code
const { PactToolboxClient } = require('@pact-toolbox/client');
```

## Project Type Detection

The package automatically detects your project type:

- **ESM vs CommonJS**: Checks `package.json` type field
- **TypeScript**: Looks for `tsconfig.json`
- **Vite**: Searches for `vite.config.js/ts`
- **Package Manager**: Checks for lock files

## Customization

### Custom Configuration

After initialization, modify `pact-toolbox.config.js`:

```javascript
export default defineConfig({
  // Add custom networks
  networks: {
    custom: {
      type: 'chainweb',
      name: 'custom-network',
      chainweb: {
        networkId: 'custom',
        apiHost: 'https://custom.example.com'
      }
    }
  },
  
  // Add preludes
  preludes: ['kadena/chainweb'],
  
  // Custom settings
  enableDevAccountFunding: true
});
```

### Build Tool Integration

**Webpack:**
```javascript
const PactToolbox = require('@pact-toolbox/unplugin/webpack');

module.exports = {
  plugins: [
    PactToolbox()
  ]
};
```

**Rollup:**
```javascript
import PactToolbox from '@pact-toolbox/unplugin/rollup';

export default {
  plugins: [
    PactToolbox()
  ]
};
```

**ESBuild:**
```javascript
import PactToolbox from '@pact-toolbox/unplugin/esbuild';

require('esbuild').build({
  plugins: [PactToolbox()]
});
```

## Troubleshooting

### Common Issues

1. **"Cannot find module 'pact-toolbox'"**
   - Run `npm install` after initialization
   - Check if dependencies were installed correctly

2. **"Pact types not recognized"**
   - Run `npm run pact:types` to generate types
   - Restart TypeScript language server

3. **"Port 9001 already in use"**
   - Another Pact server is running
   - Change port in configuration

4. **"Module not found: @pact-toolbox/unplugin/vite"**
   - Ensure dependencies are installed
   - Check import path matches your build tool

### Manual Setup

If automatic setup fails, manually add:

1. **Install dependencies:**
   ```bash
   npm install @kadena/client @pact-toolbox/client
   npm install -D pact-toolbox @pact-toolbox/unplugin
   ```

2. **Create config file:**
   ```javascript
   // pact-toolbox.config.js
   import { defineConfig } from 'pact-toolbox';
   export default defineConfig({
     contractsDir: './pact'
   });
   ```

3. **Add build plugin:**
   ```javascript
   // vite.config.js
   import PactToolbox from '@pact-toolbox/unplugin/vite';
   plugins: [PactToolbox()]
   ```

## Migration Guide

### From Manual Pact Setup

If you're currently using Pact without Pact Toolbox:

1. **Backup your contracts**
2. **Run init command:**
   ```bash
   pact-toolbox init --contracts-dir ./your-contracts
   ```
3. **Update imports:**
   ```typescript
   // Before
   import { Pact } from '@kadena/client';
   
   // After
   import { PactToolboxClient } from '@pact-toolbox/client';
   ```

### From Older Versions

1. **Remove old dependencies:**
   ```bash
   npm uninstall old-pact-packages
   ```

2. **Initialize fresh:**
   ```bash
   pact-toolbox init
   ```

3. **Update configuration format**

## Best Practices

1. **Keep contracts organized:**
   ```
   pact/
      modules/
      tests/
      preludes/
   ```

2. **Use type generation:**
   ```bash
   npm run pact:types -- --watch
   ```

3. **Version control configuration:**
   ```gitignore
   # Don't commit generated files
   .pact-toolbox/
   ```

4. **Environment-specific configs:**
   ```javascript
   export default defineConfig({
     network: process.env.PACT_NETWORK || 'local'
   });
   ```

## Support

- **Documentation**: [pact-toolbox.kadena.io](https://pact-toolbox.kadena.io)
- **Issues**: [GitHub Issues](https://github.com/kadena/pact-toolbox/issues)
- **Discord**: [Kadena Discord](https://discord.gg/kadena)