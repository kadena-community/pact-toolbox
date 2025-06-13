# @pact-toolbox/prelude

> Standard library and contract management for Pact development

## Overview

The `@pact-toolbox/prelude` package provides a comprehensive system for managing standard Pact contracts (preludes) in your development environment. It handles downloading, templating, deployment, and lifecycle management of essential Kadena contracts and custom preludes.

## Installation

```bash
npm install @pact-toolbox/prelude
# or
pnpm add @pact-toolbox/prelude
```

## Features

- 📦 **Prelude Management** - Download and deploy standard Kadena contracts
- 🔧 **Template Support** - Handlebars templating for contract customization
- 🔄 **Dependency Resolution** - Automatic handling of contract dependencies
- 🚀 **Batch Deployment** - Deploy multiple contracts efficiently
- 🔍 **Contract Discovery** - Find and use community preludes
- 💾 **Local Caching** - Cache downloaded preludes for offline use
- 🎯 **Type Safety** - Full TypeScript support

## Quick Start

```typescript
import { downloadAllPreludes, deployPreludes } from '@pact-toolbox/prelude';
import { PactToolboxClient } from '@pact-toolbox/client';

// Setup client and config
const client = new PactToolboxClient();
const config = {
  contractsDir: './contracts',
  preludes: ['kadena/chainweb', 'kadena/marmalade']
};

// Download preludes
await downloadAllPreludes({ ...config, client });

// Deploy preludes to network
await deployPreludes({ ...config, client });
```

## Prelude Configuration

### Basic Configuration

```typescript
// String format - uses default registry
const preludes = [
  'kadena/chainweb',      // Core Kadena contracts
  'kadena/marmalade',     // NFT standard
  'kadena/gas-station'    // Gas management
];
```

### Advanced Configuration

```typescript
import { PactPrelude } from '@pact-toolbox/prelude';

const preludes: PactPrelude[] = [
  // Standard registry prelude
  'kadena/chainweb',
  
  // Custom prelude with full configuration
  {
    name: 'my-custom-prelude',
    path: './preludes/custom.pact',
    dependencies: ['kadena/chainweb'],
    templateData: {
      namespace: 'my-namespace',
      adminKeyset: 'my-admin-keyset'
    }
  },
  
  // Remote prelude
  {
    name: 'community-prelude',
    url: 'https://github.com/org/repo/prelude.pact',
    version: 'v1.0.0'
  }
];
```

## API Reference

### Core Functions

#### `downloadAllPreludes(options)`

Downloads all configured preludes to local filesystem.

```typescript
interface DownloadPreludesOptions {
  contractsDir: string;           // Directory to save preludes
  preludes: PreludeConfig[];      // Prelude configurations
  client: PactToolboxClient;      // Client instance
  force?: boolean;                // Force re-download
  registry?: PreludeRegistry;     // Custom registry
}

await downloadAllPreludes({
  contractsDir: './contracts',
  preludes: ['kadena/chainweb'],
  client,
  force: true  // Re-download even if exists
});
```

#### `deployPreludes(options)`

Deploys preludes to the active network.

```typescript
interface DeployPreludesOptions {
  contractsDir: string;           // Directory containing preludes
  preludes: PreludeConfig[];      // Prelude configurations
  client: PactToolboxClient;      // Client instance
  skipDeployed?: boolean;         // Skip already deployed
  parallelDeploy?: boolean;       // Deploy in parallel
  onProgress?: (progress) => void; // Progress callback
}

await deployPreludes({
  contractsDir: './contracts',
  preludes: ['kadena/chainweb'],
  client,
  skipDeployed: true,
  onProgress: (progress) => {
    console.log(`Deployed ${progress.current}/${progress.total}`);
  }
});
```

#### `resolvePrelude(prelude, options)`

Resolves a prelude configuration to full metadata.

```typescript
const resolved = await resolvePrelude('kadena/chainweb', {
  registry: defaultRegistry,
  contractsDir: './contracts'
});

console.log(resolved);
// {
//   name: 'kadena/chainweb',
//   path: './contracts/kadena/chainweb.pact',
//   dependencies: [],
//   version: '1.0.0',
//   ...
// }
```

#### `getPreludeRegistry()`

Returns the default prelude registry.

```typescript
const registry = getPreludeRegistry();
const availablePreludes = registry.list();
```

### Template Support

Preludes support Handlebars templating for customization:

```pact
;; my-prelude.pact
(namespace '{{namespace}}')

(module my-module {{adminKeyset}}
  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}}))
  
  (defconst VERSION "{{version}}")
  
  {{#if enableFeatureX}}
  (defun feature-x () 
    "Feature X implementation")
  {{/if}}
)
```

```typescript
const prelude: PactPrelude = {
  name: 'my-prelude',
  path: './my-prelude.pact',
  templateData: {
    namespace: 'free',
    adminKeyset: '"my-admin"',
    version: '1.0.0',
    enableFeatureX: true
  }
};
```

### Dependency Management

```typescript
// Define dependencies
const preludes: PactPrelude[] = [
  {
    name: 'base-module',
    path: './base.pact'
  },
  {
    name: 'dependent-module', 
    path: './dependent.pact',
    dependencies: ['base-module']  // Deployed after base-module
  }
];

// Dependencies are automatically resolved during deployment
await deployPreludes({ preludes, client, contractsDir });
```

### Custom Registry

```typescript
import { PreludeRegistry } from '@pact-toolbox/prelude';

// Create custom registry
const customRegistry = new PreludeRegistry({
  baseUrl: 'https://my-registry.com',
  cache: true
});

// Register custom preludes
customRegistry.register({
  name: 'my-org/my-prelude',
  url: 'https://github.com/my-org/preludes/my-prelude.pact',
  version: '1.0.0',
  description: 'Custom prelude for my organization'
});

// Use custom registry
await downloadAllPreludes({
  preludes: ['my-org/my-prelude'],
  registry: customRegistry,
  client,
  contractsDir
});
```

## Standard Preludes

### Kadena Chainweb (`kadena/chainweb`)

Core Kadena blockchain contracts:
- `coin` - KDA token contract
- `ns` - Namespace management
- `gas-payer` - Gas payment interfaces

### Kadena Marmalade (`kadena/marmalade`)

NFT standard implementation:
- `marmalade.ledger` - NFT ledger
- `marmalade.policy` - Policy management
- `marmalade.util` - Utility functions

### Gas Station (`kadena/gas-station`)

Gas management utilities:
- `gas-station` - Free gas for specific operations
- `gas-guard` - Gas payment guards

## REPL Integration

Preludes integrate seamlessly with the test framework:

```typescript
// test.repl
;; Load preludes in REPL
.load kadena/chainweb
.load my-custom-prelude

;; Use prelude functions
(coin.create-account "alice" (read-keyset "alice-ks"))
(my-module.my-function)
```

## Best Practices

### 1. Version Management

```typescript
// Pin specific versions for production
const preludes = [
  {
    name: 'kadena/chainweb',
    version: '1.0.0'  // Pin version
  }
];
```

### 2. Environment-Specific Configuration

```typescript
const preludes = process.env.NODE_ENV === 'production'
  ? ['kadena/chainweb@1.0.0']
  : ['kadena/chainweb', 'test-helpers'];
```

### 3. Error Handling

```typescript
try {
  await deployPreludes({ preludes, client, contractsDir });
} catch (error) {
  if (error.code === 'PRELUDE_NOT_FOUND') {
    console.error('Prelude not found:', error.prelude);
  } else if (error.code === 'DEPLOYMENT_FAILED') {
    console.error('Deployment failed:', error.details);
  }
}
```

### 4. Progress Monitoring

```typescript
await deployPreludes({
  preludes,
  client,
  contractsDir,
  onProgress: ({ current, total, prelude, status }) => {
    console.log(`[${current}/${total}] ${prelude}: ${status}`);
  }
});
```

## Examples

### Complete Setup Example

```typescript
import { 
  downloadAllPreludes, 
  deployPreludes,
  resolvePrelude 
} from '@pact-toolbox/prelude';
import { PactToolboxClient } from '@pact-toolbox/client';
import { resolveConfig } from '@pact-toolbox/config';

async function setupPreludes() {
  // Load configuration
  const config = await resolveConfig();
  const client = new PactToolboxClient(config);
  
  // Define preludes with templates
  const preludes = [
    'kadena/chainweb',
    {
      name: 'my-app',
      path: './preludes/my-app.pact',
      templateData: {
        namespace: config.namespace || 'free',
        adminKeyset: config.adminKeyset || '"admin-keyset"',
        version: process.env.APP_VERSION || '1.0.0'
      },
      dependencies: ['kadena/chainweb']
    }
  ];
  
  // Download if needed
  console.log('Downloading preludes...');
  await downloadAllPreludes({
    contractsDir: config.contractsDir,
    preludes,
    client,
    force: process.env.FORCE_DOWNLOAD === 'true'
  });
  
  // Deploy to network
  console.log('Deploying preludes...');
  await deployPreludes({
    contractsDir: config.contractsDir,
    preludes,
    client,
    skipDeployed: true,
    onProgress: ({ current, total, prelude }) => {
      console.log(`Deploying ${prelude} (${current}/${total})...`);
    }
  });
  
  console.log('Preludes ready!');
}
```

### Custom Prelude Creation

```typescript
// Create a custom prelude package
const createCustomPrelude = () => ({
  name: '@myorg/defi-prelude',
  path: './preludes/defi.pact',
  description: 'DeFi primitives for Kadena',
  version: '1.0.0',
  dependencies: ['kadena/chainweb'],
  templateData: {
    namespace: 'defi',
    feePercentage: '0.003',
    minLiquidity: '1000.0'
  },
  contracts: [
    'defi-swap',
    'defi-pool',
    'defi-governance'
  ]
});

// Register and use
const defiPrelude = createCustomPrelude();
await deployPreludes({
  preludes: [defiPrelude],
  client,
  contractsDir
});
```

### Testing with Preludes

```typescript
import { beforeEach, test } from 'vitest';
import { deployPreludes } from '@pact-toolbox/prelude';

beforeEach(async ({ client, config }) => {
  // Deploy test preludes
  await deployPreludes({
    preludes: ['kadena/chainweb', 'test-helpers'],
    client,
    contractsDir: config.contractsDir
  });
});

test('uses prelude functions', async ({ client }) => {
  const result = await client.execute(
    '(coin.get-balance "alice")'
  );
  expect(result).toBe('1000.0');
});
```

## Troubleshooting

### Common Issues

1. **Prelude not found**
   ```typescript
   // Check available preludes
   const registry = getPreludeRegistry();
   console.log(registry.list());
   ```

2. **Template compilation errors**
   ```typescript
   // Validate template data
   const resolved = await resolvePrelude(prelude, { 
     validateTemplate: true 
   });
   ```

3. **Deployment failures**
   ```typescript
   // Enable debug logging
   await deployPreludes({
     preludes,
     client,
     contractsDir,
     debug: true
   });
   ```

4. **Dependency cycles**
   ```typescript
   // Visualize dependencies
   const deps = await getPreludeDependencyGraph(preludes);
   console.log(deps.toDot()); // Graphviz format
   ```
