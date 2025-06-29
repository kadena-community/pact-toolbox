# @pact-toolbox/config

> Central configuration management for pact-toolbox

## Overview

The `@pact-toolbox/config` package provides a unified configuration system for all pact-toolbox packages. It handles loading configuration from multiple sources, provides sensible defaults, and manages network-specific settings.

## Installation

```bash
npm install @pact-toolbox/config
# or
pnpm add @pact-toolbox/config
```

## Usage

### Basic Configuration

```typescript
import { resolveConfig, defineConfig } from "@pact-toolbox/config";

// Define configuration with TypeScript support
export default defineConfig({
  contractsDir: "./contracts",
  network: {
    type: "devnet",
    devnet: {
      containerConfig: {
        port: 8080,
        onDemandMining: true,
      },
    },
  },
});

// Resolve configuration (loads from all sources)
const config = await resolveConfig();
```

### Configuration Sources

Configuration is loaded and merged from multiple sources in order of precedence:

1. Environment variables (`.env` files)
2. `pact-toolbox.config.{js,ts,mjs,mts}` files
3. `package.json` under `pact-toolbox` key
4. Built-in defaults

### Network Configuration

The package supports three types of networks:

#### 1. Pact Server (Local Development)

```typescript
import { createPactServerNetworkConfig } from "@pact-toolbox/config";

const pactServerConfig = createPactServerNetworkConfig({
  execConfig: {
    gasLimit: 100000,
    gasPrice: 0.000001,
    ttl: 600,
    senderAccount: "sender00",
  },
});
```

#### 2. Chainweb DevNet (Containerized)

```typescript
import { createDevNetNetworkConfig } from "@pact-toolbox/config";

const devnetConfig = createDevNetNetworkConfig({
  containerConfig: {
    port: 8080,
    onDemandMining: true,
    image: "kadena/devnet:latest",
    servicePorts: {
      stratum: 1917,
      servicePort: 1848,
    },
  },
  miningConfig: {
    onDemandMining: true,
    interval: 30,
    batchSize: 2,
  },
});
```

#### 3. Chainweb (Production/Testnet)

```typescript
import { createChainwebNetworkConfig } from "@pact-toolbox/config";

const chainwebConfig = createChainwebNetworkConfig({
  apiUrl: "https://api.testnet.chainweb.com",
  networkId: "testnet04",
  chainIds: ["0", "1"],
});
```

### Default Accounts and Keys

The package provides default accounts for development:

```typescript
import { defaultKeyPairs, defaultKeysets, defaultMeta } from "@pact-toolbox/config";

// Access default key pairs
const senderKeys = defaultKeyPairs.sender00;
// { public: "368820f...", secret: "251a5c..." }

// Access default keysets
const adminKeyset = defaultKeysets.adminKeyset;
// { keys: ["368820f..."], pred: "keys-all" }

// Access default transaction metadata
const meta = defaultMeta;
// { chainId: "0", gasLimit: 100000, gasPrice: 0.00001, ttl: 3600 }
```

### Configuration Schema

```typescript
interface PactToolboxConfig {
  // Directory containing Pact contracts
  contractsDir?: string;

  // Prelude configuration
  preludes?: Array<string | PactPrelude>;

  // Active network configuration
  network?: NetworkConfig;

  // Multiple network configurations
  networks?: Record<string, NetworkConfig>;

  // Development settings
  enableDevAccountFunding?: boolean;
  enableGasStation?: boolean;
  requestKey?: string;
}
```

### Network Selection

Networks can be selected via:

1. Environment variable: `PACT_NETWORK=testnet`
2. Configuration file: `network: { type: 'devnet' }`
3. CLI option: `--network mainnet`

### Helper Functions

```typescript
import {
  getDefaultNetworkConfig,
  getNetworkPort,
  getNetworkRpcUrl,
  createRpcUrlGetter,
  createChainwebRpcUrl,
  getSerializableNetworkConfig,
  getSerializableMultiNetworkConfig,
} from "@pact-toolbox/config";

const config = await resolveConfig();
const network = getDefaultNetworkConfig(config);

// Check network type
if (isLocalNetwork(network)) {
  console.log("Running on local network");
}

// Get the port for a network
const port = getNetworkPort(network);

// Get RPC URL with placeholders resolved
const rpcUrl = getNetworkRpcUrl(network);

// Create a function to generate RPC URLs
const getRpcUrl = createRpcUrlGetter(network);
const url = getRpcUrl({ chainId: "1", networkId: "testnet04" });

// Get serializable config (for passing to workers)
const serializable = getSerializableNetworkConfig(config);

// Get all networks in serializable format
const multiNetwork = getSerializableMultiNetworkConfig(config, {
  isDev: true,
  defaultNetwork: "testnet",
});
```

## API Reference

### Core Functions

#### `resolveConfig(options?): Promise<PactToolboxConfig>`

Loads and resolves configuration from all sources.

#### `defineConfig(config): PactToolboxConfig`

Helper for defining configuration with TypeScript support.

### Network Functions

#### `getDefaultNetworkConfig(config, network?): NetworkConfig`

Extracts the active network configuration. Uses environment variable or default if network not specified.

#### `createPactServerNetworkConfig(options): PactServerNetworkConfig`

Creates a Pact Server network configuration.

#### `createDevNetNetworkConfig(options): DevNetworkConfig`

Creates a Chainweb DevNet configuration.

#### `createChainwebNetworkConfig(options): ChainwebNetworkConfig`

Creates a Chainweb network configuration.

#### `createTestNetNetworkConfig(options): ChainwebNetworkConfig`

Creates a TestNet network configuration with sensible defaults.

#### `createMainNetNetworkConfig(options): ChainwebNetworkConfig`

Creates a MainNet network configuration with sensible defaults.

### Type Guards

- `isLocalNetwork(network): boolean` - Check if network is local (Pact Server or DevNet)
- `isDevNetworkConfig(network): boolean` - Check if network is DevNet
- `isPactServerNetworkConfig(network): boolean` - Check if network is Pact Server
- `isChainwebNetworkConfig(network): boolean` - Check if network is Chainweb
- `hasOnDemandMining(network): boolean` - Check if network has on-demand mining enabled

### Default Values

- `defaultKeyPairs` - Array of default development key pairs
- `defaultKeyPairsObject` - Default key pairs indexed by account name
- `defaultKeysets` - Default development keysets
- `defaultMeta` - Default transaction metadata
- `DEFAULT_GAS_LIMIT` - Default gas limit (150000)
- `DEFAULT_GAS_PRICE` - Default gas price (0.00000001)
- `DEFAULT_TTL` - Default time-to-live (900 seconds / 15 minutes)

## Environment Variables

- `PACT_NETWORK` - Active network name
- `PACT_CONTRACTS_DIR` - Contracts directory path
- `DEBUG` - Enable debug logging

## Examples

### Custom Configuration File

```typescript
// pact-toolbox.config.ts
import { defineConfig } from "@pact-toolbox/config";

export default defineConfig({
  contractsDir: "./pact",
  networks: {
    local: {
      type: "devnet",
      devnet: {
        containerConfig: {
          port: 8080,
        },
      },
    },
    testnet: {
      type: "chainweb",
      chainweb: {
        apiUrl: "https://api.testnet.chainweb.com",
        networkId: "testnet04",
      },
    },
  },
  preludes: ["kadena/chainweb", "kadena/marmalade"],
});
```

### Programmatic Usage

```typescript
import { resolveConfig, getDefaultNetworkConfig, isDevNetworkConfig } from "@pact-toolbox/config";

async function setupNetwork() {
  const config = await resolveConfig();
  const network = getDefaultNetworkConfig(config);

  console.log(`Using ${network.type} network`);
  console.log(`Network name: ${network.name}`);

  if (isDevNetworkConfig(network)) {
    console.log(`DevNet port: ${network.containerConfig?.port}`);
  }
}
```

## Security Considerations

### Private Keys

**WARNING**: The default key pairs included in this package are publicly known and should **NEVER** be used in production environments. They are intended for local development and testing only.

When using `getSerializableNetworkConfig` or `getSerializableMultiNetworkConfig`:

- In development mode (`isDev: true`), private keys are included for convenience with local development tools
- In production mode (`isDev: false`), all private keys are excluded from the serialized output
- Local networks (Pact Server, DevNet) are automatically excluded in production mode

### Best Practices

1. **Never commit real private keys** to your repository
2. Use environment variables or secure key management systems for production keys
3. Always validate the environment before including sensitive configuration
4. Use the serialization functions to ensure proper security filtering when passing configs to client-side code
