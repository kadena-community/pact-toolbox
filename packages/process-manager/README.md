# @pact-toolbox/process-manager

> Advanced process management and orchestration for development environments

## Overview

The `@pact-toolbox/process-manager` package provides a comprehensive solution for managing system processes in development and testing environments. It offers process lifecycle management, health monitoring, dependency resolution, and automatic recovery capabilities, making it ideal for orchestrating complex service topologies.

## Installation

```bash
npm install @pact-toolbox/process-manager
# or
pnpm add @pact-toolbox/process-manager
```

## Features

- 🚀 **Process Lifecycle Management** - Start, stop, restart, and monitor processes
- 🏥 **Health Monitoring** - HTTP, TCP, and command-based health checks
- 🔗 **Dependency Management** - Define and manage process dependencies
- 🔄 **Auto-restart** - Configurable restart policies with limits
- 📊 **Metrics Collection** - CPU, memory, and uptime monitoring
- 🎯 **Process Patterns** - Pre-configured patterns for common services
- 🌲 **Process Tree Management** - Kill entire process trees cleanly
- 🎨 **TUI Integration** - Visual process monitoring in terminal
- ⚡ **Event-driven** - React to process state changes

## Quick Start

```typescript
import { createProcess, getOrchestrator, processPatterns } from '@pact-toolbox/process-manager';

// Create a simple process
const apiServer = await createProcess({
  id: 'api-server',
  name: 'API Server',
  command: 'node',
  args: ['server.js'],
  healthCheck: {
    type: 'http',
    url: 'http://localhost:3000/health'
  }
});

// Or use a pre-configured pattern
const webServer = processPatterns.webServer({
  id: 'web-app',
  name: 'Web Application',
  command: 'npm',
  args: ['run', 'start'],
  port: 3000
});

// Start the process
await webServer.start();
```

## API Reference

### Process Configuration

```typescript
interface ProcessConfig {
  // Identification
  id: string;                      // Unique process identifier
  name: string;                    // Human-readable name
  
  // Command
  command: string;                 // Command to execute
  args?: string[];                 // Command arguments
  
  // Environment
  cwd?: string;                    // Working directory
  env?: Record<string, string>;    // Environment variables
  
  // Options
  shell?: boolean;                 // Run in shell
  detached?: boolean;              // Detach from parent
  uid?: number;                    // User ID (Unix)
  gid?: number;                    // Group ID (Unix)
  
  // Health Check
  healthCheck?: HealthCheckConfig; // Health monitoring
  
  // Auto-restart
  autoRestart?: boolean;           // Enable auto-restart
  maxRestarts?: number;            // Maximum restart attempts
  restartDelay?: number;           // Delay between restarts (ms)
  
  // Dependencies
  dependencies?: string[];         // Process IDs to depend on
  waitFor?: 'started' | 'running' | 'healthy'; // Wait condition
  
  // Monitoring
  collectMetrics?: boolean;        // Enable metrics collection
  
  // Lifecycle hooks
  onStart?: () => void | Promise<void>;
  onStop?: () => void | Promise<void>;
  onRestart?: () => void | Promise<void>;
  onCrash?: (error: Error) => void | Promise<void>;
}
```

### Health Check Configuration

```typescript
interface HealthCheckConfig {
  type: 'http' | 'tcp' | 'command';
  
  // Common options
  interval?: number;     // Check interval (ms)
  timeout?: number;      // Check timeout (ms)
  retries?: number;      // Retries before unhealthy
  initialDelay?: number; // Initial delay before first check (ms)
  
  // HTTP specific
  url?: string;          // Health endpoint URL
  method?: string;       // HTTP method
  headers?: Record<string, string>;
  expectedStatus?: number; // Expected status code
  
  // TCP specific
  host?: string;         // Host to connect to
  port?: number;         // Port to connect to
  
  // Command specific
  checkCommand?: string; // Command to run
  checkArgs?: string[];  // Command arguments
  expectedExitCode?: number; // Expected exit code
}
```

### Process Manager

#### `createProcess(config: ProcessConfig): Promise<ProcessManager>`

Creates and returns a new process manager instance.

```typescript
const process = await createProcess({
  id: 'my-service',
  name: 'My Service',
  command: 'node',
  args: ['app.js'],
  healthCheck: {
    type: 'http',
    url: 'http://localhost:3000/health',
    interval: 10000
  }
});

// Process control
await process.start();
await process.stop();
await process.restart();
await process.remove();

// Process information
const isRunning = process.isRunning();
const state = process.getState();
const metrics = await process.getMetrics();
```

### Process Orchestrator

#### `getOrchestrator(): ProcessOrchestrator`

Returns the global process orchestrator instance.

```typescript
const orchestrator = getOrchestrator();

// Start multiple processes
await orchestrator.startMany([
  { id: 'db', /* ... */ },
  { id: 'cache', /* ... */ },
  { id: 'api', dependencies: ['db', 'cache'], /* ... */ }
]);

// Stop all processes
await orchestrator.stopAll();

// List all processes
const processes = orchestrator.listProcesses();
```

### Process Patterns

Pre-configured patterns for common service types:

#### `processPatterns.webServer(config)`

Web server with HTTP health checks.

```typescript
const server = processPatterns.webServer({
  id: 'web',
  name: 'Web Server',
  command: 'npm',
  args: ['start'],
  port: 3000,
  healthPath: '/health',
  healthInterval: 30000
});
```

#### `processPatterns.database(config)`

Database service with TCP health checks.

```typescript
const db = processPatterns.database({
  id: 'postgres',
  name: 'PostgreSQL',
  command: 'postgres',
  args: ['-D', '/data'],
  port: 5432,
  startupTime: 10000
});
```

#### `processPatterns.worker(config)`

Background worker with optional health checks.

```typescript
const worker = processPatterns.worker({
  id: 'queue-worker',
  name: 'Queue Worker',
  command: 'node',
  args: ['worker.js'],
  restartOnCrash: true,
  maxRestarts: 5
});
```

#### `processPatterns.blockchainNode(config)`

Blockchain node with extended timeouts.

```typescript
const node = processPatterns.blockchainNode({
  id: 'pact-node',
  name: 'Pact Node',
  command: 'pact',
  args: ['--serve', '9001'],
  port: 9001,
  startupTime: 60000
});
```

## Events

Process managers emit typed events:

```typescript
process.on('starting', ({ processId }) => {
  console.log(`Process ${processId} is starting`);
});

process.on('started', ({ processId, pid }) => {
  console.log(`Process ${processId} started with PID ${pid}`);
});

process.on('stopping', ({ processId }) => {
  console.log(`Process ${processId} is stopping`);
});

process.on('stopped', ({ processId, exitCode }) => {
  console.log(`Process ${processId} stopped with code ${exitCode}`);
});

process.on('crashed', ({ processId, error, willRestart }) => {
  console.error(`Process ${processId} crashed:`, error);
  if (willRestart) {
    console.log('Will restart automatically');
  }
});

process.on('healthy', ({ processId }) => {
  console.log(`Process ${processId} is healthy`);
});

process.on('unhealthy', ({ processId, error }) => {
  console.warn(`Process ${processId} is unhealthy:`, error);
});

process.on('metrics', ({ processId, metrics }) => {
  console.log(`Process ${processId} metrics:`, metrics);
});
```

## Advanced Usage

### Process Dependencies

Create complex service topologies:

```typescript
const database = await createProcess({
  id: 'database',
  name: 'PostgreSQL',
  command: 'postgres',
  healthCheck: { type: 'tcp', port: 5432 }
});

const cache = await createProcess({
  id: 'cache',
  name: 'Redis',
  command: 'redis-server',
  healthCheck: { type: 'tcp', port: 6379 }
});

const api = await createProcess({
  id: 'api',
  name: 'API Server',
  command: 'node',
  args: ['api.js'],
  dependencies: ['database', 'cache'],
  waitFor: 'healthy', // Wait for dependencies to be healthy
  healthCheck: { type: 'http', url: 'http://localhost:3000/health' }
});

// Start all with dependency resolution
const orchestrator = getOrchestrator();
await orchestrator.startAll();
```

### Auto-restart Configuration

```typescript
const resilientService = await createProcess({
  id: 'worker',
  name: 'Resilient Worker',
  command: 'node',
  args: ['worker.js'],
  autoRestart: true,
  maxRestarts: 3,
  restartDelay: 5000, // 5 seconds between restarts
  onCrash: async (error) => {
    console.error('Worker crashed:', error);
    // Send alert, clean up resources, etc.
  }
});
```

### Custom Health Checks

```typescript
// HTTP health check with custom validation
const apiServer = await createProcess({
  id: 'api',
  name: 'API Server',
  command: 'node',
  args: ['server.js'],
  healthCheck: {
    type: 'http',
    url: 'http://localhost:3000/health',
    method: 'GET',
    headers: { 'X-Health-Check': 'true' },
    expectedStatus: 200,
    timeout: 5000,
    interval: 30000
  }
});

// Command-based health check
const worker = await createProcess({
  id: 'worker',
  name: 'Worker Process',
  command: 'python',
  args: ['worker.py'],
  healthCheck: {
    type: 'command',
    checkCommand: 'python',
    checkArgs: ['check_health.py'],
    expectedExitCode: 0,
    interval: 60000
  }
});
```

### Process Monitoring

```typescript
const process = await createProcess({
  id: 'monitored-service',
  name: 'Monitored Service',
  command: 'node',
  args: ['app.js'],
  collectMetrics: true
});

// Get metrics
setInterval(async () => {
  const metrics = await process.getMetrics();
  console.log(`CPU: ${metrics.cpu}%`);
  console.log(`Memory: ${metrics.memory} MB`);
  console.log(`Uptime: ${metrics.uptime} seconds`);
}, 5000);

// Monitor via events
process.on('metrics', ({ metrics }) => {
  if (metrics.cpu > 80) {
    console.warn('High CPU usage detected');
  }
});
```

### Integration with TUI

```typescript
import { TUIManager } from '@pact-toolbox/tui';

// TUI integration is automatic when available
const orchestrator = getOrchestrator({
  tui: new TUIManager(),
  enableTUI: process.stdout.isTTY
});

// Processes will automatically update TUI
await orchestrator.startMany([
  webServerProcess,
  databaseProcess,
  workerProcess
]);
```

### Graceful Shutdown

```typescript
// Setup graceful shutdown
const orchestrator = getOrchestrator();

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await orchestrator.stopAll({
    timeout: 30000, // 30 seconds to stop all
    force: true     // Force kill if timeout
  });
  process.exit(0);
});

// Or use the built-in handler
orchestrator.enableGracefulShutdown();
```

## Error Handling

```typescript
try {
  await process.start();
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('Command not found');
  } else if (error.code === 'EACCES') {
    console.error('Permission denied');
  } else if (error.code === 'DEPENDENCY_FAILED') {
    console.error('Dependency failed to start');
  }
}

// Handle process crashes
process.on('crashed', ({ error, restartCount, maxRestarts }) => {
  if (restartCount >= maxRestarts) {
    console.error('Process failed permanently');
    // Implement fallback logic
  }
});
```

## Best Practices

### 1. Use Appropriate Health Checks

```typescript
// For web services
healthCheck: {
  type: 'http',
  url: 'http://localhost:3000/ready', // Readiness endpoint
  initialDelay: 5000, // Allow startup time
  interval: 30000,
  timeout: 5000
}

// For databases
healthCheck: {
  type: 'tcp',
  port: 5432,
  initialDelay: 10000, // Databases need more time
  retries: 5
}
```

### 2. Handle Dependencies Properly

```typescript
// Define clear dependency chains
const services = [
  { id: 'db', /* ... */ },
  { id: 'migrations', dependencies: ['db'], waitFor: 'healthy' },
  { id: 'api', dependencies: ['migrations'], waitFor: 'stopped' }
];
```

### 3. Configure Restart Policies

```typescript
// Critical services
autoRestart: true,
maxRestarts: 10,
restartDelay: 5000

// Development services
autoRestart: false, // Manual intervention preferred
```

### 4. Monitor Resource Usage

```typescript
// Set up alerts for resource usage
process.on('metrics', ({ metrics }) => {
  if (metrics.memory > 500) { // MB
    console.warn('High memory usage');
    // Consider restarting
  }
});
```

## Troubleshooting

### Common Issues

1. **"Command not found"**
   - Ensure command is in PATH
   - Use absolute paths when necessary
   - Check shell option for shell-specific commands

2. **"Process exits immediately"**
   - Check command and arguments
   - Review process logs
   - Verify working directory

3. **"Health check always fails"**
   - Increase initialDelay for slow-starting services
   - Verify health check endpoint/port
   - Check network connectivity

4. **"Dependencies not starting in order"**
   - Verify dependency IDs match
   - Check for circular dependencies
   - Use appropriate waitFor conditions

### Debug Mode

```typescript
const process = await createProcess({
  id: 'debug-service',
  name: 'Debug Service',
  command: 'node',
  args: ['--inspect', 'app.js'],
  env: {
    DEBUG: '*',
    NODE_ENV: 'development'
  }
});

// Enable verbose logging
process.on('stdout', (data) => {
  console.log('[STDOUT]', data.toString());
});

process.on('stderr', (data) => {
  console.error('[STDERR]', data.toString());
});
```