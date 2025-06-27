# @pact-toolbox/docker

> Simple and powerful Docker container orchestration with Docker Compose support

## Overview

The `@pact-toolbox/docker` package provides a clean, TypeScript-first approach to Docker container orchestration. It focuses on simplicity while supporting all Docker Compose features you need for Pact development environments.

## Installation

```bash
npm install @pact-toolbox/docker
# or
pnpm add @pact-toolbox/docker
```

## Features

- 🐳 **Container Lifecycle Management** - Create, start, stop, and remove containers
- 🔗 **Dependency Resolution** - Support for `depends_on` with health conditions
- 🏥 **Health Monitoring** - Built-in health checks with configurable timeouts
- 🌐 **Network Management** - Custom networks with automatic creation
- 💾 **Volume Management** - Named volumes and bind mounts
- 📄 **Docker Compose Support** - Convert compose services to TypeScript configs
- 🎯 **Type Safety** - Full TypeScript support with comprehensive types
- 📝 **Logging** - Structured logging with service-specific tags
- 🔄 **Graceful Shutdown** - Proper cleanup on process termination

## Quick Start

```typescript
import { ContainerOrchestrator } from "@pact-toolbox/docker";

// Create orchestrator instance
const orchestrator = new ContainerOrchestrator({
  networkName: "pact-dev",
});

// Define services
const services = [{
  containerName: "pact-server",
  image: "kadena/pact:latest",
  ports: [{ target: 9001, published: 9001 }],
  healthCheck: {
    Test: ["CMD", "curl", "-f", "http://localhost:9001/health"],
    Interval: 10000000000, // 10s in nanoseconds
    Retries: 3,
  },
}];

// Start services
await orchestrator.startServices(services);
console.log("Pact server is running!");

// Graceful shutdown
process.on("SIGINT", async () => {
  await orchestrator.stopAllServices();
  process.exit(0);
});
```

## Docker Compose Support

### Converting Existing docker-compose.yml

```typescript
import { convertComposeService } from "@pact-toolbox/docker";

// Your existing docker-compose service
const composeService = {
  image: "postgres:15",
  environment: {
    POSTGRES_PASSWORD: "secret",
    POSTGRES_DB: "myapp"
  },
  ports: ["5432:5432"],
  volumes: ["postgres_data:/var/lib/postgresql/data"],
  healthcheck: {
    test: ["CMD-SHELL", "pg_isready -U postgres"],
    interval: "10s",
    timeout: "5s",
    retries: 5
  }
};

// Convert to our format
const serviceConfig = convertComposeService("database", composeService);

// Use with orchestrator
const orchestrator = new ContainerOrchestrator({ networkName: "myapp" });
await orchestrator.startServices([serviceConfig]);
```

### Example: Multi-Service Setup

```typescript
import { ContainerOrchestrator, convertComposeService } from "@pact-toolbox/docker";

const orchestrator = new ContainerOrchestrator({
  networkName: "myapp-network",
  volumes: ["postgres_data", "redis_data"]
});

// Database service
const database = convertComposeService("database", {
  image: "postgres:15-alpine",
  environment: {
    POSTGRES_PASSWORD: "secret",
    POSTGRES_DB: "myapp"
  },
  volumes: ["postgres_data:/var/lib/postgresql/data"],
  healthcheck: {
    test: ["CMD-SHELL", "pg_isready -U postgres"],
    interval: "10s",
    retries: 5
  }
});

// Cache service
const cache = convertComposeService("cache", {
  image: "redis:7-alpine",
  volumes: ["redis_data:/data"],
  command: ["redis-server", "--appendonly", "yes"]
});

// Application service
const app = convertComposeService("app", {
  image: "node:20-alpine",
  ports: ["3000:3000"],
  environment: {
    DATABASE_URL: "postgresql://postgres:secret@database:5432/myapp",
    REDIS_URL: "redis://cache:6379"
  },
  depends_on: {
    database: { condition: "service_healthy" },
    cache: { condition: "service_started" }
  },
  working_dir: "/app",
  volumes: ["./app:/app"],
  command: ["npm", "start"]
});

// Start all services in dependency order
await orchestrator.startServices([database, cache, app]);
```

## API Reference

### ContainerOrchestrator

Main class for managing Docker containers and services.

```typescript
class ContainerOrchestrator {
  constructor(config: OrchestratorConfig)
  
  // Start multiple services with dependency resolution
  async startServices(services: DockerServiceConfig[]): Promise<void>
  
  // Stop all running services
  async stopAllServices(): Promise<void>
  
  // Stream logs from all services
  async streamAllLogs(): Promise<void>
  
  // Stop all log streams
  stopAllLogStreams(): void
  
  // Setup graceful shutdown handlers
  setupGracefulShutdown(): void
}
```

#### Configuration

```typescript
interface OrchestratorConfig {
  networkName: string;           // Docker network name
  volumes?: string[];           // Named volumes to create
  networks?: NetworkConfig[];   // Additional networks
  secrets?: SecretDefinition[]; // Docker secrets
  configs?: ConfigDefinition[]; // Docker configs
  defaultRestartPolicy?: string; // Default restart policy
  logger?: Logger;              // Custom logger instance
}
```

### Service Configuration

```typescript
interface DockerServiceConfig {
  // Basic configuration
  containerName: string;        // Container name
  image?: string;              // Docker image
  platform?: string;          // Platform (e.g., "linux/amd64")
  
  // Build configuration
  build?: {
    context: string;           // Build context path
    dockerfile?: string;       // Dockerfile path
    args?: Record<string, string>; // Build arguments
    target?: string;           // Build target
    // ... more build options
  };
  
  // Runtime configuration
  command?: string[];          // Command to run
  entrypoint?: string | string[]; // Entry point
  environment?: string[] | Record<string, string>; // Environment variables
  envFile?: string | string[]; // Environment files
  workingDir?: string;         // Working directory
  user?: string;              // User to run as
  
  // Networking
  ports?: Array<{
    target: number;            // Container port
    published: string | number; // Host port
    protocol?: string;         // Protocol (tcp/udp)
    mode?: "host" | "ingress"; // Port mode
  }>;
  networks?: string[] | Record<string, NetworkAttachConfig>;
  hostname?: string;
  expose?: string[];          // Exposed ports
  
  // Storage
  volumes?: string[] | VolumeConfig[];
  tmpfs?: string | string[];
  
  // Health checks
  healthCheck?: {
    Test: string[];            // Health check command
    Interval?: number;         // Interval in nanoseconds
    Timeout?: number;          // Timeout in nanoseconds
    Retries?: number;          // Number of retries
    StartPeriod?: number;      // Start period in nanoseconds
  };
  
  // Dependencies
  dependsOn?: Record<string, {
    condition: "service_started" | "service_healthy" | "service_completed_successfully";
    required?: boolean;
  }>;
  
  // Resource limits
  memLimit?: string;           // Memory limit (e.g., "512m")
  cpuShares?: number;         // CPU shares
  deploy?: {
    replicas?: number;         // Number of replicas
    resources?: {
      limits?: {
        cpus?: string;         // CPU limit
        memory?: string;       // Memory limit
      };
    };
    restartPolicy?: {
      condition?: "on-failure" | "none" | "always" | "unless-stopped";
      maxAttempts?: number;
    };
  };
  
  // Security
  privileged?: boolean;        // Privileged mode
  capAdd?: string[];          // Capabilities to add
  capDrop?: string[];         // Capabilities to drop
  
  // Other options
  restart?: string;           // Restart policy
  labels?: Record<string, string>; // Labels
  profiles?: string[];        // Compose profiles
}
```

### Utility Functions

```typescript
// Convert Docker Compose service to our format
function convertComposeService(
  serviceName: string,
  composeService: any
): DockerServiceConfig

// Parse time strings (e.g., "30s", "1m30s") to seconds
function parseTime(timeStr: string): number

// Validate service configuration
function validateServiceConfig(config: DockerServiceConfig): string[]

// Get color function for service logs
function getServiceColor(serviceName: string): ColorFunction
```

## Examples

### Pact Development Environment

```typescript
import { ContainerOrchestrator, convertComposeService } from "@pact-toolbox/docker";

const orchestrator = new ContainerOrchestrator({
  networkName: "pact-devnet",
  volumes: ["chainweb_db", "pact_data"]
});

// Chainweb node
const chainweb = convertComposeService("chainweb", {
  image: "ghcr.io/kadena-io/chainweb-node:latest",
  volumes: ["chainweb_db:/chainweb/db"],
  ports: ["1848:1848", "1789:1789"],
  command: [
    "--p2p-hostname=chainweb",
    "--enable-mining-coordination",
    "--disable-pow"
  ],
  healthcheck: {
    test: ["CMD", "curl", "-f", "http://localhost:1848/health-check"],
    interval: "30s",
    retries: 3
  }
});

// Pact server
const pact = convertComposeService("pact", {
  image: "kadena/pact:latest",
  ports: ["9001:9001"],
  volumes: ["pact_data:/pact/data"],
  depends_on: {
    chainweb: { condition: "service_healthy" }
  },
  environment: {
    CHAINWEB_NODE: "http://chainweb:1848"
  }
});

// Start development environment
await orchestrator.startServices([chainweb, pact]);
console.log("Pact development environment is ready!");
```

### Testing Environment

```typescript
import { ContainerOrchestrator } from "@pact-toolbox/docker";

const testOrchestrator = new ContainerOrchestrator({
  networkName: "test-network"
});

// Test database
const testDb = {
  containerName: "test-db",
  image: "postgres:15-alpine",
  environment: {
    POSTGRES_PASSWORD: "test",
    POSTGRES_DB: "testdb"
  },
  tmpfs: ["/var/lib/postgresql/data"], // Use tmpfs for faster tests
  healthCheck: {
    Test: ["CMD-SHELL", "pg_isready -U postgres"],
    Interval: 5000000000, // 5s
    Retries: 3
  }
};

// Start test database
await testOrchestrator.startServices([testDb]);

// Run your tests
try {
  // ... run tests
  console.log("Tests completed!");
} finally {
  // Clean up
  await testOrchestrator.stopAllServices();
}
```

## Best Practices

### 1. Always Use Health Checks

```typescript
const service = {
  containerName: "my-service",
  image: "my-app:latest",
  healthCheck: {
    Test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
    Interval: 30000000000, // 30s in nanoseconds
    Timeout: 10000000000,  // 10s in nanoseconds
    Retries: 3,
    StartPeriod: 60000000000 // 60s for startup
  }
};
```

### 2. Use Dependency Conditions

```typescript
const services = [
  {
    containerName: "database",
    image: "postgres:15",
    healthCheck: { /* ... */ }
  },
  {
    containerName: "app",
    image: "my-app:latest",
    dependsOn: {
      database: { condition: "service_healthy" }
    }
  }
];
```

### 3. Graceful Shutdown

```typescript
const orchestrator = new ContainerOrchestrator({ networkName: "myapp" });

// Use built-in graceful shutdown
orchestrator.setupGracefulShutdown();

// Or implement custom shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await orchestrator.stopAllServices();
  process.exit(0);
});
```

### 4. Resource Limits

```typescript
const service = {
  containerName: "memory-limited-app",
  image: "my-app:latest",
  memLimit: "512m",
  deploy: {
    resources: {
      limits: {
        cpus: "0.5",
        memory: "512m"
      }
    }
  }
};
```

## Troubleshooting

### Common Issues

1. **"Cannot connect to Docker daemon"**
   - Ensure Docker is running: `docker info`
   - Check permissions: Add user to `docker` group
   - Verify socket: `ls -la /var/run/docker.sock`

2. **"Port already in use"**
   - Check running containers: `docker ps`
   - Use different ports or stop conflicting services
   - Use dynamic ports: `published: "0"`

3. **"Container dependency failed"**
   - Check health checks are properly configured
   - Increase `StartPeriod` for slow-starting services
   - Verify dependency container logs

4. **"Image pull failed"**
   - Check image name and tag
   - Verify network connectivity
   - Login to private registries: `docker login`

### Debug Mode

Enable debug logging:

```typescript
import { logger } from "@pact-toolbox/node-utils";

// Set debug level
const orchestrator = new ContainerOrchestrator({
  networkName: "myapp",
  logger: logger.create({ level: "debug" })
});
```

## License

MIT