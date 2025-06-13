# @pact-toolbox/utils

> Essential utility functions for Pact smart contract development and blockchain operations

## Overview

The `@pact-toolbox/utils` package provides a comprehensive collection of utility functions that support the Pact Toolbox ecosystem. It includes helpers for blockchain operations, process management, file system operations, networking, logging, and more. These utilities are designed to simplify common tasks in Pact smart contract development and deployment.

## Installation

```bash
npm install @pact-toolbox/utils
# or
pnpm add @pact-toolbox/utils
```

## Features

- = **Blockchain Utils** - Chainweb node health checks, block creation, and API interactions
- = **Process Management** - Cross-platform process spawning, cleanup, and signal handling
- < **Network Utilities** - Port management, availability checking, and allocation
- =Á **File System Helpers** - Directory creation, file writing with safety checks
- ñ **Async Operations** - Polling, delays, timeouts with cancellation support
- =à **Pact Toolchain** - Version detection, installation, and management
- =Ý **Logging Infrastructure** - Structured logging with multiple backends
- <¨ **Template Processing** - String templating with validation
- <” **UUID Generation** - Cryptographically secure unique identifiers
- =¬ **CLI Prompts** - Interactive command-line interfaces

## Quick Start

```typescript
import {
  logger,
  delay,
  pollFn,
  isPortTaken,
  getRandomPort,
  executeCommand,
  isChainWebNodeOk,
  cleanupOnExit
} from '@pact-toolbox/utils';

// Logging
logger.info('Starting application');

// Network operations
const port = await getRandomPort();
const isAvailable = await isPortTaken(port);

// Async utilities
await delay(1000); // Wait 1 second

// Process cleanup
cleanupOnExit(async () => {
  logger.info('Cleaning up resources...');
});

// Blockchain health check
const isHealthy = await isChainWebNodeOk('https://api.chainweb.com');
```

## API Reference

### Blockchain and Chainweb Utilities

#### `isChainWebNodeOk(serviceUrl, timeout?)`

Check if a Chainweb node is responding and healthy.

```typescript
const isHealthy = await isChainWebNodeOk('https://api.chainweb.com', 5000);
console.log(isHealthy ? 'Node is healthy' : 'Node is down');
```

#### `isChainWebAtHeight(targetHeight, serviceUrl, timeout?)`

Check if a Chainweb node has reached a specific block height.

```typescript
const hasHeight = await isChainWebAtHeight(1000000, 'https://api.chainweb.com');
console.log(`Node at height: ${hasHeight}`);
```

#### `makeBlocks(options)`

Create blocks on specified chains (for development networks).

```typescript
const blocksCreated = await makeBlocks({
  count: 5,
  chainIds: ['0', '1', '2'],
  onDemandUrl: 'http://localhost:8080'
});
console.log(`Created ${blocksCreated} blocks`);
```

#### `didMakeBlocks(params)`

Validate that blocks were successfully created.

```typescript
const success = await didMakeBlocks({
  initialCount: 100,
  targetCount: 105,
  serviceUrl: 'http://localhost:8080'
});
```

### Process Management

#### `runBin(bin, args, options?)`

Spawn a child process with advanced options and error handling.

```typescript
import { runBin } from '@pact-toolbox/utils';

const result = await runBin('pact', ['--version'], {
  timeout: 10000,
  cwd: '/path/to/project',
  env: { NODE_ENV: 'development' }
});

console.log('Pact version:', result.stdout);
```

#### `killProcess(name)`

Terminate processes by name (cross-platform).

```typescript
await killProcess('pact-server');
console.log('Pact server terminated');
```

#### `executeCommand(command, options?)`

Execute shell commands with promise-based API.

```typescript
const { stdout, stderr, exitCode } = await executeCommand('npm --version', {
  timeout: 5000,
  cwd: process.cwd()
});

if (exitCode === 0) {
  console.log('npm version:', stdout.trim());
}
```

#### `cleanupOnExit(cleanupFn)`

Register cleanup functions for graceful shutdown.

```typescript
// Register multiple cleanup functions
cleanupOnExit(async () => {
  await database.close();
});

cleanupOnExit(async () => {
  await server.stop();
});

// Cleanup happens automatically on SIGINT, SIGTERM, etc.
```

### Network and Port Utilities

#### `getRandomPort(options?)`

Get a random available port.

```typescript
const port = await getRandomPort();
console.log(`Using port: ${port}`);

// With options
const specificPort = await getRandomPort({
  port: 3000, // Prefer this port
  ports: [3000, 3001, 3002], // Try these ports
  host: 'localhost'
});
```

#### `isPortTaken(port, host?)`

Check if a port is already in use.

```typescript
const isBusy = await isPortTaken(8080);
if (isBusy) {
  console.log('Port 8080 is already in use');
}
```

#### `getRandomNetworkPorts(host, startGap, endGap)`

Allocate a range of consecutive ports for services.

```typescript
const ports = await getRandomNetworkPorts('localhost', 8080, 8090);
console.log('Allocated ports:', ports); // [8080, 8081, 8082, ...]
```

### File System Utilities

#### `ensureDir(dirPath)`

Create directories recursively if they don't exist.

```typescript
await ensureDir('/path/to/nested/directories');
console.log('Directory structure created');
```

#### `writeFile(filePath, content)`

Write files with automatic directory creation.

```typescript
await writeFile('/path/to/new/file.txt', 'Hello, Pact!');
console.log('File written successfully');
```

### Async Operation Helpers

#### `delay(ms, signal?)`

Create a cancellable delay.

```typescript
// Simple delay
await delay(1000);

// Cancellable delay
const controller = new AbortController();
setTimeout(() => controller.abort(), 500);

try {
  await delay(1000, controller.signal);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Delay was cancelled');
  }
}
```

#### `pollFn(fn, options?)`

Poll a function until it succeeds or times out.

```typescript
const result = await pollFn(
  async () => {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Not ready');
    return response.json();
  },
  {
    timeout: 30000,    // 30 seconds total
    interval: 1000,    // Check every second
    retries: 30        // Maximum attempts
  }
);

console.log('Service is ready:', result);
```

### Pact Toolchain Management

#### `isAnyPactInstalled(match?)`

Check if Pact is installed on the system.

```typescript
const isInstalled = await isAnyPactInstalled();
console.log(`Pact is ${isInstalled ? 'installed' : 'not installed'}`);

// Check for specific version pattern
const hasVersion = await isAnyPactInstalled('4.12');
```

#### `getCurrentPactVersion()`

Get the currently installed Pact version.

```typescript
const version = await getCurrentPactVersion();
console.log(`Pact version: ${version}`);
```

#### `installPact(version?, nightly?)`

Install Pact using pactup.

```typescript
// Install latest stable
await installPact();

// Install specific version
await installPact('4.12.0');

// Install nightly build
await installPact(undefined, true);

console.log('Pact installation complete');
```

### Logging

#### Basic Logger

```typescript
import { logger } from '@pact-toolbox/utils';

logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred', { error: new Error('Details') });
logger.success('Operation completed successfully');

// With context
logger.info('User logged in', { userId: '123', timestamp: new Date() });
```

#### Advanced Debug Logger

```typescript
import { DebugLogger } from '@pact-toolbox/utils';

const debugLogger = new DebugLogger({
  name: 'MyApp',
  logDir: './logs',
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024, // 10MB
  categories: ['process', 'network', 'performance']
});

// Category-specific logging
debugLogger.process('Started new process', { pid: 1234 });
debugLogger.network('HTTP request', { url: '/api/data', method: 'GET' });
debugLogger.performance('Query executed', { duration: 45, query: 'SELECT *' });

// File rotation and cleanup
await debugLogger.cleanup();
```

### String and Template Processing

#### `fillTemplatePlaceholders(template, context)`

Process Mustache-style templates with validation.

```typescript
const template = 'Hello {{name}}, your balance is {{balance}} KDA.';
const context = { name: 'Alice', balance: '100.5' };

const result = fillTemplatePlaceholders(template, context);
console.log(result); // "Hello Alice, your balance is 100.5 KDA."

// Error handling for missing variables
try {
  fillTemplatePlaceholders('Hello {{name}}', {}); // Missing 'name'
} catch (error) {
  console.error('Template error:', error.message);
}
```

### UUID Generation

#### `getUuid()`

Generate cryptographically secure UUIDs.

```typescript
const id = getUuid();
console.log('Generated UUID:', id); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// Use in Pact transactions
const transactionId = getUuid();
const nonce = getUuid();
```

### Date Utilities

#### `formatDate(date)`

Format dates using locale-aware formatting.

```typescript
const formatted = formatDate(new Date());
console.log('Current date:', formatted); // "12/25/2023, 10:30:00 AM"

// With specific date
const specificDate = formatDate(new Date('2023-12-25T10:30:00Z'));
```

### CLI Prompts

#### Interactive Prompts

```typescript
import { spinner, select, text, isCancel } from '@pact-toolbox/utils';

// Spinner for long operations
const s = spinner();
s.start('Installing Pact...');
await installPact();
s.stop('Pact installed successfully');

// Text input
const name = await text({
  message: 'What is your project name?',
  placeholder: 'my-pact-project'
});

if (isCancel(name)) {
  console.log('Operation cancelled');
  process.exit(0);
}

// Selection prompt
const network = await select({
  message: 'Choose a network:',
  options: [
    { value: 'mainnet', label: 'Mainnet' },
    { value: 'testnet', label: 'Testnet' },
    { value: 'local', label: 'Local Development' }
  ]
});

console.log(`Selected network: ${network}`);
```

## Error Handling

The package includes custom error classes for different scenarios:

### ChainWebError

```typescript
import { ChainWebError } from '@pact-toolbox/utils';

try {
  await isChainWebNodeOk('invalid-url');
} catch (error) {
  if (error instanceof ChainWebError) {
    console.error('Chainweb error:', error.message);
    console.error('Cause:', error.cause);
  }
}
```

### TimeoutError

```typescript
import { TimeoutError, pollFn } from '@pact-toolbox/utils';

try {
  await pollFn(
    () => checkServiceHealth(),
    { timeout: 5000 }
  );
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Operation timed out after 5 seconds');
  }
}
```

### AbortError

```typescript
import { AbortError, delay } from '@pact-toolbox/utils';

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  await delay(5000, controller.signal);
} catch (error) {
  if (error instanceof AbortError) {
    console.log('Delay was aborted');
  }
}
```

## Advanced Usage

### Process Management with Cleanup

```typescript
import { runBin, cleanupOnExit, logger } from '@pact-toolbox/utils';

class ServiceManager {
  private processes: Array<{ name: string; child: ChildProcess }> = [];
  
  constructor() {
    cleanupOnExit(() => this.cleanup());
  }
  
  async startService(name: string, command: string, args: string[]) {
    logger.info(`Starting ${name}...`);
    
    const child = await runBin(command, args, {
      detached: false,
      stdio: 'pipe'
    });
    
    this.processes.push({ name, child });
    logger.success(`${name} started with PID ${child.pid}`);
  }
  
  async cleanup() {
    logger.info('Stopping all services...');
    
    for (const { name, child } of this.processes) {
      try {
        child.kill('SIGTERM');
        logger.info(`Stopped ${name}`);
      } catch (error) {
        logger.error(`Failed to stop ${name}:`, error);
      }
    }
    
    this.processes = [];
  }
}

const manager = new ServiceManager();
await manager.startService('pact-server', 'pact', ['--serve']);
```

### Network Health Monitoring

```typescript
import { isChainWebNodeOk, pollFn, logger } from '@pact-toolbox/utils';

class NetworkMonitor {
  constructor(private nodes: string[]) {}
  
  async monitorHealth() {
    for (const node of this.nodes) {
      try {
        await pollFn(
          async () => {
            const isHealthy = await isChainWebNodeOk(node, 3000);
            if (!isHealthy) {
              throw new Error(`Node ${node} is not responding`);
            }
            return true;
          },
          {
            timeout: 30000,
            interval: 5000,
            retries: 6
          }
        );
        
        logger.success(`Node ${node} is healthy`);
      } catch (error) {
        logger.error(`Node ${node} failed health check:`, error);
      }
    }
  }
}

const monitor = new NetworkMonitor([
  'https://api.chainweb.com',
  'https://api.testnet.chainweb.com'
]);

await monitor.monitorHealth();
```

### Development Environment Setup

```typescript
import {
  getRandomNetworkPorts,
  ensureDir,
  writeFile,
  logger,
  fillTemplatePlaceholders
} from '@pact-toolbox/utils';

class DevEnvironment {
  async setup(projectName: string) {
    logger.info(`Setting up development environment for ${projectName}`);
    
    // Allocate ports for services
    const [apiPort, dbPort, cachePort] = await getRandomNetworkPorts('localhost', 8000, 8003);
    
    // Create project structure
    await ensureDir(`./projects/${projectName}/contracts`);
    await ensureDir(`./projects/${projectName}/tests`);
    await ensureDir(`./projects/${projectName}/config`);
    
    // Generate configuration from template
    const configTemplate = `
{
  "projectName": "{{projectName}}",
  "network": {
    "apiPort": {{apiPort}},
    "dbPort": {{dbPort}},
    "cachePort": {{cachePort}}
  }
}`;
    
    const config = fillTemplatePlaceholders(configTemplate, {
      projectName,
      apiPort: apiPort.toString(),
      dbPort: dbPort.toString(),
      cachePort: cachePort.toString()
    });
    
    await writeFile(`./projects/${projectName}/config/dev.json`, config);
    
    logger.success(`Development environment ready at ./projects/${projectName}`);
    logger.info(`API Port: ${apiPort}, DB Port: ${dbPort}, Cache Port: ${cachePort}`);
  }
}

const devEnv = new DevEnvironment();
await devEnv.setup('my-pact-dapp');
```

## Best Practices

### 1. Error Handling

```typescript
// Always handle specific error types
try {
  await pollFn(checkService, { timeout: 10000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout specifically
    logger.error('Service did not respond in time');
  } else if (error instanceof AbortError) {
    // Handle cancellation
    logger.info('Operation was cancelled');
  } else {
    // Handle other errors
    logger.error('Unexpected error:', error);
  }
}
```

### 2. Resource Cleanup

```typescript
// Always register cleanup functions
cleanupOnExit(async () => {
  await stopAllServices();
  await closeDatabase();
  await cleanupTempFiles();
});
```

### 3. Async Operations

```typescript
// Use cancellation tokens for long operations
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  await pollFn(
    checkBlockchainSync,
    { timeout: 60000 },
    controller.signal
  );
} catch (error) {
  if (error instanceof AbortError) {
    logger.warn('Blockchain sync check was cancelled');
  }
}
```

### 4. Logging

```typescript
// Use structured logging with context
logger.info('Transaction submitted', {
  txId: transaction.id,
  chainId: transaction.chainId,
  timestamp: new Date().toISOString()
});

// Use appropriate log levels
logger.debug('Detailed debugging info');
logger.info('General information');
logger.warn('Warning condition');
logger.error('Error occurred', { error });
logger.success('Operation completed');
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { delay, pollFn, TimeoutError } from '@pact-toolbox/utils';

describe('Async utilities', () => {
  it('should delay for specified time', async () => {
    const start = Date.now();
    await delay(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95);
  });
  
  it('should timeout when polling fails', async () => {
    await expect(
      pollFn(
        () => Promise.reject(new Error('Always fails')),
        { timeout: 100, interval: 10 }
      )
    ).rejects.toThrow(TimeoutError);
  });
});
```

### Integration Tests

```typescript
import { isChainWebNodeOk, getRandomPort } from '@pact-toolbox/utils';

describe('Network utilities', () => {
  it('should check real chainweb node health', async () => {
    const isHealthy = await isChainWebNodeOk('https://api.chainweb.com', 10000);
    expect(typeof isHealthy).toBe('boolean');
  });
  
  it('should find available port', async () => {
    const port = await getRandomPort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});
```

## Performance Considerations

- **Process Management**: Use cleanup functions to prevent resource leaks
- **Network Operations**: Set appropriate timeouts to avoid hanging
- **File Operations**: Use async functions to prevent blocking
- **Logging**: Consider log levels and file rotation in production
- **Polling**: Use reasonable intervals to balance responsiveness and resource usage

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.