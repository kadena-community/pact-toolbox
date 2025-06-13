# @pact-toolbox/network

> Network orchestration and management for Pact development

## Overview

The `@pact-toolbox/network` package provides a unified interface for managing different types of Pact networks during development. It supports both Pact Server (process-based) and Chainweb DevNet (container-based) networks, with automatic prelude deployment and health monitoring.

## Installation

```bash
npm install @pact-toolbox/network
# or
pnpm add @pact-toolbox/network
```

## Usage

### Basic Network Creation

```typescript
import { createPactToolboxNetwork } from '@pact-toolbox/network';
import { resolveConfig } from '@pact-toolbox/config';

// Create network from configuration
const config = await resolveConfig();
const { network, client } = await createPactToolboxNetwork(config);

// Start the network
await network.start();

// Check if network is running
const isHealthy = await network.isOk();

// Stop the network
await network.stop();
```

### Network Types

#### 1. Pact Server Network

For lightweight local development:

```typescript
import { PactServerNetwork } from '@pact-toolbox/network';

const pactServer = new PactServerNetwork(networkConfig, {
  client,
  logger,
  spinner
});

await pactServer.start({
  isDetached: true,
  conflictStrategy: 'replace'
});
```

#### 2. DevNet Network

For Chainweb-compatible development:

```typescript
import { LocalDevNetNetwork } from '@pact-toolbox/network';

const devnet = new LocalDevNetNetwork(networkConfig, {
  client,
  logger,
  spinner,
  activeProfiles: ['mining']
});

await devnet.start({
  isStateless: false,
  cleanup: true
});
```

### Network Options

```typescript
interface ToolboxNetworkStartOptions {
  // Run network in detached mode (background)
  isDetached?: boolean;
  
  // Don't persist state between runs
  isStateless?: boolean;
  
  // Clean up resources on stop
  cleanup?: boolean;
  
  // Strategy for handling port conflicts
  conflictStrategy?: 'replace' | 'fail' | 'ignore';
  
  // Custom client instance
  client?: PactToolboxClient;
  
  // Log account information on start
  logAccounts?: boolean;
  
  // Auto-start the network
  autoStart?: boolean;
}
```

### Health Monitoring

```typescript
// Check network health
const isHealthy = await network.isOk();

// Get network status details
const nodeUrl = network.getNodeServiceUrl();
const miningUrl = network.getMiningClientUrl();

// Monitor network health
setInterval(async () => {
  const health = await network.isOk();
  console.log(`Network health: ${health ? 'OK' : 'Failed'}`);
}, 30000);
```

### Prelude Deployment

Networks automatically deploy configured preludes on start:

```typescript
// Configure preludes in config
const config = {
  preludes: [
    'kadena/chainweb',
    'kadena/marmalade',
    {
      name: 'custom-prelude',
      path: './preludes/custom.pact'
    }
  ]
};

// Preludes are deployed automatically when network starts
const { network } = await createPactToolboxNetwork(config);
await network.start(); // Deploys preludes
```

### Port Management

The package handles port conflicts automatically:

```typescript
// Specify custom ports
const config = {
  network: {
    type: 'devnet',
    devnet: {
      containerConfig: {
        port: 8080,
        servicePorts: {
          stratum: 1917,
          servicePort: 1848
        }
      }
    }
  }
};

// Or let it find available ports
const { network } = await createPactToolboxNetwork(config, {
  conflictStrategy: 'replace' // Kill conflicting processes
});
```

## API Reference

### Main Functions

#### `createPactToolboxNetwork(config, options?)`
Creates a network instance based on configuration.

**Parameters:**
- `config` - Pact toolbox configuration
- `options` - Network creation options

**Returns:**
```typescript
{
  network: PactToolboxNetwork;
  client: PactToolboxClient;
}
```

### PactToolboxNetwork Class

#### Methods

##### `start(options?): Promise<void>`
Starts the network with optional configuration.

##### `stop(): Promise<void>`
Stops the network and cleans up resources.

##### `restart(options?): Promise<void>`
Restarts the network with new options.

##### `isOk(): Promise<boolean>`
Checks if the network is healthy.

##### `getServicePort(): number`
Returns the main service port.

##### `getNodeServiceUrl(): string`
Returns the node API URL.

##### `getMiningClientUrl(): string`
Returns the mining client URL (DevNet only).

##### `hasOnDemandMining(): boolean`
Checks if on-demand mining is enabled (DevNet only).

### Network Implementations

#### LocalDevNetNetwork

Manages Chainweb DevNet containers.

**Features:**
- Docker container orchestration
- On-demand mining support
- Multi-node clustering
- Volume persistence
- Health monitoring

#### PactServerNetwork

Manages Pact Server processes.

**Features:**
- Process lifecycle management
- In-memory database
- Fast startup
- Simple configuration

## Configuration

### DevNet Configuration

```typescript
{
  type: 'devnet',
  name: 'local-devnet',
  devnet: {
    containerConfig: {
      port: 8080,
      image: 'kadena/devnet:latest',
      onDemandMining: true,
      persistDb: true,
      servicePorts: {
        stratum: 1917,
        servicePort: 1848,
        p2pPort: 1789
      }
    },
    miningConfig: {
      onDemandMining: true,
      interval: 30,
      batchSize: 2
    }
  }
}
```

### Pact Server Configuration

```typescript
{
  type: 'pact-server',
  name: 'local-pact',
  pactServer: {
    port: 8080,
    logLevel: 'info',
    persistDb: false,
    execConfig: {
      gasLimit: 100000,
      gasPrice: 0.000001
    }
  }
}
```

## Examples

### Development Setup

```typescript
import { createPactToolboxNetwork } from '@pact-toolbox/network';
import { resolveConfig } from '@pact-toolbox/config';

async function setupDevEnvironment() {
  const config = await resolveConfig();
  const { network, client } = await createPactToolboxNetwork(config, {
    autoStart: true,
    logAccounts: true,
    conflictStrategy: 'replace'
  });
  
  // Network is ready for development
  console.log('Network URL:', network.getNodeServiceUrl());
  
  // Deploy your contracts
  await client.deployContract('./contracts/my-contract.pact');
  
  // Cleanup on exit
  process.on('SIGINT', async () => {
    await network.stop();
    process.exit(0);
  });
}
```

### Testing Setup

```typescript
import { createPactToolboxNetwork } from '@pact-toolbox/network';

// Create isolated network for tests
async function createTestNetwork() {
  const { network, client } = await createPactToolboxNetwork({
    network: {
      type: 'pact-server',
      name: 'test-network',
      pactServer: {
        port: 0, // Random available port
        persistDb: false
      }
    }
  }, {
    isStateless: true,
    autoStart: true
  });
  
  return { network, client };
}

// Use in tests
describe('Contract Tests', () => {
  let network, client;
  
  beforeEach(async () => {
    ({ network, client } = await createTestNetwork());
  });
  
  afterEach(async () => {
    await network.stop();
  });
  
  test('deploy and test contract', async () => {
    await client.deployContract('./test.pact');
    // Run tests...
  });
});
```

### Custom Network Implementation

```typescript
import { ToolboxNetworkApi } from '@pact-toolbox/network';

class CustomNetwork implements ToolboxNetworkApi {
  id = 'custom-network';
  
  async start(options?) {
    // Custom start logic
  }
  
  async stop() {
    // Custom stop logic
  }
  
  async restart(options?) {
    await this.stop();
    await this.start(options);
  }
  
  async isOk() {
    // Health check logic
    return true;
  }
  
  getServicePort() {
    return 8080;
  }
  
  getNodeServiceUrl() {
    return `http://localhost:${this.getServicePort()}`;
  }
  
  getMiningClientUrl() {
    return this.getNodeServiceUrl();
  }
  
  hasOnDemandMining() {
    return false;
  }
}
```

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:

1. Use `conflictStrategy: 'replace'` to kill conflicting processes
2. Set `port: 0` to use random available ports
3. Manually specify different ports in configuration

### Container Issues

For DevNet container issues:

1. Ensure Docker is running
2. Check Docker permissions
3. Use `docker ps` to see running containers
4. Check logs with `docker logs <container-name>`

### Network Not Starting

1. Check logs for error messages
2. Verify configuration is correct
3. Ensure no firewall blocking ports
4. Try with `persistDb: false` for fresh start