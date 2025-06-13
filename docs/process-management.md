# Process Management in Pact Toolbox

This document describes the comprehensive process management system implemented in Pact Toolbox, which provides robust orchestration, monitoring, and debugging capabilities for development environments.

## Overview

The process management system consists of three main components:

1. **ProcessManager** - Core process lifecycle management
2. **EnhancedProcessManager** - Advanced features with dependencies, health checks, and TUI integration
3. **TUIManager** - Real-time terminal user interface for monitoring
4. **DebugLogger** - Comprehensive debugging and logging system

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced Process Manager                  │
├─────────────────────────────────────────────────────────────┤
│  • Dependency Management    • Health Checks                 │
│  • Process Categories      • Graceful Shutdown              │
│  • TUI Integration         • Error Recovery                 │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                      Process Manager                        │
├─────────────────────────────────────────────────────────────┤
│  • Process Spawning         • State Tracking                │
│  • Signal Handling          • Auto-restart                  │
│  • Timeout Management       • Event System                  │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                     System Processes                       │
├─────────────────────────────────────────────────────────────┤
│  • DevNet Containers        • Mining Trigger                │
│  • Network Workers          • Build Processes               │
│  • Health Check Services    • Log Aggregators               │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### ProcessManager

The `ProcessManager` class provides fundamental process lifecycle management:

```typescript
import { processManager } from "@pact-toolbox/utils";

// Start a process
await processManager.start({
  id: "my-service",
  command: "node",
  args: ["server.js"],
  cwd: "/path/to/app",
  timeout: 30000,
  autoRestart: true,
  retries: 3,
  gracefulShutdownTimeout: 10000,
});

// Check process status
const state = processManager.getProcessState("my-service");
console.log(state?.status); // "running" | "stopped" | "failed" | etc.

// Stop a process
await processManager.stop("my-service");

// Stop all processes
await processManager.stopAll();
```

#### Features

- **Process Spawning**: Reliable process creation with error handling
- **State Tracking**: Real-time process status monitoring
- **Auto-restart**: Configurable automatic restart on failure
- **Graceful Shutdown**: Proper cleanup with configurable timeouts
- **Signal Handling**: SIGTERM/SIGINT/SIGKILL support
- **Event System**: Subscribe to process lifecycle events

### EnhancedProcessManager

The `EnhancedProcessManager` extends the base functionality with advanced features:

```typescript
import { enhancedProcessManager } from "@pact-toolbox/utils";

// Start a process with dependencies and health checks
await enhancedProcessManager.startProcess({
  id: "web-app",
  displayName: "Web Application",
  category: "service",
  command: "npm",
  args: ["start"],
  dependencies: ["database", "redis"],
  healthCheck: {
    url: "http://localhost:3000/health",
    interval: 30000,
    timeout: 5000,
    retries: 3,
  },
});

// Enable TUI monitoring
enhancedProcessManager.enableTUI({
  refreshRate: 1000,
  showDebugLogs: true,
});

// Get processes by category
const services = enhancedProcessManager.getProcessesByCategory("service");
const networks = enhancedProcessManager.getProcessesByCategory("network");
```

#### Features

- **Dependency Management**: Start processes in correct order based on dependencies
- **Health Checks**: HTTP and command-based health monitoring
- **Process Categories**: Organize processes by type (service, network, container, bundler)
- **TUI Integration**: Real-time visual monitoring interface
- **Enhanced Logging**: Structured logging with categories and levels
- **Coordinated Shutdown**: Intelligent shutdown order based on dependencies

### TUIManager

The `TUIManager` provides a real-time terminal interface for monitoring:

```typescript
import { TUIManager } from "@pact-toolbox/utils";

const tui = new TUIManager({
  refreshRate: 1000,
  maxLogs: 100,
  showDebugLogs: false,
  theme: {
    colors: {
      primary: "#3b82f6",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
  },
});

tui.start();

// Update process information
tui.updateProcesses([
  {
    id: "web-server",
    name: "Web Server",
    status: "running",
    pid: 12345,
    startTime: new Date(),
    cpu: 15.5,
    memory: 256 * 1024 * 1024, // 256MB
    logs: ["Server started on port 3000"],
  },
]);

// Handle events
tui.on("restart", () => {
  console.log("User requested restart");
});
```

#### Features

- **Real-time Display**: Live updating process, container, and network status
- **Interactive Controls**: Keyboard shortcuts for common operations
- **Log Streaming**: Real-time log aggregation and display
- **Status Indicators**: Color-coded status symbols and health indicators
- **Resource Monitoring**: CPU, memory, and network usage display
- **Customizable Theme**: Configurable colors and symbols

### DebugLogger

The `DebugLogger` provides comprehensive debugging and audit trails:

```typescript
import { debugLogger } from "@pact-toolbox/utils";

// Basic logging
debugLogger.info("network", "Network started successfully", { networkId: "net-123" });
debugLogger.error("process", "Process failed to start", { error: "Command not found" });

// Specialized logging
debugLogger.logProcess("web-server", "info", "Server listening", { port: 3000 });
debugLogger.logContainer("nginx", "warn", "High memory usage", { memory: "512MB" });
debugLogger.logNetwork("devnet", "debug", "Block mined", { height: 1000 });

// Performance tracking
debugLogger.logPerformance("startup", "Container creation", 2500, { containerCount: 5 });

// HTTP activity
debugLogger.logHTTPActivity("GET", "/health", 200, 150, { userAgent: "curl" });

// Resource monitoring
debugLogger.logResourceUsage("system", {
  cpu: 45.2,
  memory: 78.5,
  disk: 23.1,
});
```

#### Features

- **Structured Logging**: Categorized logs with metadata
- **File Rotation**: Automatic log file management
- **Performance Tracking**: Operation timing and resource usage
- **HTTP Activity Logging**: Request/response monitoring
- **Real-time and File Output**: Console and persistent file logging
- **Configurable Levels**: Debug, trace, info, warn, error levels

## DevNet Integration

### Container Orchestration

The process management system integrates with Docker for container orchestration:

```typescript
import { ContainerOrchestrator } from "@pact-toolbox/utils";

const orchestrator = new ContainerOrchestrator({
  networkName: "pact-devnet",
  volumes: ["pact-data", "pact-logs"],
  logger: debugLogger,
  spinner: tuiSpinner,
});

// Start multiple services with dependencies
await orchestrator.startServices([
  {
    containerName: "pact-chainweb",
    image: "kadena/chainweb-node:latest",
    ports: [{ published: 8080, target: 8080 }],
    healthCheck: {
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"],
      interval: "30s",
      timeout: "10s",
      retries: 3,
    },
  },
  {
    containerName: "pact-mining-trigger",
    image: "pact-toolbox/mining-trigger:latest",
    dependsOn: {
      "pact-chainweb": { condition: "service_healthy" },
    },
    ports: [{ published: 9000, target: 9000 }],
  },
]);
```

### Network Worker Process

Enhanced network worker with better process management:

```typescript
// packages/unplugin/src/enhanced-network-worker.ts
class NetworkWorker {
  async start() {
    // Register with enhanced process manager
    await enhancedProcessManager.startProcess({
      id: "pact-network",
      displayName: "Pact Toolbox Network",
      category: "network",
      healthCheck: {
        url: "http://localhost:8080/health",
        interval: 30000,
        timeout: 5000,
      },
    });

    // Start network with monitoring
    await this.network.start();
    this.startHealthMonitoring();
  }

  private async gracefulShutdown() {
    await this.network.stop();
    await enhancedProcessManager.gracefulShutdown();
  }
}
```

## Bundler Integration

### Next.js Integration

Improved Next.js integration with robust process management:

```typescript
// packages/unplugin/src/next.ts
function withPactToolbox(options = {}) {
  return async (nextConfig = {}) => {
    // Start network worker with enhanced process management
    await enhancedProcessManager.startProcess({
      id: "next-network-worker",
      displayName: "Next.js Network Worker",
      category: "bundler",
      command: process.execPath,
      args: [workerPath],
      autoRestart: true,
      retries: 3,
      gracefulShutdownTimeout: 15000,
      healthCheck: {
        interval: 30000,
        timeout: 5000,
      },
    });

    // Set up coordinated shutdown
    const handleShutdown = async (signal) => {
      await enhancedProcessManager.gracefulShutdown();
    };

    if (!process.listenerCount("SIGINT")) {
      process.on("SIGINT", handleShutdown);
      process.on("SIGTERM", handleShutdown);
    }

    return enhancedConfig;
  };
}
```

### Webpack/Vite Integration

Similar improvements for other bundlers:

```typescript
// Enhanced shutdown handling in webpack plugin
compiler.hooks.shutdown.tap(PLUGIN_NAME, async () => {
  try {
    await enhancedProcessManager.gracefulShutdown();
  } catch (error) {
    debugLogger.error("webpack-plugin", "Shutdown error", { error });
  }
});

// Vite integration
vite: {
  closeBundle: async () => {
    await enhancedProcessManager.gracefulShutdown();
  },
}
```

## Error Handling and Recovery

### Process Failure Recovery

The system provides multiple layers of error recovery:

1. **Automatic Restart**: Failed processes can be automatically restarted
2. **Exponential Backoff**: Delays between restart attempts to prevent thrashing
3. **Retry Limits**: Maximum number of restart attempts before marking as failed
4. **Dependency Awareness**: Dependent processes are restarted when dependencies recover

```typescript
await enhancedProcessManager.startProcess({
  id: "unstable-service",
  displayName: "Unstable Service",
  category: "service",
  command: "node",
  args: ["unstable-app.js"],
  autoRestart: true,
  retries: 5, // Try up to 5 times
  gracefulShutdownTimeout: 15000,
});

// Listen for crashes and recovery
enhancedProcessManager.on("processCrashed", (processId, state) => {
  debugLogger.error("process-manager", `Process ${processId} crashed`, {
    exitCode: state.exitCode,
    signal: state.signal,
    restartCount: state.restartCount,
  });
});

enhancedProcessManager.on("processRestarted", (processId, state) => {
  debugLogger.info("process-manager", `Process ${processId} restarted`, {
    restartCount: state.restartCount,
  });
});
```

### Health Check Failure Handling

Health checks can trigger recovery actions:

```typescript
enhancedProcessManager.on("healthCheckFailed", async (processId) => {
  const processInfo = enhancedProcessManager.getProcessState(processId);
  
  if (processInfo?.restartCount < 3) {
    debugLogger.warn("health-check", `Restarting unhealthy process ${processId}`);
    await enhancedProcessManager.restartProcess(processId);
  } else {
    debugLogger.error("health-check", `Process ${processId} repeatedly failing health checks`);
    // Could trigger alerts, notifications, etc.
  }
});
```

## Configuration

### Environment Variables

The system can be configured via environment variables:

```bash
# Debug logging
DEBUG=true
DEBUG_LEVEL=debug
DEBUG_CATEGORIES=process,network,container
DEBUG_CONSOLE=true

# Process management
PROCESS_SHUTDOWN_TIMEOUT=30000
PROCESS_RESTART_DELAY=5000
PROCESS_MAX_RETRIES=3

# TUI settings
TUI_REFRESH_RATE=1000
TUI_MAX_LOGS=100
TUI_ENABLE_DEBUG=false

# Health checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_RETRIES=3
```

### Programmatic Configuration

```typescript
import { enhancedProcessManager, debugLogger } from "@pact-toolbox/utils";

// Configure debug logging
debugLogger.enableCategory("network");
debugLogger.setMinLevel("info");

// Configure TUI
enhancedProcessManager.enableTUI({
  refreshRate: 500,
  maxLogs: 200,
  showDebugLogs: true,
  theme: {
    colors: {
      primary: "#0066cc",
      success: "#00cc66",
      warning: "#ff9900",
      error: "#cc0000",
    },
  },
});
```

## Best Practices

### Process Definition

1. **Use Descriptive IDs**: Process IDs should be descriptive and unique
2. **Set Appropriate Timeouts**: Configure realistic timeouts for your processes
3. **Define Dependencies**: Explicitly declare process dependencies
4. **Implement Health Checks**: Always provide health check mechanisms
5. **Handle Signals Properly**: Ensure your processes respond to SIGTERM gracefully

### Error Handling

1. **Log Everything**: Use structured logging for all process events
2. **Set Retry Limits**: Prevent infinite restart loops
3. **Monitor Resource Usage**: Track CPU, memory, and other resources
4. **Use Categories**: Organize processes by category for better management
5. **Test Failure Scenarios**: Regularly test process failure and recovery

### Performance

1. **Optimize Health Checks**: Don't make health checks too frequent
2. **Use Appropriate Log Levels**: Debug logs should be disabled in production
3. **Monitor TUI Performance**: TUI refresh rate should match your needs
4. **Clean Up Resources**: Ensure proper cleanup of file handles, connections, etc.

## Troubleshooting

### Common Issues

#### Process Won't Start

```bash
# Check debug logs
DEBUG=true DEBUG_CATEGORIES=process npm run dev

# Look for:
# - Permission issues
# - Missing dependencies
# - Port conflicts
# - Environment variable issues
```

#### Process Keeps Restarting

```bash
# Check health check configuration
# Examine process logs for errors
# Verify dependencies are running
# Check resource constraints
```

#### Shutdown Hangs

```bash
# Check for:
# - Unhandled async operations
# - Open file handles
# - Active timers/intervals
# - Unresponded signals
```

#### TUI Not Updating

```bash
# Verify terminal capabilities
# Check refresh rate settings
# Ensure process state updates are working
# Look for rendering errors in debug logs
```

### Debug Commands

```bash
# Enable all debugging
DEBUG=* npm run dev

# Debug specific categories
DEBUG=process,network,container npm run dev

# File-only debugging
DEBUG_CONSOLE=false npm run dev

# Detailed process tracing
DEBUG_LEVEL=trace DEBUG_CATEGORIES=process npm run dev
```

## Migration Guide

### From Basic Process Management

If you're currently using basic process spawning:

```typescript
// Old way
const child = spawn("node", ["server.js"]);
child.on("exit", (code) => {
  console.log(`Process exited with code ${code}`);
});

// New way
await enhancedProcessManager.startProcess({
  id: "server",
  displayName: "Web Server",
  category: "service",
  command: "node",
  args: ["server.js"],
  healthCheck: {
    url: "http://localhost:3000/health",
  },
});
```

### From Docker Compose

If you're using Docker Compose:

```yaml
# docker-compose.yml
services:
  chainweb:
    image: kadena/chainweb-node
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    depends_on:
      - postgres
```

```typescript
// Equivalent in process manager
await enhancedProcessManager.startProcess({
  id: "postgres",
  displayName: "PostgreSQL Database",
  category: "service",
  command: "docker",
  args: ["run", "-p", "5432:5432", "postgres:14"],
});

await enhancedProcessManager.startProcess({
  id: "chainweb",
  displayName: "Chainweb Node",
  category: "network",
  command: "docker",
  args: ["run", "-p", "8080:8080", "kadena/chainweb-node"],
  dependencies: ["postgres"],
  healthCheck: {
    url: "http://localhost:8080/health",
  },
});
```

## API Reference

See the TypeScript definitions in the source code for complete API documentation:

- [`ProcessManager`](../packages/utils/src/process-manager.ts)
- [`EnhancedProcessManager`](../packages/utils/src/enhanced-process-manager.ts)
- [`TUIManager`](../packages/utils/src/tui/tui-manager.ts)
- [`DebugLogger`](../packages/utils/src/debug-logger.ts)