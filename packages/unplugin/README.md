# @pact-toolbox/unplugin

Universal plugin for Pact smart contract development across all major JavaScript bundlers and test frameworks. Automatically transforms `.pact` files into JavaScript modules with TypeScript support.

## Installation

```bash
npm install -D @pact-toolbox/unplugin
# or
pnpm add -D @pact-toolbox/unplugin
```

## Features

- **Universal Plugin** - Works with Vite, Webpack, Rollup, esbuild, Rspack, Rsbuild, Farm, Next.js, Nuxt, and Astro
- **Jest Transformer** - Async transformer for testing Pact contracts with Jest
- **Rust-Powered Parser** - High-performance Pact parsing using tree-sitter via `@pact-toolbox/pact-transformer`
- **TypeScript Generation** - Automatic type definitions from Pact contracts with full type safety
- **Hot Module Replacement** - Live contract updates during development
- **Network Management** - Automatic local blockchain startup and management
- **Auto-Deployment** - Contracts deployed/upgraded on file changes in development
- **Smart Caching** - LRU cache with source hash validation for optimal performance
- **Instance Pooling** - Reuses parser instances for better performance
- **Source Maps** - Support for source map generation (when available)
- **Developer Experience** - Clear error messages with file paths and line numbers

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

### Jest

The package includes an async transformer for Jest that allows you to import `.pact` files directly in your tests:

```javascript
// jest.config.js
module.exports = {
  transform: {
    "\\.pact$": ["@pact-toolbox/unplugin/jest", { generateTypes: true }],
  },
  extensionsToTreatAsEsm: [".pact"],
  // For ESM support
  testEnvironment: "node",
  testMatch: ["**/*.test.js", "**/*.test.ts"],
};
```

Then in your tests:

```javascript
// __tests__/contract.test.js
import { myContract } from "../contracts/my-contract.pact";

describe("MyContract", () => {
  it("should execute contract functions", async () => {
    const result = await myContract.someFunction("arg");
    expect(result).toBeDefined();
  });
});
```

#### Jest Transformer Options

```typescript
interface JestTransformerOptions {
  /**
   * Generate TypeScript types
   * @default true
   */
  generateTypes?: boolean;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}
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
  onReady?: (runtime: PactToolboxClient) => Promise<void>;

  /**
   * Cache size limit (number of entries)
   * @default 1000
   */
  cacheSize?: number;
}
```

### Environment Variables

```bash
# Default network selection
PACT_TOOLBOX_NETWORK=testnet

# Disable network startup
PACT_TOOLBOX_NO_NETWORK=true

# Enable debug logging
DEBUG=pact-toolbox:*

# Environment-specific behavior
NODE_ENV=production  # Excludes local networks and private keys
NODE_ENV=development # Includes all networks with private keys
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

### Multi-Network Management

The plugin automatically injects multiple network configurations and manages network switching:

```typescript
// Access multi-network configuration
const multiConfig = window.__PACT_TOOLBOX_NETWORKS__;
console.log("Default network:", multiConfig.default);
console.log("Available networks:", Object.keys(multiConfig.configs));
console.log("Environment:", multiConfig.environment);

// Use the global network context
import { getGlobalNetworkContext } from "@pact-toolbox/transaction";

const context = getGlobalNetworkContext();
console.log("Current network:", context.getCurrentNetwork());

// Switch networks at runtime
await context.switchNetwork("testnet");

// Use the current network's client
const client = context.getClient();
const result = await client.local("(+ 1 2)");
console.log(result); // 3
```

### Contract Deployment

Contracts are automatically deployed during development. The plugin detects existing contracts and upgrades them, handles deployment failures gracefully, and maintains deployment state in cache.

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

## Performance

The plugin uses a Rust-based parser with instance pooling and caching for optimal performance. Transformations are cached based on source content hash, and only changed files are retransformed during development.

## Error Handling

The plugin provides detailed error messages with file context:

```typescript
// Syntax errors include file path
Error: Syntax error in Pact code (/src/contracts/hello.pact): parse error at line 5

// Transformation errors are specific
Error: Failed to transform Pact code (/src/contracts/broken.pact): unexpected token

// Deployment errors include context
Error: Failed to deploy contract hello.pact:
  Contract already exists without upgrade capability
  To fix: Add upgrade capability to your module
```

## Testing with Jest

The package includes a Jest transformer that allows you to test Pact contracts directly:

```javascript
// jest.config.js
module.exports = {
  transform: {
    "\\.pact$": ["@pact-toolbox/unplugin/jest", { generateTypes: true }],
  },
  extensionsToTreatAsEsm: [".pact"],
  testEnvironment: "node",
};
```

```javascript
// __tests__/my-contract.test.js
import { myContract } from "../contracts/my-contract.pact";

describe("My Contract", () => {
  it("should have the correct module name", () => {
    expect(myContract.__module.name).toBe("my-contract");
  });

  it("should execute functions", () => {
    const result = myContract.someFunction("arg");
    expect(result).toBeDefined();
  });
});
```

## TypeScript Configuration

For TypeScript projects using the Jest transformer, update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["jest", "@types/node"],
    "moduleResolution": "node",
    "esModuleInterop": true
  },
  "include": ["src", "**/*.pact.d.ts"]
}
```

The plugin automatically generates TypeScript declarations for your `.pact` files, so no manual type declarations are needed.

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

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
