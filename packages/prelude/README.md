# @pact-toolbox/prelude

> Declarative prelude system with smart caching, checksums, and optimized downloads for Pact development

## Overview

The `@pact-toolbox/prelude` package provides a modern, declarative system for managing standard Pact contracts (preludes) with intelligent caching, checksum verification, and optimized downloads. It uses a factory-based approach to define preludes with deployment groups, namespace management, and lifecycle hooks.

## Installation

```bash
npm install @pact-toolbox/prelude
# or
pnpm add @pact-toolbox/prelude
```

## Features

- 🏗️ **Declarative Prelude Definitions** - Use factory functions to define preludes with clear structure
- 📦 **Smart Deployment Groups** - Organize files into logical groups with dependencies
- 🔒 **Checksum Verification** - Ensure integrity with SHA-256 hash validation
- 💾 **Intelligent Caching** - Skip downloads when contracts are already cached and valid
- 🚀 **Optimized Downloads** - Only download what's needed, when it's needed
- 🔄 **Dependency Resolution** - Automatic handling of prelude and group dependencies
- 🏗️ **Namespace Management** - Automatic namespace creation and keyset handling
- 📜 **REPL Generation** - Generate transaction-based installation scripts
- 🎯 **Type Safety** - Full TypeScript support with proper typing
- 🪝 **Lifecycle Hooks** - beforeDeploy, afterDeploy, and onError hooks

## Quick Start

```typescript
import { downloadAllPreludes, deployPreludes } from "@pact-toolbox/prelude";
import { PactToolboxClient } from "@pact-toolbox/runtime";

// Setup client and config
const client = new PactToolboxClient();
const config = {
  contractsDir: "./contracts",
  preludes: ["kadena/chainweb", "kadena/marmalade"],
  client,
};

// Download preludes with smart caching
await downloadAllPreludes(config, {
  forceDownload: false, // Use cache when possible
  validateChecksums: true, // Verify file integrity
  cleanCache: false, // Keep existing cache
});

// Deploy preludes to network
await deployPreludes(config);
```

## Declarative Prelude System

### Factory Functions

The new system uses factory functions to create clean, declarative prelude definitions:

```typescript
import {
  repository,
  file,
  namespace,
  deploymentGroup,
  keysetTemplate,
  DeploymentConditions,
} from "@pact-toolbox/prelude";

// Create a custom prelude definition
const myPrelude: PreludeDefinition = {
  id: "my-org/my-prelude",
  name: "My Custom Prelude",
  description: "Custom contracts for my project",
  version: "1.0.0",

  // Repository configuration
  repository: repository("my-org", "my-contracts", {
    branch: "main",
    basePath: "pact",
  }),

  // Namespace definitions
  namespaces: [namespace("my-namespace", ["admin-keyset", "user-keyset"]), namespace("utilities", ["admin-keyset"])],

  // Keyset templates
  keysetTemplates: [keysetTemplate("admin-keyset", "admin"), keysetTemplate("user-keyset", "user")],

  // Deployment groups with dependencies
  deploymentGroups: [
    deploymentGroup("core", [file("interfaces.pact"), file("utilities.pact")], {
      namespace: "my-namespace",
    }),

    deploymentGroup(
      "main-contracts",
      [
        file("my-contract.pact", {
          checksum: "abc123...",
          version: "1.0.0",
        }),
      ],
      {
        namespace: "my-namespace",
        dependsOn: ["core"],
      },
    ),
  ],

  // Deployment conditions
  deploymentConditions: DeploymentConditions.ifContractsMissing(["my-namespace.my-contract"]),

  // Custom REPL template
  replTemplate: `
;; My Custom Prelude Installation
(env-data {
  "admin-keyset": ["{{publicKey}}"],
  "user-keyset": ["{{publicKey}}"]
})

(begin-tx "Load core contracts")
  (namespace 'my-namespace)
  (load "my-namespace/interfaces.pact")
  (load "my-namespace/utilities.pact")
(commit-tx)

(begin-tx "Load main contracts")
  (namespace 'my-namespace)
  (load "my-namespace/my-contract.pact")
(commit-tx)

(print "✓ My Custom Prelude loaded successfully!")
  `.trim(),

  // Lifecycle hooks
  hooks: {
    beforeDeploy: async (client) => {
      console.log("🚀 Starting deployment...");
    },
    afterDeploy: async (client) => {
      console.log("✅ Deployment completed!");
    },
    onError: async (client, error) => {
      console.error("❌ Deployment failed:", error.message);
    },
  },
};
```

### Deployment Groups

Organize files into logical deployment groups with dependencies:

```typescript
import { deploymentGroup, file } from "@pact-toolbox/prelude";

// Group with dependencies
const coreGroup = deploymentGroup(
  "core-contracts",
  [
    file("interfaces.pact"),
    file("base-contract.pact", {
      checksum: "sha256-hash...",
      version: "1.0.0",
    }),
  ],
  {
    namespace: "my-namespace",
  },
);

// Group that depends on core
const extendedGroup = deploymentGroup(
  "extended-contracts",
  [file("advanced-contract.pact"), file("helper-contract.pact")],
  {
    namespace: "my-namespace",
    dependsOn: ["core-contracts"], // Deploy after core
    optional: true, // Can skip if deployment fails
    shouldDeploy: async (client) => {
      // Custom deployment condition
      const exists = await client.isContractDeployed("my-namespace.base-contract");
      return exists;
    },
  },
);
```

### Deployment Conditions

Use built-in deployment conditions or create custom ones:

```typescript
import { DeploymentConditions } from "@pact-toolbox/prelude";

// Skip deployment on production networks
const devOnly = DeploymentConditions.skipOnChainweb();

// Only deploy if contracts are missing
const ifMissing = DeploymentConditions.ifContractsMissing(["coin", "my-namespace.my-contract"]);

// Only deploy if namespaces are missing
const ifNamespacesMissing = DeploymentConditions.ifNamespacesMissing(["my-namespace"]);

// Combine multiple conditions
const combined = DeploymentConditions.combine(devOnly, ifMissing, ifNamespacesMissing);
```

## REPL Generation

Each prelude can define a custom REPL template that generates transaction-based installation scripts:

```typescript
const preludeWithRepl: PreludeDefinition = {
  // ... other config

  replTemplate: `
;; {{name}} Installation Script
;; Network: {{networkId}}
;; Admin: {{accountName}} ({{publicKey}})

;; Setup keysets
(env-data {
  "admin-keyset": ["{{publicKey}}"],
  "user-keyset": ["{{publicKey}}"]
})

;; Deploy core contracts
(begin-tx "Core contracts")
  (namespace 'my-namespace)
  (load "my-namespace/core.pact")
(commit-tx)

(print "✓ Installation completed!")
  `.trim(),
};

// Generate REPL script
import { generatePreludeRepl } from "@pact-toolbox/prelude";
const replScript = await generatePreludeRepl(preludeWithRepl, client);
```

Template variables available:

- `{{publicKey}}` - User's public key
- `{{accountName}}` - User's account name
- `{{networkId}}` - Target network ID
- `{{name}}` - Prelude name
- `{{description}}` - Prelude description

## Built-in Preludes

### Kadena Chainweb (`kadena/chainweb`)

Core Kadena blockchain contracts:

```typescript
import { chainwebDefinition } from "@pact-toolbox/prelude";

// Uses factory functions internally:
// - repository("kadena-io", "chainweb-node")
// - deploymentGroup("core", [...]) with root namespace
// - deploymentGroup("utilities", [...]) with util namespace
// - Special env-exec-config for Pact compatibility
```

Includes:

- `coin.pact` - KDA token contract
- `fungible-v2.pact` - Fungible token standard
- `ns.pact` - Namespace management
- `gas-payer-v1.pact` - Gas payment interfaces
- `util-ns.pact`, `guards.pact` - Utility contracts

### Kadena Marmalade (`kadena/marmalade`)

Complete NFT framework with deployment groups:

```typescript
import { marmaladeDefinition } from "@pact-toolbox/prelude";

// 8 deployment groups with proper dependencies:
// 1. namespaces - Create kip, util, marmalade-v2, marmalade-sale
// 2. kip-standards - KIP interface contracts
// 3. utilities - Helper contracts
// 4. core-ledger - Main ledger contracts
// 5. policy-manager - Policy management system
// 6. marmalade-util - Utility contracts
// 7. concrete-policies - Policy implementations (optional)
// 8. sale-contracts - Auction contracts (optional)
```

## Cache Management

### Enhanced Caching System

```typescript
import { getCacheStats, isPreludeCached, clearPreludeCache, calculateFileHash } from "@pact-toolbox/prelude";

// Check cache status
const stats = await getCacheStats("./preludes");
console.log(`Cache: ${stats.totalEntries} entries, ${stats.totalSize} bytes`);

// Verify specific prelude
const isCached = await isPreludeCached(
  "kadena/marmalade",
  "v2.0.0",
  "./preludes",
  false, // Don't skip checksum validation
);

// Calculate file hash
const hash = await calculateFileHash("./contracts/coin.pact");
console.log("SHA-256:", hash);

// Clear cache if needed
await clearPreludeCache("./preludes");
```

### Smart Download Options

```typescript
interface DownloadOptions {
  forceDownload?: boolean; // Force re-download (default: false)
  cleanCache?: boolean; // Clear cache before download (default: false)
  validateChecksums?: boolean; // Verify checksums (default: true)
}

// Cache-aware download
await downloadAllPreludes(config, {
  forceDownload: false, // Use cache when possible
  validateChecksums: true, // Verify file integrity
  cleanCache: false, // Keep existing cache
});
```

## API Reference

### Factory Functions

#### `repository(org, repo, options?)`

Create repository configuration.

```typescript
const repo = repository("kadena-io", "chainweb-node", {
  branch: "master",
  basePath: "pact",
});
```

#### `file(name, options?)`

Create file specification.

```typescript
const fileSpec = file("coin.pact", {
  path: "coin-contract/coin.pact",
  checksum: "sha256-hash...",
  version: "1.0.0",
});
```

#### `namespace(name, keysets, options?)`

Create namespace configuration.

```typescript
const ns = namespace("my-namespace", ["admin-keyset"], {
  create: true, // Create namespace during deployment
});
```

#### `deploymentGroup(name, files, options?)`

Create deployment group.

```typescript
const group = deploymentGroup("core", [file1, file2], {
  namespace: "my-namespace",
  dependsOn: ["other-group"],
  optional: false,
  shouldDeploy: async (client) => {
    // Custom deployment logic
    return true;
  },
});
```

#### `keysetTemplate(name, keys, pred?)`

Create keyset template.

```typescript
const keyset = keysetTemplate("admin-keyset", "admin", "keys-all");
// or with specific keys
const keyset = keysetTemplate("custom-keyset", ["key1", "key2"], "keys-2");
```

### Deployment Functions

#### `deployPreludes(config, downloadIfMissing?)`

Deploy all configured preludes.

#### `downloadAllPreludes(config, options?)`

Download all preludes with caching.

#### `shouldDownloadPreludes(config, validateChecksums?)`

Check if any preludes need downloading.

## Advanced Usage

### Complex Prelude with Multiple Groups

```typescript
import {
  PreludeDefinition,
  repository,
  deploymentGroup,
  file,
  namespace,
  keysetTemplate,
  DeploymentConditions,
} from "@pact-toolbox/prelude";

const complexPrelude: PreludeDefinition = {
  id: "my-org/complex-prelude",
  name: "Complex Multi-Group Prelude",
  description: "Advanced contract system with multiple deployment phases",
  version: "2.0.0",

  repository: repository("my-org", "contracts", {
    branch: "production",
    basePath: "smart-contracts",
  }),

  dependencies: ["kadena/chainweb"],

  namespaces: [namespace("core", ["core-admin", "core-operator"]), namespace("extensions", ["ext-admin"])],

  keysetTemplates: [
    keysetTemplate("core-admin", "admin", "keys-all"),
    keysetTemplate("core-operator", "operator", "keys-2"),
    keysetTemplate("ext-admin", "admin"),
  ],

  deploymentGroups: [
    deploymentGroup("interfaces", [file("core-interface.pact"), file("extension-interface.pact")], {
      namespace: "core",
    }),

    deploymentGroup(
      "core-contracts",
      [
        file("main-contract.pact", {
          checksum: "sha256-abc123...",
          version: "2.0.0",
        }),
        file("helper-contract.pact"),
      ],
      {
        namespace: "core",
        dependsOn: ["interfaces"],
      },
    ),

    deploymentGroup("extensions", [file("advanced-features.pact"), file("utilities.pact")], {
      namespace: "extensions",
      dependsOn: ["core-contracts"],
      optional: true,
      shouldDeploy: async (client) => {
        const hasCore = await client.isContractDeployed("core.main-contract");
        return hasCore;
      },
    }),
  ],

  deploymentConditions: DeploymentConditions.combine(
    DeploymentConditions.ifContractsMissing(["core.main-contract"]),
    DeploymentConditions.ifNamespacesMissing(["core"]),
  ),

  replTemplate: `
;; Complex Multi-Group Prelude Installation
;; Network: {{networkId}} | Admin: {{accountName}}

(env-data {
  "core-admin": ["{{publicKey}}"],
  "core-operator": ["{{publicKey}}"],
  "ext-admin": ["{{publicKey}}"]
})

;; Deploy interfaces
(begin-tx "Load core interfaces")
  (namespace 'core)
  (load "core/core-interface.pact")
  (load "core/extension-interface.pact")
(commit-tx)

;; Deploy core contracts
(begin-tx "Load core contracts")
  (namespace 'core)
  (load "core/main-contract.pact")
  (load "core/helper-contract.pact")
(commit-tx)

;; Deploy extensions (optional)
(begin-tx "Load extension contracts")
  (namespace 'extensions)
  (load "extensions/advanced-features.pact")
  (load "extensions/utilities.pact")
(commit-tx)

(print "✓ Complex prelude deployment completed!")
(print "Core contracts: core.main-contract, core.helper-contract")
(print "Extensions: extensions.advanced-features, extensions.utilities")
  `.trim(),

  hooks: {
    beforeDeploy: async (client) => {
      console.log("🚀 Starting complex deployment sequence...");
      // Pre-deployment validation
    },
    afterDeploy: async (client) => {
      console.log("✅ Complex deployment completed successfully!");
      // Post-deployment verification
    },
    onError: async (client, error) => {
      console.error("❌ Complex deployment failed:", error.message);
      // Error handling and cleanup
    },
  },
};
```

## Best Practices

### 1. Use Deployment Groups

Organize related contracts into logical groups with clear dependencies.

### 2. Pin Versions and Checksums

Always specify versions and checksums for production deployments.

### 3. Leverage Caching

Use cache-aware downloads to minimize network usage.

### 4. Custom REPL Templates

Define custom REPL templates for specific deployment requirements.

### 5. Lifecycle Hooks

Use hooks for logging, validation, and custom deployment logic.

## Troubleshooting

### Cache Issues

```typescript
// Clear corrupted cache
await clearPreludeCache("./preludes");
await downloadAllPreludes(config, { forceDownload: true });
```

### Checksum Validation

```typescript
// Skip checksum validation if needed
await downloadAllPreludes(config, { validateChecksums: false });
```

### Deployment Failures

```typescript
// Handle deployment errors with hooks
const preludeWithErrorHandling: PreludeDefinition = {
  // ... other config
  hooks: {
    onError: async (client, error) => {
      console.error("Deployment failed:", error.message);
      // Custom error handling
      // rollback
    },
  },
};
```

### Dependency Resolution Issues

```typescript
// Ensure proper dependency order
const prelude: PreludeDefinition = {
  // ... other config
  dependencies: ["kadena/chainweb"], // Deploy chainweb first
  deploymentGroups: [
    deploymentGroup("base", [...], { /* no dependencies */ }),
    deploymentGroup("extended", [...], {
      dependsOn: ["base"] // Deploy after base group
    })
  ]
};
```

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
