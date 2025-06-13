# @pact-toolbox/unplugin

> Universal plugin for seamless Pact smart contract development across all major JavaScript bundlers

## Overview

The `@pact-toolbox/unplugin` package provides a universal plugin that enables Pact smart contract development in any JavaScript bundler. It automatically transforms `.pact` files into JavaScript modules with full TypeScript support, manages local development networks, and provides hot module replacement for rapid iteration.

## Installation

```bash
npm install -D @pact-toolbox/unplugin
# or
pnpm add -D @pact-toolbox/unplugin
```

## Features

- **Universal Plugin** - Works with Vite, Webpack, Rollup, esbuild, and 7+ other bundlers
- **Rust-Powered Parser** - High-performance Pact parsing using tree-sitter
- **TypeScript Generation** - Automatic type definitions from Pact contracts
- **Hot Module Replacement** - Live contract updates during development
- **Network Management** - Automatic local blockchain startup and management
- **Auto-Deployment** - Contracts deployed/upgraded on file changes
- **Smart Caching** - Optimized builds with transformation caching
- **Developer Experience** - Clear error messages and debugging support

## Quick Start

### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import pactPlugin from "@pact-toolbox/unplugin/vite";

export default defineConfig({
  plugins: [
    pactPlugin({
      startNetwork: true, // Start local network in dev mode
      onReady: (runtime) => {
        console.log("Pact runtime ready:", runtime);
      },
    }),
  ],
});
```

### Webpack

```javascript
// webpack.config.js
const PactPlugin = require("@pact-toolbox/unplugin/webpack");

module.exports = {
  plugins: [
    new PactPlugin({
      startNetwork: true,
    }),
  ],
};
```

### Rollup

```javascript
// rollup.config.js
import pactPlugin from "@pact-toolbox/unplugin/rollup";

export default {
  plugins: [
    pactPlugin({
      startNetwork: false, // Disable for production builds
    }),
  ],
};
```

### Next.js

```javascript
// next.config.js
const pactPlugin = require("@pact-toolbox/unplugin/next");

module.exports = pactPlugin({
  startNetwork: true,
})({
  // Your Next.js config
});
```

### Nuxt

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    [
      "@pact-toolbox/unplugin/nuxt",
      {
        startNetwork: true,
      },
    ],
  ],
});
```

## Usage

### Writing Pact Contracts

Create `.pact` files in your project:

```pact
;; contracts/hello.pact
(module hello GOV
  (defcap GOV () true)

  (defschema message-schema
    @doc "Schema for messages"
    content:string
    author:string
    timestamp:time)

  (deftable messages:{message-schema})

  (defun say-hello:string (name:string)
    @doc "Returns a greeting"
    (format "Hello, {}!" [name]))

  (defun post-message (content:string author:string)
    @doc "Post a new message"
    (insert messages (tx-hash) {
      "content": content,
      "author": author,
      "timestamp": (at "block-time" (chain-data))
    }))
)

(create-table messages)
```

### Importing in JavaScript/TypeScript

```typescript
// Import the generated module
import { hello } from "./contracts/hello.pact";

// Use the exported functions
async function greet() {
  // Functions are automatically typed
  const greeting = hello.sayHello("Alice");
  console.log(greeting); // "Hello, Alice!"

  // Post a message
  await hello.postMessage("Hello Pact!", "Alice");
}

// Access module metadata
console.log(hello.__module); // Module information
console.log(hello.__capabilities); // Available capabilities
```

### Generated TypeScript Types

The plugin automatically generates TypeScript definitions:

```typescript
// Generated hello.pact.d.ts
export interface MessageSchema {
  content: string;
  author: string;
  timestamp: string;
}

export interface HelloModule {
  sayHello(name: string): string;
  postMessage(content: string, author: string): Promise<void>;

  // Module metadata
  __module: {
    name: string;
    namespace: string | null;
    interfaces: string[];
  };

  // Capabilities
  __capabilities: {
    GOV: () => void;
  };

  // Schema definitions
  __schemas: {
    "message-schema": MessageSchema;
  };
}

export const hello: HelloModule;
```

## Configuration

### Plugin Options

```typescript
interface PluginOptions {
  /**
   * Whether to start a local Pact network in development mode
   * @default true
   */
  startNetwork?: boolean;

  /**
   * Custom PactToolboxClient instance
   * @default undefined (creates new instance)
   */
  client?: PactToolboxClient;

  /**
   * Callback when the runtime is ready
   */
  onReady?: (runtime: PactToolboxRuntime) => void;

  /**
   * Custom transformation options
   */
  transform?: {
    /**
     * Generate TypeScript types
     * @default true
     */
    generateTypes?: boolean;

    /**
     * Parser pool size for concurrent transformations
     * @default 4
     */
    parserPoolSize?: number;
  };
}
```

### Environment Variables

```bash
# Disable network startup
PACT_TOOLBOX_NO_NETWORK=true

# Custom network configuration
PACT_NETWORK_ID=testnet04
PACT_RPC_URL=https://api.testnet.chainweb.com

# Enable debug logging
DEBUG=pact-toolbox:*
```

## Development Features

### Hot Module Replacement

The plugin supports HMR for rapid development:

1. **File Watching**: Monitors `.pact` files for changes
2. **Incremental Updates**: Only reprocesses changed files
3. **Live Deployment**: Automatically deploys changes to local network
4. **State Preservation**: Maintains blockchain state between reloads

```typescript
// HMR is automatic with Vite
if (import.meta.hot) {
  import.meta.hot.accept("./contracts/hello.pact", (newModule) => {
    console.log("Contract updated:", newModule);
  });
}
```

### Network Management

The plugin automatically manages a local Pact network:

```typescript
// Access network configuration
const config = window.__PACT_TOOLBOX_NETWORK_CONFIG__;
console.log("Network:", config.networkId);
console.log("RPC URL:", config.rpcUrl);

// Use the global client
import { getGlobalClient } from "@pact-toolbox/unplugin/runtime";

const client = await getGlobalClient();
const result = await client.local("(+ 1 2)");
console.log(result); // 3
```

### Contract Deployment

Contracts are automatically deployed during development:

1. **Initial Deployment**: Uses namespace and keyset from config
2. **Updates**: Detects existing contracts and upgrades them
3. **Error Recovery**: Handles deployment failures gracefully
4. **Status Tracking**: Maintains deployment state in cache

## Advanced Usage

### Custom Bundler Integration

```typescript
// Use the core factory for custom integrations
import { unpluginFactory } from "@pact-toolbox/unplugin";

const myPlugin = unpluginFactory({
  name: "my-pact-plugin",
  transformInclude(id) {
    return id.endsWith(".pact");
  },
  async transform(code, id) {
    // Custom transformation logic
    const result = await transformPactToJs(code);
    return {
      code: result.code,
      map: result.sourceMap,
    };
  },
});
```

### Webpack Loader

For direct webpack loader usage:

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.pact$/,
        use: "@pact-toolbox/unplugin/loader",
      },
    ],
  },
};
```

### Production Builds

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import pactPlugin from "@pact-toolbox/unplugin/vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    pactPlugin({
      // Disable network in production
      startNetwork: mode === "development",

      // Optimize for production
      transform: {
        generateTypes: mode === "development",
        parserPoolSize: mode === "production" ? 8 : 4,
      },
    }),
  ],
}));
```

## Performance Optimization

### Parser Pooling

The plugin uses a Rust-based parser with pooling for performance:

```typescript
// Warm up parser pool on startup
await warmUpParserPool();

// Transformation uses pooled parsers
const result = await transformPactToJs(code, {
  generateTypes: true,
  moduleName: "my-module",
});
```

### Caching Strategy

Transformations are cached to improve build performance:

1. **Source Tracking**: Cache entries include source hash
2. **Selective Invalidation**: Only affected files are retransformed
3. **Memory Management**: Cache size limits prevent memory issues
4. **Persistent Cache**: Optional disk-based caching for CI/CD

## Error Handling

The plugin provides detailed error messages:

```typescript
// Syntax errors show line/column information
Error: Syntax error in hello.pact:
  5 | (defun say-hello (name:string
    |                              ^
  Expected ')' but found end of file

// Deployment errors include context
Error: Failed to deploy contract 'hello':
  Contract already exists without upgrade capability

  To fix: Add (implements upgradeable-v1) to your module
```

## Testing

### Unit Tests

```typescript
// Mock the plugin for unit tests
vi.mock("@pact-toolbox/unplugin/vite", () => ({
  default: () => ({
    name: "pact-plugin-mock",
    transform: vi.fn(),
  }),
}));
```

### Integration Tests

```typescript
// test/setup.ts
import { beforeAll, afterAll } from "vitest";
import { createPactToolboxNetwork } from "@pact-toolbox/network";

let network;

beforeAll(async () => {
  // Start test network
  network = await createPactToolboxNetwork({
    type: "pact-server",
    port: 9001,
  });
  await network.start();
});

afterAll(async () => {
  await network?.stop();
});
```

## Best Practices

### 1. Project Structure

```
src/
--- contracts/
   --- token.pact      # Token contract
   --- governance.pact # Governance contract
   --- index.ts        # Re-export contracts
--- lib/
   --- pact-client.ts  # Client wrapper
--- main.ts
```

### 2. Type Safety

```typescript
// Create typed wrappers for contracts
import { token } from "../contracts/token.pact";
import type { TokenModule } from "../contracts/token.pact";

export class TokenService {
  constructor(private module: TokenModule = token) {}

  async transfer(from: string, to: string, amount: number) {
    return this.module.transfer(from, to, amount);
  }

  async balance(account: string): Promise<number> {
    return this.module.getBalance(account);
  }
}
```

### 3. Environment Configuration

```typescript
// env.d.ts
interface ImportMetaEnv {
  readonly VITE_PACT_NETWORK_ID: string;
  readonly VITE_PACT_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global network config
declare global {
  interface Window {
    __PACT_TOOLBOX_NETWORK_CONFIG__: {
      networkId: string;
      rpcUrl: string;
      chainId: string;
    };
  }
}
```

### 4. Error Boundaries

```typescript
// Handle contract errors gracefully
try {
  await contract.someFunction();
} catch (error) {
  if (error.type === "TxFailure") {
    console.error("Transaction failed:", error.message);
  } else if (error.type === "NetworkError") {
    console.error("Network error:", error.message);
  } else {
    throw error;
  }
}
```

## Troubleshooting

### Common Issues

1. **"Cannot find module '\*.pact'"**

   - Ensure the plugin is properly configured
   - Check that `.pact` files are in the correct location
   - Verify TypeScript includes `.pact` declarations

2. **"Network failed to start"**

   - Check if port 8080 is available
   - Ensure Docker is running (for devnet)
   - Try setting `startNetwork: false`

3. **"Contract deployment failed"**

   - Verify namespace and keyset configuration
   - Check contract syntax with `pact` CLI
   - Ensure upgrade capability for existing contracts

4. **"Type generation failed"**
   - Check for syntax errors in Pact code
   - Verify function signatures are valid
   - Ensure schemas are properly defined

### Debug Mode

Enable detailed logging:

```bash
# Enable all debug output
DEBUG=pact-toolbox:* npm run dev

# Specific components
DEBUG=pact-toolbox:unplugin npm run dev
DEBUG=pact-toolbox:transform npm run dev
DEBUG=pact-toolbox:network npm run dev
```

## Migration Guide

### From Manual Compilation

```typescript
// Before: Manual compilation
const pact = new Pact();
const result = await pact.eval(fs.readFileSync("./contract.pact", "utf8"));

// After: Direct imports
import { contract } from "./contract.pact";
const result = await contract.someFunction();
```

### From Other Pact Tools

```typescript
// Before: String-based API
await client.exec('(my-contract.transfer "alice" "bob" 1.0)');

// After: Type-safe API
import { myContract } from "./contracts/my-contract.pact";
await myContract.transfer("alice", "bob", 1.0);
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.
