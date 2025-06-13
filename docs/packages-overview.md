# Pact Toolbox Packages Overview

This document provides an overview of the Pact Toolbox monorepo structure, with a focus on the modernized TUI, process management, and container orchestration packages.

## Package Architecture

```
pact-toolbox/
├── packages/
│   ├── tui/                          # Terminal UI components
│   ├── process-manager/              # Process lifecycle management
│   ├── container-orchestrator/       # Docker container orchestration
│   ├── config/                       # Configuration management
│   ├── network/                      # Network management (uses TUI, process, container packages)
│   ├── test/                         # Testing framework (uses TUI)
│   ├── unplugin/                     # Bundler integration (uses TUI, process packages)
│   ├── client/                       # Pact client SDK
│   ├── runtime/                      # Runtime utilities
│   └── utils/                        # Legacy utilities (deprecated)
├── apps/
│   └── cli/                          # CLI application (uses TUI, process packages)
└── crates/
    └── pact-transformer/             # Rust-based Pact parser
```

## New Package Structure

### @pact-toolbox/tui

**Modern terminal user interface package with zero dependencies on other pact-toolbox packages.**

```typescript
import { tui, createSpinner, createProgress } from "@pact-toolbox/tui";

// Start monitoring
tui.start({
  refreshRate: 1000,
  enableInteraction: true,
});

// Add processes
tui.addProcess({
  id: "web-server",
  name: "Web Server",
  status: "running",
  pid: 12345,
  command: "npm",
  args: ["start"],
  logs: [],
});

// Update network status
tui.updateNetwork({
  id: "devnet",
  name: "Pact DevNet",
  status: "running",
  endpoints: [
    { name: "API", url: "http://localhost:8080", status: "up" },
  ],
});
```

**Features:**
- Real-time process, container, and network monitoring
- Interactive keyboard controls (Q: quit, R: restart, etc.)
- Customizable themes and layouts
- Automatic terminal size detection
- Rich components (spinners, progress bars, tables)

### @pact-toolbox/process-manager

**Modern process orchestration with dependency management and health checks.**

```typescript
import { createProcess, processPatterns, getOrchestrator } from "@pact-toolbox/process-manager";

// Start a web server with health checks
await createProcess(processPatterns.webServer({
  id: "api-server",
  name: "API Server",
  command: "node",
  args: ["server.js"],
  port: 3000,
  healthPath: "/health",
  dependencies: ["database"],
}));

// Start a database
await createProcess(processPatterns.database({
  id: "database",
  name: "PostgreSQL",
  command: "postgres",
  args: ["-D", "/var/lib/postgresql/data"],
  host: "localhost",
  port: 5432,
}));

// Coordinated shutdown
const orchestrator = getOrchestrator();
await orchestrator.shutdownAll();
```

**Features:**
- Process dependency management
- HTTP and TCP health checks
- Auto-restart with exponential backoff
- Process patterns for common scenarios
- Integration with TUI for monitoring
- Graceful shutdown coordination

### @pact-toolbox/container-orchestrator

**Docker container orchestration with network and volume management.**

```typescript
import { ContainerOrchestrator } from "@pact-toolbox/container-orchestrator";

const orchestrator = new ContainerOrchestrator({
  defaultNetwork: "pact-devnet",
  enableMetrics: true,
});

// Start containers with dependencies
await orchestrator.startMany([
  {
    id: "postgres",
    name: "PostgreSQL Database",
    image: "postgres",
    tag: "14",
    env: {
      POSTGRES_DB: "pact",
      POSTGRES_USER: "pact",
      POSTGRES_PASSWORD: "password",
    },
    ports: [{ host: 5432, container: 5432 }],
    volumes: [{ host: "postgres-data", container: "/var/lib/postgresql/data" }],
  },
  {
    id: "chainweb",
    name: "Chainweb Node",
    image: "kadena/chainweb-node",
    tag: "latest",
    ports: [{ host: 8080, container: 8080 }],
    dependencies: ["postgres"],
    healthCheck: {
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"],
      interval: "30s",
      timeout: "10s",
      retries: 3,
    },
  },
]);
```

**Features:**
- Docker container lifecycle management
- Network and volume creation
- Health check integration
- Dependency-based startup ordering
- Metrics collection and monitoring
- Integration with TUI for real-time status

## Package Dependencies

### Dependency Graph

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────────┐
│       TUI       │    │   Process Manager    │    │ Container Orchestrator  │
│  (no internal   │    │                      │    │                         │
│  dependencies)  │    │   depends on: TUI    │    │   depends on: TUI       │
└─────────────────┘    └──────────────────────┘    └─────────────────────────┘
         │                        │                           │
         └────────────────────────┼───────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼────────┐ ┌────────▼─────────┐ ┌──────▼──────────┐
    │     Network      │ │       CLI        │ │    Unplugin     │
    │                  │ │                  │ │                 │
    │ depends on: TUI, │ │ depends on: TUI, │ │ depends on:     │
    │ process-manager, │ │ process-manager  │ │ TUI,            │
    │ container-orch.  │ │                  │ │ process-manager │
    └──────────────────┘ └──────────────────┘ └─────────────────┘
```

### Rationale for Package Separation

1. **@pact-toolbox/tui**: 
   - Zero internal dependencies
   - Can be used by any package for UI
   - Modern, lightweight terminal interface
   - Replaces scattered UI code across packages

2. **@pact-toolbox/process-manager**:
   - Focused on process lifecycle only
   - Uses TUI for monitoring
   - Replaces complex process management in utils
   - Modern APIs using execa, p-queue

3. **@pact-toolbox/container-orchestrator**:
   - Docker-specific orchestration
   - Uses TUI for container monitoring
   - Replaces DockerService and ContainerOrchestrator in utils
   - Modern container management patterns

## Migration from Legacy Utils

### Before (packages/utils)

```typescript
// Scattered across multiple files
import { logger, spinner } from "@pact-toolbox/utils";
import { ContainerOrchestrator, DockerService } from "@pact-toolbox/utils";
import { processManager, enhancedProcessManager } from "@pact-toolbox/utils";
import { TUIManager, debugLogger } from "@pact-toolbox/utils";
```

### After (modern packages)

```typescript
// Clean, focused imports
import { tui, createSpinner } from "@pact-toolbox/tui";
import { createProcess, processPatterns } from "@pact-toolbox/process-manager";
import { ContainerOrchestrator } from "@pact-toolbox/container-orchestrator";
```

## Package Usage by Consumer

### Network Package
```typescript
// packages/network/src/networks/devnet.ts
import { tui } from "@pact-toolbox/tui";
import { createProcess, processPatterns } from "@pact-toolbox/process-manager";
import { ContainerOrchestrator } from "@pact-toolbox/container-orchestrator";

// Start blockchain node with monitoring
await createProcess(processPatterns.blockchainNode({
  id: "chainweb-node",
  name: "Chainweb Node",
  command: "chainweb-node",
  args: ["--config-file=/etc/chainweb.yaml"],
  rpcPort: 8080,
}));

// Start containers for supporting services
const orchestrator = new ContainerOrchestrator();
await orchestrator.startContainer({
  id: "postgres",
  name: "Database",
  image: "postgres:14",
  // ... config
});
```

### CLI Package
```typescript
// apps/cli/src/commands/start.ts
import { tui } from "@pact-toolbox/tui";

export const startCommand = defineCommand({
  async run({ args }) {
    // Start TUI monitoring
    tui.start({
      refreshRate: 1000,
      enableInteraction: true,
    });
    
    // Network startup with visual feedback
    tui.log("info", "cli", "Starting Pact DevNet...");
    await createPactToolboxNetwork(config);
    tui.log("success", "cli", "DevNet started successfully");
  },
});
```

### Unplugin Package
```typescript
// packages/unplugin/src/next.ts
import { tui } from "@pact-toolbox/tui";
import { processPatterns, getOrchestrator } from "@pact-toolbox/process-manager";

// Start network worker process
const orchestrator = getOrchestrator();
await orchestrator.start(processPatterns.worker({
  id: "next-network-worker",
  name: "Next.js Network Worker",
  command: process.execPath,
  args: [workerPath],
  healthCommand: "curl -f http://localhost:8080/health",
}));

// Update TUI with network info
tui.updateNetwork({
  id: "next-devnet",
  name: "Next.js DevNet",
  status: "running",
  endpoints: [
    { name: "API", url: "http://localhost:8080", status: "up" },
  ],
});
```

## Benefits of New Architecture

### 1. **Separation of Concerns**
- Each package has a single, clear responsibility
- No circular dependencies
- Easier to test and maintain

### 2. **Modern Dependencies**
- Uses modern packages like `execa`, `p-queue`, `dockerode`
- Smaller, focused dependencies
- Better performance and reliability

### 3. **Improved Developer Experience**
- Consistent APIs across packages
- Rich TUI for all development workflows
- Better error handling and debugging

### 4. **Scalability**
- Packages can be used independently
- Easy to add new process patterns
- Extensible plugin system

### 5. **Maintainability**
- Clear package boundaries
- Focused testing per package
- Independent versioning possible

## Best Practices

### 1. **Package Selection**
- Use `@pact-toolbox/tui` for any terminal UI needs
- Use `@pact-toolbox/process-manager` for process orchestration
- Use `@pact-toolbox/container-orchestrator` for Docker containers
- Avoid `@pact-toolbox/utils` for new code (legacy support only)

### 2. **TUI Integration**
- Always use the global `tui` instance for consistency
- Log important events for user visibility
- Update status information in real-time

### 3. **Process Management**
- Use process patterns for common scenarios
- Always define health checks for long-running processes
- Set up proper dependencies for startup ordering

### 4. **Container Orchestration**
- Use dependency ordering for multi-container setups
- Define proper health checks for containers
- Use named volumes for data persistence

## Future Roadmap

1. **Phase 1** (Current): Core package implementation
2. **Phase 2**: Migrate all consumers to new packages
3. **Phase 3**: Deprecate legacy utils package
4. **Phase 4**: Add advanced features (clustering, load balancing)
5. **Phase 5**: Extract packages for broader ecosystem use