# @pact-toolbox/docker

Modern Docker container orchestration library for Node.js with Docker Compose-like features.

## Features

- 🚀 **Simple API** - Easy to use programmatic interface for Docker containers
- 🔄 **Auto-recovery** - Automatic container restart with exponential backoff
- 🏗️ **Build Support** - Build images from Dockerfiles
- 🔗 **Dependencies** - Service dependencies with health check conditions
- 🌐 **Networking** - Automatic network creation and management
- 💾 **Volumes** - Named volumes and bind mounts support
- 🏥 **Health Checks** - Built-in health monitoring and recovery
- 🧹 **Cleanup** - Automatic cleanup of containers and networks
- 📊 **Resource Limits** - CPU and memory limits with smart defaults

## Installation

```bash
npm install @pact-toolbox/docker
# or
pnpm add @pact-toolbox/docker
```

## Quick Start

```typescript
import { ContainerOrchestrator } from '@pact-toolbox/docker';

const orchestrator = new ContainerOrchestrator({
  networkName: 'my-network',
});

const service = {
  containerName: 'my-nginx',
  image: 'nginx:alpine',
  ports: [{ target: 80, published: 8080 }],
};

// Start the service
await orchestrator.startServices([service]);

// Stop all services
await orchestrator.stopAllServices();
```

## Docker Compose-like Example

```typescript
import { ContainerOrchestrator } from '@pact-toolbox/docker';
import type { DockerServiceConfig } from '@pact-toolbox/docker';

const orchestrator = new ContainerOrchestrator({
  networkName: 'app-network',
  volumes: ['postgres_data'],
});

const services: DockerServiceConfig[] = [
  // Database
  {
    containerName: 'postgres',
    image: 'postgres:15-alpine',
    environment: {
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_DB: 'appdb',
    },
    volumes: ['postgres_data:/var/lib/postgresql/data'],
    ports: [{ target: 5432, published: 5432 }],
    healthCheck: {
      Test: ['CMD-SHELL', 'pg_isready -U postgres'],
      Interval: 10000000000, // 10s in nanoseconds
      Timeout: 5000000000,   // 5s
      Retries: 5,
    },
  },
  // Application
  {
    containerName: 'app',
    image: 'node:18-alpine',
    dependsOn: {
      'postgres': { condition: 'service_healthy' },
    },
    environment: {
      DATABASE_URL: 'postgresql://postgres:secret@postgres:5432/appdb',
    },
    volumes: ['./app:/app'],
    workingDir: '/app',
    command: ['npm', 'start'],
    ports: [{ target: 3000, published: 3000 }],
  },
];

// Setup graceful shutdown
orchestrator.setupGracefulShutdown();

// Start all services
await orchestrator.startServices(services);

// Stream logs
await orchestrator.streamAllLogs();
```

## API Reference

### ContainerOrchestrator

```typescript
class ContainerOrchestrator {
  constructor(config: OrchestratorConfig);

  // Core methods
  startServices(services: DockerServiceConfig[]): Promise<void>;
  stopAllServices(): Promise<void>;
  setupGracefulShutdown(): void;

  // Logging
  streamAllLogs(): Promise<void>;
  stopAllLogStreams(): void;

  // Service inspection
  isServiceHealthy(serviceName: string): Promise<boolean>;
  getServiceLogs(serviceName: string, tail?: number): Promise<string[]>;
  getService(serviceName: string): DockerService | undefined;
}
```

### Configuration Types

```typescript
interface OrchestratorConfig {
  networkName: string;
  volumes?: string[];
  logger?: Logger;
}

interface DockerServiceConfig {
  // Required
  containerName: string;
  image?: string;

  // Build
  build?: {
    context: string;
    dockerfile?: string;
    args?: Record<string, string>;
  };

  // Runtime
  command?: string[];
  entrypoint?: string | string[];
  environment?: Record<string, string> | string[];
  workingDir?: string;
  user?: string;

  // Networking
  ports?: Array<{
    target: number;
    published: number | string;
    protocol?: 'tcp' | 'udp';
  }>;
  hostname?: string;

  // Storage
  volumes?: string[];
  tmpfs?: string | string[];

  // Dependencies
  dependsOn?: Record<string, {
    condition: 'service_started' | 'service_healthy';
  }>;

  // Resources
  memLimit?: string;  // e.g., '512m'
  cpus?: number;      // e.g., 1.5

  // Health
  healthCheck?: {
    Test: string[];
    Interval?: number;  // nanoseconds
    Timeout?: number;   // nanoseconds
    Retries?: number;
    StartPeriod?: number;
  };

  // Lifecycle
  restart?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
  stopGracePeriod?: number;

  // Labels
  labels?: Record<string, string>;
}
```

## Utility Functions

```typescript
import { parseTime, parseMemory } from '@pact-toolbox/docker';

// Parse time strings
parseTime('30s');    // 30
parseTime('1m30s');  // 90
parseTime('2h');     // 7200

// Parse memory strings
parseMemory('512m'); // 536870912
parseMemory('1g');   // 1073741824
```

## Examples

Run the included examples:

```bash
# Basic single container
npx tsx examples/basic.ts

# Multi-service with dependencies
npx tsx examples/compose.ts

# Build from Dockerfile
npx tsx examples/build.ts
```

## Features in Detail

### Auto-Recovery

Services are automatically monitored and restarted on failure:

- Health checks every 30 seconds
- Exponential backoff on restart (5s, 10s, 20s)
- Maximum 3 restart attempts by default
- Automatic cleanup of failed containers

### Resource Management

Prevent resource exhaustion with limits:

```typescript
{
  containerName: 'app',
  image: 'node:18',
  memLimit: '512m',
  cpus: 1.5,
  // Smart defaults applied based on image
}
```

### Volume Management

```typescript
{
  volumes: [
    'named_volume:/data',           // Named volume
    './host/path:/container/path',  // Bind mount
    '/abs/path:/path:ro',          // Read-only
  ]
}
```

### Health Monitoring

```typescript
{
  healthCheck: {
    Test: ['CMD', 'curl', '-f', 'http://localhost/health'],
    Interval: 30000000000,  // 30s
    Timeout: 10000000000,   // 10s
    Retries: 3,
    StartPeriod: 60000000000, // 60s grace period
  }
}
```

## Best Practices

1. **Always use health checks** for production services
2. **Set resource limits** to prevent resource exhaustion
3. **Use named volumes** for persistent data
4. **Handle graceful shutdown** with `setupGracefulShutdown()`
5. **Use dependency conditions** for service ordering

## Requirements

- Docker installed and running
- Node.js >= 20.0.0

## License

MIT