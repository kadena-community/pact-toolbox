# @pact-toolbox/container-orchestrator

> Docker container orchestration for Pact development environments

## Overview

The `@pact-toolbox/container-orchestrator` package provides a comprehensive Docker container management solution specifically designed for Pact blockchain development. It offers high-level abstractions for container lifecycle management, health monitoring, dependency resolution, and integration with development tools.

## Installation

```bash
npm install @pact-toolbox/container-orchestrator
# or
pnpm add @pact-toolbox/container-orchestrator
```

## Features

- 🐳 **Container Lifecycle Management** - Create, start, stop, restart, and remove containers
- 🔗 **Dependency Resolution** - Automatic handling of container dependencies
- 🏥 **Health Monitoring** - Built-in health checks with event notifications
- 📊 **Metrics Collection** - CPU, memory, network, and disk I/O monitoring
- 🌐 **Network Management** - Automatic Docker network creation and cleanup
- 💾 **Volume Management** - Named volumes and bind mounts support
- 🎯 **Event System** - Typed events for container state changes
- 🎨 **TUI Integration** - Real-time status updates for terminal interfaces

## Quick Start

```typescript
import { ContainerOrchestrator } from '@pact-toolbox/container-orchestrator';

// Create orchestrator instance
const orchestrator = new ContainerOrchestrator({
  defaultNetwork: 'pact-dev',
  enableMetrics: true
});

// Start a container
await orchestrator.startContainer({
  id: 'pact-server',
  name: 'pact-server-1',
  image: 'kadena/pact',
  tag: 'latest',
  ports: [{ host: 9001, container: 9001 }],
  healthCheck: {
    test: ['CMD', 'curl', '-f', 'http://localhost:9001/health'],
    interval: '10s',
    retries: 3
  }
});

// Listen for events
orchestrator.on('healthy', ({ containerId }) => {
  console.log(`Container ${containerId} is healthy`);
});
```

## API Reference

### ContainerOrchestrator

Main class for managing Docker containers.

```typescript
new ContainerOrchestrator(options?: OrchestratorOptions)
```

#### Options

```typescript
interface OrchestratorOptions {
  defaultNetwork?: string;          // Default Docker network name
  defaultPullPolicy?: PullPolicy;   // 'always' | 'missing' | 'never'
  enableMetrics?: boolean;          // Enable performance metrics
  metricsInterval?: number;         // Metrics collection interval (ms)
  maxConcurrentOperations?: number; // Limit concurrent operations
  dockerOptions?: DockerOptions;    // Custom Docker connection options
  logger?: Logger;                  // Custom logger instance
}
```

### Container Configuration

```typescript
interface ContainerConfig {
  // Basic Configuration
  id: string;                       // Unique container identifier
  name: string;                     // Container name
  image: string;                    // Docker image name
  tag?: string;                     // Image tag (default: 'latest')
  
  // Runtime Configuration
  command?: string[];               // Override default command
  entrypoint?: string[];            // Override default entrypoint
  env?: Record<string, string>;     // Environment variables
  workingDir?: string;              // Working directory
  user?: string;                    // User to run as
  
  // Networking
  ports?: PortMapping[];            // Port mappings
  networks?: string[];              // Additional networks
  hostname?: string;                // Container hostname
  
  // Storage
  volumes?: VolumeMapping[];        // Volume mounts
  
  // Health Check
  healthCheck?: HealthCheckConfig;  // Health check configuration
  
  // Advanced Options
  restartPolicy?: RestartPolicy;    // Restart behavior
  labels?: Record<string, string>;  // Container labels
  privileged?: boolean;             // Run in privileged mode
  dependencies?: string[];          // Other container IDs
  pullPolicy?: PullPolicy;          // Image pull policy
}
```

### Methods

#### `startContainer(config: ContainerConfig): Promise<void>`

Starts a single container with the specified configuration.

```typescript
await orchestrator.startContainer({
  id: 'my-app',
  name: 'my-app-1',
  image: 'nginx',
  ports: [{ host: 8080, container: 80 }]
});
```

#### `startMany(configs: ContainerConfig[]): Promise<void>`

Starts multiple containers, respecting dependencies.

```typescript
await orchestrator.startMany([
  {
    id: 'db',
    name: 'postgres-db',
    image: 'postgres:15',
    env: { POSTGRES_PASSWORD: 'secret' }
  },
  {
    id: 'app',
    name: 'my-app',
    image: 'my-app:latest',
    dependencies: ['db']
  }
]);
```

#### `stopContainer(containerId: string, options?: StopOptions): Promise<void>`

Stops a specific container.

```typescript
await orchestrator.stopContainer('my-app', {
  timeout: 10,  // Seconds to wait before force killing
  force: false  // Force kill if timeout exceeded
});
```

#### `stopAll(options?: StopOptions): Promise<void>`

Stops all managed containers in dependency order.

```typescript
await orchestrator.stopAll({ cleanup: true });
```

#### `restartContainer(containerId: string): Promise<void>`

Restarts a specific container.

```typescript
await orchestrator.restartContainer('my-app');
```

#### `removeContainer(containerId: string, options?: RemoveOptions): Promise<void>`

Removes a container and optionally its volumes.

```typescript
await orchestrator.removeContainer('my-app', {
  removeVolumes: true,
  force: true
});
```

#### `getContainer(containerId: string): Container | undefined`

Gets container information.

```typescript
const container = orchestrator.getContainer('my-app');
if (container) {
  console.log(`Status: ${container.status}`);
}
```

#### `listContainers(): Container[]`

Lists all managed containers.

```typescript
const containers = orchestrator.listContainers();
containers.forEach(container => {
  console.log(`${container.id}: ${container.status}`);
});
```

#### `isHealthy(containerId: string): boolean`

Checks if a container is healthy.

```typescript
if (orchestrator.isHealthy('my-app')) {
  console.log('Container is healthy');
}
```

### Events

The orchestrator emits typed events for container lifecycle:

```typescript
orchestrator.on('created', ({ containerId, config }) => {
  console.log(`Container ${containerId} created`);
});

orchestrator.on('started', ({ containerId }) => {
  console.log(`Container ${containerId} started`);
});

orchestrator.on('stopped', ({ containerId }) => {
  console.log(`Container ${containerId} stopped`);
});

orchestrator.on('failed', ({ containerId, error }) => {
  console.error(`Container ${containerId} failed:`, error);
});

orchestrator.on('healthy', ({ containerId }) => {
  console.log(`Container ${containerId} is healthy`);
});

orchestrator.on('unhealthy', ({ containerId }) => {
  console.warn(`Container ${containerId} is unhealthy`);
});

orchestrator.on('metrics', ({ containerId, metrics }) => {
  console.log(`Container ${containerId} metrics:`, metrics);
});
```

## Advanced Configuration

### Port Mapping

```typescript
interface PortMapping {
  host: number;         // Host port
  container: number;    // Container port
  protocol?: 'tcp' | 'udp';  // Protocol (default: 'tcp')
}

// Example
const ports: PortMapping[] = [
  { host: 8080, container: 80 },
  { host: 8443, container: 443 },
  { host: 9000, container: 9000, protocol: 'udp' }
];
```

### Volume Mapping

```typescript
interface VolumeMapping {
  type: 'bind' | 'volume';  // Mount type
  source: string;           // Host path or volume name
  target: string;           // Container path
  readOnly?: boolean;       // Read-only mount
}

// Examples
const volumes: VolumeMapping[] = [
  // Bind mount
  { type: 'bind', source: './data', target: '/data' },
  
  // Named volume
  { type: 'volume', source: 'my-data', target: '/var/lib/data' },
  
  // Read-only mount
  { type: 'bind', source: './config', target: '/config', readOnly: true }
];
```

### Health Check Configuration

```typescript
interface HealthCheckConfig {
  test: string[];        // Health check command
  interval?: string;     // Check interval (e.g., '30s')
  timeout?: string;      // Check timeout (e.g., '5s')
  retries?: number;      // Retries before unhealthy
  startPeriod?: string;  // Grace period (e.g., '60s')
}

// Example
const healthCheck: HealthCheckConfig = {
  test: ['CMD-SHELL', 'curl -f http://localhost/health || exit 1'],
  interval: '30s',
  timeout: '10s',
  retries: 3,
  startPeriod: '60s'
};
```

### Restart Policies

```typescript
interface RestartPolicy {
  name: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  maximumRetryCount?: number;  // For 'on-failure' policy
}

// Examples
const policies: RestartPolicy[] = [
  { name: 'no' },
  { name: 'always' },
  { name: 'on-failure', maximumRetryCount: 5 },
  { name: 'unless-stopped' }
];
```

## Container Dependencies

Handle complex container dependencies:

```typescript
const configs: ContainerConfig[] = [
  {
    id: 'db',
    name: 'database',
    image: 'postgres:15'
  },
  {
    id: 'cache',
    name: 'redis-cache',
    image: 'redis:7'
  },
  {
    id: 'app',
    name: 'application',
    image: 'my-app:latest',
    dependencies: ['db', 'cache']  // Wait for both
  },
  {
    id: 'proxy',
    name: 'nginx-proxy',
    image: 'nginx:alpine',
    dependencies: ['app']  // Wait for app
  }
];

// Starts in order: db & cache -> app -> proxy
await orchestrator.startMany(configs);
```

## DevNet Integration

The orchestrator is used extensively for DevNet management:

```typescript
import { ContainerOrchestrator } from '@pact-toolbox/container-orchestrator';
import { createDevNetConfig } from './devnet-config';

async function startDevNet() {
  const orchestrator = new ContainerOrchestrator({
    defaultNetwork: 'devnet',
    enableMetrics: true
  });

  // Create DevNet configuration
  const configs = createDevNetConfig({
    bootstrapNode: {
      port: 30004,
      apiPort: 1848
    },
    miningClient: {
      stratum: 1917,
      onDemandMining: true
    },
    apiProxy: {
      port: 8080
    }
  });

  // Start all DevNet services
  await orchestrator.startMany(configs);

  // Monitor health
  orchestrator.on('healthy', ({ containerId }) => {
    console.log(`DevNet service ${containerId} is ready`);
  });

  return orchestrator;
}
```

## Performance Metrics

Enable metrics collection for monitoring:

```typescript
const orchestrator = new ContainerOrchestrator({
  enableMetrics: true,
  metricsInterval: 5000  // 5 seconds
});

orchestrator.on('metrics', ({ containerId, metrics }) => {
  console.log(`Container: ${containerId}`);
  console.log(`CPU: ${metrics.cpu.percentage}%`);
  console.log(`Memory: ${metrics.memory.used}/${metrics.memory.limit}`);
  console.log(`Network RX: ${metrics.network.rx_bytes}`);
  console.log(`Network TX: ${metrics.network.tx_bytes}`);
});
```

## Error Handling

```typescript
try {
  await orchestrator.startContainer(config);
} catch (error) {
  if (error.code === 'IMAGE_NOT_FOUND') {
    console.error('Docker image not found');
  } else if (error.code === 'PORT_IN_USE') {
    console.error('Port already in use');
  } else if (error.code === 'DEPENDENCY_FAILED') {
    console.error('Dependency container failed to start');
  }
}

// Handle events
orchestrator.on('failed', ({ containerId, error }) => {
  console.error(`Container ${containerId} failed:`, error.message);
  // Implement recovery logic
});
```

## Best Practices

### 1. Resource Cleanup

```typescript
// Always clean up resources
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await orchestrator.stopAll({ cleanup: true });
  process.exit(0);
});
```

### 2. Health Check Design

```typescript
// Use appropriate health checks
const healthCheck = {
  test: [
    'CMD-SHELL',
    'test -f /app/ready && curl -f http://localhost/health'
  ],
  interval: '30s',
  timeout: '10s',
  retries: 3,
  startPeriod: '120s'  // Allow time for initialization
};
```

### 3. Network Isolation

```typescript
// Use custom networks for isolation
const orchestrator = new ContainerOrchestrator({
  defaultNetwork: 'my-app-network'
});

// Containers on same network can communicate
await orchestrator.startMany([
  { id: 'backend', name: 'api', image: 'api:latest' },
  { id: 'frontend', name: 'web', image: 'web:latest' }
]);
```

### 4. Volume Persistence

```typescript
// Use named volumes for data persistence
const dbConfig: ContainerConfig = {
  id: 'database',
  name: 'postgres-db',
  image: 'postgres:15',
  volumes: [
    {
      type: 'volume',
      source: 'postgres-data',
      target: '/var/lib/postgresql/data'
    }
  ]
};
```

## Troubleshooting

### Common Issues

1. **"Cannot connect to Docker daemon"**
   - Ensure Docker is running
   - Check Docker socket permissions
   - Verify DOCKER_HOST environment variable

2. **"Port already in use"**
   - Check for conflicting containers
   - Use dynamic port allocation
   - Stop conflicting services

3. **"Container dependency failed"**
   - Check dependency container logs
   - Verify dependency health checks
   - Ensure correct startup order

4. **"Image pull failed"**
   - Verify image name and tag
   - Check network connectivity
   - Authenticate to registry if private

### Debug Mode

```typescript
const orchestrator = new ContainerOrchestrator({
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }
});

// Enable verbose Docker events
orchestrator.on('*', (event) => {
  console.debug('Docker event:', event);
});
```