# @pact-toolbox/node-utils

Essential Node.js utilities for building, testing, and managing applications in the Pact Toolbox ecosystem. This package provides a comprehensive set of utilities for file system operations, process management, logging, UI components, and more.

## Features

- 🚀 **Process Management** - Spawn, monitor, and manage child processes with automatic cleanup
- 📁 **File System Operations** - Enhanced file/directory operations with glob patterns and hashing
- 📝 **Logging** - Configurable logger with environment-based levels and context support
- 🔌 **Port Management** - Network port allocation and availability checking
- 🎨 **CLI UI Components** - Spinners, tables, boxes, and interactive prompts
- 🧹 **Cleanup Handlers** - Graceful process termination with registered cleanup functions
- ⚙️ **Pact Integration** - Utilities for detecting and installing Pact versions
- 🔧 **Helper Utilities** - Promisified command execution and object manipulation

## Installation

```bash
npm install @pact-toolbox/node-utils
```

## Quick Start

```typescript
import {
  logger,
  writeFile,
  ensureDir,
  spawnProcess,
  cleanupOnExit,
  startSpinner,
  stopSpinner
} from '@pact-toolbox/node-utils';

// Logging with automatic environment-based levels
logger.info('Application starting...');

// File operations with automatic directory creation
await ensureDir('/path/to/directory');
await writeFile('/path/to/file.txt', 'Hello, World!');

// Process management with cleanup
const child = spawnProcess('npm', ['run', 'dev']);
cleanupOnExit(() => {
  if (!child.killed) {
    child.kill();
  }
});

// CLI UI components
const spinner = startSpinner('Processing...');
await performLongOperation();
stopSpinner(true, 'Processing complete!');
```

## API Reference

### File System Operations

#### Core Operations

```typescript
import { ensureDir, writeFile, readFile, exists, copyFile, removeFile } from '@pact-toolbox/node-utils';

// Directory operations
await ensureDir('/path/to/directory');

// File operations
await writeFile('/path/to/file.txt', 'content');
const content = await readFile('/path/to/file.txt');
const fileExists = await exists('/path/to/file.txt');

// Copy and remove operations
await copyFile('/source/file.txt', '/dest/file.txt');
await removeFile('/path/to/file.txt');
await removeDir('/path/to/directory');
```

#### Glob Patterns and File Watching

```typescript
import { glob, watch, matchPattern } from '@pact-toolbox/node-utils';

// Find files with glob patterns
const result = await glob(['src/', 'lib/*.js']);
console.log(result.files);

// Watch for file changes
const watcher = watch('src/', {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('change', (path) => {
  console.log(`File ${path} has been changed`);
});

// Pattern matching
if (matchPattern('src/index.ts', '*.ts')) {
  console.log('This is a TypeScript file');
}
```

#### File Hashing

```typescript
import { calculateFileHash, calculateContentHash } from '@pact-toolbox/node-utils';

// Hash file contents
const fileHash = await calculateFileHash('/path/to/file.txt');

// Hash string content
const contentHash = calculateContentHash('Hello, World!');
```

### Process Management

#### Running Processes

```typescript
import { runBin, spawnProcess, killProcess } from '@pact-toolbox/node-utils';

// Run a binary with advanced options
const child = await runBin('node', ['--version'], {
  silent: true,
  resolveIf: (output) => output.includes('v'),
  cwd: '/custom/directory'
});

// Spawn long-running processes
const server = spawnProcess('npm', ['run', 'dev'], {
  cwd: '/project/path',
  env: { NODE_ENV: 'development' }
});

// Cross-platform process termination
await killProcess('node');
```

#### Process Information

```typescript
import { isProcessRunning, getProcessInfo } from '@pact-toolbox/node-utils';

// Check if process is running
if (isProcessRunning(12345)) {
  console.log('Process is still running');
}

// Get process information
const info = await getProcessInfo(12345);
if (info) {
  console.log(`Process ${info.pid}: ${info.command} (${info.status})`);
}
```

#### Cleanup Management

```typescript
import { cleanupOnExit } from '@pact-toolbox/node-utils';

// Register cleanup functions
cleanupOnExit(async () => {
  await server.close();
  console.log('Server closed gracefully');
});

cleanupOnExit(() => {
  database.disconnect();
});
```

### Logging

#### Basic Logging

```typescript
import { logger, info, warn, error, debug, success } from '@pact-toolbox/node-utils';

// Direct logger usage
logger.info('Application started');
logger.error('An error occurred', error);

// Convenience functions
info('Information message');
warn('Warning message');
error('Error message');
debug('Debug information');
success('Operation successful');
```

#### Advanced Logging

```typescript
import { createLogger, logPerformance, logWithContext } from '@pact-toolbox/node-utils';

// Tagged loggers
const dbLogger = createLogger('database');
dbLogger.info('Connection established');

// Performance logging
const startTime = Date.now();
await performOperation();
logPerformance('database.query', Date.now() - startTime, { query: 'SELECT * FROM users' });

// Contextual logging
logWithContext('error', 'api', 'Request failed', { endpoint: '/users', status: 500 });
```

#### Log Level Configuration

Set log levels via environment variables:

```bash
# Enable debug logging
DEBUG=1 node app.js

# Or set specific log level
LOG_LEVEL=debug node app.js
```

Supported levels: `silent`, `error`, `warn`, `info`, `debug`, `trace`

### Network Utilities

#### Port Management

```typescript
import { getRandomNetworkPorts, isPortTaken, getRandomPort } from '@pact-toolbox/node-utils';

// Get a set of network ports for services
const ports = await getRandomNetworkPorts();
console.log(ports); // { public: 3000, service: 3010, onDemand: 3020, stratum: 3030, p2p: 3040 }

// Check if port is available
if (await isPortTaken(3000)) {
  console.log('Port 3000 is already in use');
}

// Get a random available port
const port = await getRandomPort();
```

### CLI UI Components

#### Spinners

```typescript
import { startSpinner, stopSpinner, updateSpinner } from '@pact-toolbox/node-utils';

// Basic spinner usage
const spinner = startSpinner('Loading...');
await performTask();
stopSpinner(true, 'Loading complete!');

// Dynamic spinner updates
startSpinner('Processing item 1 of 10...');
for (let i = 1; i <= 10; i++) {
  updateSpinner(`Processing item ${i} of 10...`);
  await processItem(i);
}
stopSpinner(true, 'All items processed!');
```

#### Tables and Boxes

```typescript
import { table, boxMessage, clear } from '@pact-toolbox/node-utils';

// Display data in tables
table(
  ['Name', 'Status', 'Port'],
  [
    ['Server 1', 'Running', '3000'],
    ['Server 2', 'Stopped', '3001']
  ]
);

// Important messages in boxes
boxMessage('Important Notice', [
  'Your configuration has been updated.',
  'Please restart the application.'
]);

// Clear console
clear();
```

#### Interactive Prompts

```typescript
import { select, text, multiselect, intro, outro } from '@pact-toolbox/node-utils';

intro('Welcome to the setup wizard!');

const name = await text({
  message: 'What is your project name?',
  defaultValue: 'my-project'
});

const framework = await select({
  message: 'Pick a framework',
  options: [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' }
  ]
});

const features = await multiselect({
  message: 'Select features',
  options: [
    { value: 'typescript', label: 'TypeScript' },
    { value: 'eslint', label: 'ESLint' },
    { value: 'testing', label: 'Testing' }
  ]
});

outro('Setup complete!');
```

### Pact Integration

#### Version Management

```typescript
import { isAnyPactInstalled, getCurrentPactVersion, installPact } from '@pact-toolbox/node-utils';

// Check if Pact is installed
if (await isAnyPactInstalled()) {
  const version = await getCurrentPactVersion();
  console.log(`Pact version: ${version}`);
} else {
  console.log('Pact is not installed');
}

// Check for specific version
if (await isAnyPactInstalled('4.11')) {
  console.log('Pact 4.11 is installed');
}

// Install Pact
await installPact(); // Latest version
await installPact('4.11.0'); // Specific version
await installPact(undefined, true); // Nightly build
```

### Helper Utilities

#### Command Execution

```typescript
import { execAsync } from '@pact-toolbox/node-utils';

try {
  const { stdout, stderr } = await execAsync('ls -la');
  console.log('Output:', stdout);
} catch (error) {
  console.error('Command failed:', error);
}
```

#### Object Manipulation

```typescript
import { defu, defuFn, defuArrayFn } from '@pact-toolbox/node-utils';

const defaults = {
  server: { port: 3000, host: 'localhost' },
  features: { auth: true, logging: true }
};

const userConfig = {
  server: { port: 8080 },
  features: { logging: false }
};

const config = defu(userConfig, defaults);
// Result: {
//   server: { port: 8080, host: 'localhost' },
//   features: { auth: true, logging: false }
// }
```

## Environment Variables

### Logging Configuration

- `DEBUG=1` or `DEBUG=true` - Enable debug level logging
- `LOG_LEVEL=level` - Set specific log level (`silent`, `error`, `warn`, `info`, `debug`, `trace`)

## Error Handling

Most functions in this package follow standard Node.js error handling patterns:

- Async functions reject with Error objects
- Sync functions throw Error objects
- File operations provide meaningful error messages
- Process operations handle cross-platform differences

```typescript
try {
  await writeFile('/invalid/path/file.txt', 'content');
} catch (error) {
  logger.error('Failed to write file:', error);
}
```

## TypeScript Support

This package is written in TypeScript and provides full type definitions:

```typescript
import type { Logger, ProcessInfo, RunBinOptions } from '@pact-toolbox/node-utils';

const myLogger: Logger = createLogger('my-app');
```

## Platform Support

- **Windows** - Full support with platform-specific process handling
- **macOS** - Full support with native process utilities
- **Linux** - Full support with native process utilities

Cross-platform differences are handled automatically, especially for:
- Process termination (`killProcess`)
- Process information retrieval (`getProcessInfo`)
- File path handling (uses `pathe` for cross-platform paths)

## Testing

The package includes comprehensive test coverage:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Packages

- [`@pact-toolbox/config`](../config) - Configuration management
- [`@pact-toolbox/test`](../test) - Testing utilities
- [`@pact-toolbox/network`](../network) - Network management
- [`@pact-toolbox/unplugin`](../unplugin) - Build tool integration

---

**Part of the [Pact Toolbox](../../README.md) ecosystem for Kadena blockchain development.**