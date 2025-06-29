# @pact-toolbox/network

Simplified network management for Pact development environments. Supports both Pact Server and Chainweb DevNet networks with an easy-to-use API.

## Installation

```bash
npm install @pact-toolbox/network
```

## Quick Start

```typescript
import { createNetwork } from "@pact-toolbox/network";
import { resolveConfig } from "@pact-toolbox/config";

// Load your configuration
const config = await resolveConfig();

// Create and start a network
const network = await createNetwork(config);

// Get network information
console.log("RPC URL:", network.getRpcUrl());
console.log("Port:", network.getPort());

// Check if network supports on-demand mining
if (network.hasOnDemandMining()) {
  console.log("Mining URL:", network.getMiningUrl());
}

// Stop the network when done
await network.stop();
```

## Key Features

- **Simplified API**: Single function to create and manage networks
- **Auto-cleanup**: No complex lifecycle management required
- **Flexible Options**: Support for various development scenarios
- **Network Health**: Built-in health checking and monitoring
- **Type Safety**: Full TypeScript support with proper types

## API

### `createNetwork(config, options?)`

Creates and optionally starts a Pact network.

**Parameters:**

- `config`: PactToolboxConfigObj - The toolbox configuration
- `options`: NetworkOptions (optional)
  - `network`: string - Network name from config (default: first network)
  - `autoStart`: boolean - Auto-start network on creation (default: true)
  - `detached`: boolean - Run network in background (default: true)
  - `stateless`: boolean - Don't persist data between restarts (default: false)
  - `logAccounts`: boolean - Log account details on start (default: false)
  - `logger`: Logger - Custom logger instance

**Returns:** Promise<PactToolboxNetwork>

### `PactToolboxNetwork`

Main network class that implements the `NetworkApi` interface.

#### Methods

- `start(options?)`: Start the network
- `stop()`: Stop the network
- `restart(options?)`: Restart the network
- `isHealthy()`: Check if network is healthy
- `getPort()`: Get the main service port
- `getRpcUrl()`: Get the RPC endpoint URL
- `hasOnDemandMining()`: Check if network supports on-demand mining
- `getMiningUrl()`: Get mining endpoint URL (if supported)
- `getNetworkName()`: Get the network name
- `getNetworkConfig()`: Get the full network configuration

## Network Types

### Pact Server

Local Pact interpreter server for development.

```typescript
// Configuration example
{
  networks: {
    local: {
      type: "pact-server",
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      serverConfig: {
        port: 8080,
        logDir: ".pact-toolbox/pact/log",
        persistDir: ".pact-toolbox/pact/db",
        // ... other Pact server options
      }
    }
  }
}
```

### Chainweb DevNet

Full Kadena blockchain development network with Docker.

```typescript
// Configuration example
{
  networks: {
    devnet: {
      type: "chainweb-devnet",
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      containerConfig: {
        port: 8080,
        onDemandMining: true,
        miningConfig: {
          // Mining configuration options
        }
      }
    }
  }
}
```

## Examples

### Basic Usage

```typescript
import { createNetwork } from "@pact-toolbox/network";
import { resolveConfig } from "@pact-toolbox/config";

async function main() {
  const config = await resolveConfig();

  // Start the default network
  const network = await createNetwork(config);

  // Use the network...
  console.log("Network started at:", network.getRpcUrl());

  // Stop when done
  await network.stop();
}
```

### Manual Network Control

```typescript
import { createNetwork } from "@pact-toolbox/network";

async function main() {
  const config = await resolveConfig();

  // Create network without auto-starting
  const network = await createNetwork(config, {
    autoStart: false,
    network: "devnet", // Specify which network to use
  });

  // Start manually
  await network.start({
    detached: false, // Show logs in console
    logAccounts: true, // Display test accounts
  });

  // Restart the network
  await network.restart();

  // Check health
  const healthy = await network.isHealthy();
  console.log("Network healthy:", healthy);
}
```

### Stateless Testing

```typescript
// Run network without persisting data
const network = await createNetwork(config, {
  stateless: true, // No data persistence
  autoStart: true,
});

// Each restart gives you a clean state
await network.restart({ stateless: true });
```

### Process Cleanup

When using networks in CLI applications or scripts, you should handle cleanup properly:

```typescript
import { createNetwork } from "@pact-toolbox/network";

async function runScript() {
  const network = await createNetwork(config);

  // Setup cleanup handlers
  const cleanup = async () => {
    console.log("Shutting down network...");
    try {
      await network.stop();
      console.log("Network stopped successfully");
    } catch (error) {
      console.error("Error stopping network:", error);
    }
    process.exit(0);
  };

  // Register cleanup for different exit scenarios
  process.on("SIGINT", cleanup); // Ctrl+C
  process.on("SIGTERM", cleanup); // Termination signal
  process.on("beforeExit", cleanup);

  try {
    // Your application logic here
    console.log("Network running at:", network.getRpcUrl());

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error("Script error:", error);
    await cleanup();
  }
}
```

## License

MIT
