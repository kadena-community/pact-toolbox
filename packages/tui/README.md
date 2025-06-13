# @pact-toolbox/tui

> Terminal User Interface (TUI) for real-time monitoring and visualization of Pact development environments

## Overview

The `@pact-toolbox/tui` package provides a sophisticated Terminal User Interface for monitoring and managing Pact development environments. It offers real-time visualization of processes, containers, networks, and system resources, making it easy to track the state of your development infrastructure from the command line.

## Installation

```bash
npm install @pact-toolbox/tui
# or
pnpm add @pact-toolbox/tui
```

## Features

- 📊 **Real-time Monitoring** - Live updates of process states, resource usage, and network health
- 🎨 **Customizable Themes** - Built-in themes with full customization support
- 🔧 **Process Management** - Monitor process lifecycle, CPU/memory usage, and logs
- 🐳 **Container Tracking** - Docker container states, health checks, and port mappings
- 🌐 **Network Monitoring** - Endpoint availability, response times, and error rates
- ⌨️ **Interactive Controls** - Keyboard navigation and commands
- 📝 **Structured Logging** - Color-coded log levels with filtering
- 🎯 **Component Library** - Reusable UI components for terminal applications

## Quick Start

```typescript
import { tui } from '@pact-toolbox/tui';

// Start the TUI
tui.start();

// Log messages
tui.log('info', 'app', 'Application started successfully');
tui.log('error', 'database', 'Connection failed', { error: 'ECONNREFUSED' });

// Monitor a process
tui.addProcess({
  id: 'api-server',
  name: 'API Server',
  status: 'running',
  pid: 12345,
  cpu: 15.2,
  memory: 256000000 // bytes
});

// Update network status
tui.updateNetwork({
  id: 'devnet',
  name: 'Pact DevNet',
  status: 'running',
  endpoints: [
    { name: 'RPC', url: 'http://localhost:8080', status: 'up' }
  ]
});
```

## API Reference

### TUI Manager

#### `tui.start(options?: TUIOptions)`

Start the TUI with optional configuration.

```typescript
interface TUIOptions {
  refreshRate?: number;        // Update interval in ms (default: 1000)
  enableInteraction?: boolean; // Enable keyboard controls (default: true)
  maxLogs?: number;           // Maximum log entries to keep (default: 100)
  theme?: Theme;              // Custom theme configuration
  logFile?: string;           // Optional file to write logs to
}

tui.start({
  refreshRate: 500,
  maxLogs: 200,
  theme: defaultTheme
});
```

#### `tui.stop()`

Stop the TUI and cleanup resources.

#### `tui.log(level, source, message, metadata?)`

Log a message with optional metadata.

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

tui.log('info', 'server', 'Request processed', {
  method: 'GET',
  path: '/api/users',
  duration: 45
});
```

### Process Management

#### `tui.addProcess(process)`

Add a process to monitor.

```typescript
interface ProcessInfo {
  id: string;              // Unique identifier
  name: string;            // Display name
  status: ProcessStatus;   // 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
  pid?: number;            // Process ID
  cpu?: number;            // CPU usage percentage
  memory?: number;         // Memory usage in bytes
  uptime?: number;         // Uptime in seconds
  restarts?: number;       // Restart count
}

tui.addProcess({
  id: 'worker-1',
  name: 'Background Worker',
  status: 'running',
  pid: 54321,
  cpu: 8.5,
  memory: 128000000,
  uptime: 3600
});
```

#### `tui.updateProcess(id, updates)`

Update an existing process.

```typescript
tui.updateProcess('worker-1', {
  status: 'stopping',
  cpu: 2.1
});
```

#### `tui.removeProcess(id)`

Remove a process from monitoring.

### Container Management

#### `tui.addContainer(container)`

Add a Docker container to monitor.

```typescript
interface ContainerInfo {
  id: string;              // Container ID
  name: string;            // Container name
  image: string;           // Docker image
  status: ContainerStatus; // 'created' | 'running' | 'paused' | 'stopped' | 'removing'
  health?: HealthStatus;   // 'healthy' | 'unhealthy' | 'starting'
  ports?: string[];        // Port mappings
  uptime?: number;         // Uptime in seconds
}

tui.addContainer({
  id: 'postgres-1',
  name: 'postgres',
  image: 'postgres:14',
  status: 'running',
  health: 'healthy',
  ports: ['5432:5432']
});
```

### Network Monitoring

#### `tui.updateNetwork(network)`

Update network status and endpoints.

```typescript
interface NetworkInfo {
  id: string;                // Network identifier
  name: string;              // Display name
  status: NetworkStatus;     // 'starting' | 'running' | 'failed' | 'stopped'
  endpoints?: EndpointInfo[];
  stats?: NetworkStats;
}

interface EndpointInfo {
  name: string;              // Endpoint name
  url: string;               // Endpoint URL
  status: 'up' | 'down';     // Health status
  responseTime?: number;     // Response time in ms
  lastError?: string;        // Last error message
}

tui.updateNetwork({
  id: 'devnet',
  name: 'Development Network',
  status: 'running',
  endpoints: [
    { name: 'API', url: 'http://localhost:8080', status: 'up', responseTime: 23 },
    { name: 'Metrics', url: 'http://localhost:9090', status: 'up', responseTime: 12 }
  ],
  stats: {
    totalRequests: 1523,
    errorRate: 0.02,
    avgResponseTime: 45
  }
});
```

### UI Components

#### Spinner

Animated loading indicators.

```typescript
import { Spinner } from '@pact-toolbox/tui';

const spinner = new Spinner({
  text: 'Loading...',
  type: 'dots',    // 'dots' | 'line' | 'pipe' | 'star'
  color: 'green',
  indent: 2
});

spinner.start();
setTimeout(() => {
  spinner.succeed('Done!');
}, 3000);
```

#### Progress

Progress bars with ETA calculation.

```typescript
import { Progress } from '@pact-toolbox/tui';

const progress = new Progress({
  total: 100,
  text: 'Processing files',
  width: 40,
  color: 'blue'
});

progress.start();
for (let i = 0; i <= 100; i++) {
  progress.update(i);
  await sleep(50);
}
progress.finish();
```

#### Table

Formatted table rendering.

```typescript
import { Table } from '@pact-toolbox/tui';

const table = new Table({
  headers: ['Name', 'Status', 'CPU', 'Memory'],
  alignments: ['left', 'center', 'right', 'right'],
  borderStyle: 'rounded'
});

table.addRow(['API Server', 'Running', '15.2%', '256MB']);
table.addRow(['Worker', 'Stopped', '0%', '0MB']);

console.log(table.render());
```

#### Status

Status message formatting.

```typescript
import { Status } from '@pact-toolbox/tui';

Status.success('Build completed successfully');
Status.error('Failed to connect to database');
Status.warning('Low disk space');
Status.info('Server started on port 3000');
```

## Themes

### Built-in Themes

```typescript
import { defaultTheme, lightTheme, minimalTheme } from '@pact-toolbox/tui';

// Use a built-in theme
tui.start({ theme: lightTheme });
```

### Custom Themes

```typescript
const customTheme = {
  colors: {
    primary: '#00ff00',
    secondary: '#888888',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    muted: '#666666',
    border: '#333333',
    background: '#000000',
    foreground: '#ffffff'
  },
  symbols: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    running: '●',
    stopped: '○',
    separator: '│',
    arrow: '→'
  },
  borders: {
    style: 'rounded',
    horizontal: '─',
    vertical: '│',
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯'
  }
};

tui.start({ theme: customTheme });
```

## Keyboard Controls

When interactive mode is enabled:

- **Q/q**: Quit the TUI
- **R/r**: Force refresh
- **↑/↓**: Navigate through sections
- **←/→**: Navigate within sections
- **Enter**: Select/expand item
- **Esc**: Cancel/close

## Events

The TUI manager emits various events:

```typescript
tui.on('start', () => {
  console.log('TUI started');
});

tui.on('stop', () => {
  console.log('TUI stopped');
});

tui.on('keypress', (key, meta) => {
  console.log(`Key pressed: ${key}`);
});

tui.on('error', (error) => {
  console.error('TUI error:', error);
});

tui.on('resize', ({ width, height }) => {
  console.log(`Terminal resized to ${width}x${height}`);
});
```

## Advanced Usage

### Higher-Order Functions

```typescript
import { withTUI } from '@pact-toolbox/tui';

// Wrap a function with TUI monitoring
const monitoredFunction = withTUI(async () => {
  // Your code here
}, {
  name: 'Data Processing',
  showProgress: true
});

await monitoredFunction();
```

### Decorators

```typescript
import { tuiMonitor, monitorProcess } from '@pact-toolbox/tui';

@tuiMonitor({ name: 'MyService' })
class MyService {
  @monitorProcess({ name: 'processData' })
  async processData() {
    // Method execution will be monitored
  }
}
```

### Custom Layouts

```typescript
import { TUIManager, TUIRenderer } from '@pact-toolbox/tui';

class CustomRenderer extends TUIRenderer {
  protected renderContent(): string {
    // Custom layout implementation
    return this.sections.join('\n');
  }
}

const manager = new TUIManager({
  renderer: new CustomRenderer()
});
```

## Best Practices

### 1. Resource Management

```typescript
// Always stop TUI on exit
process.on('SIGINT', () => {
  tui.stop();
  process.exit(0);
});

// Or use automatic cleanup
tui.start({ autoCleanup: true });
```

### 2. Log Management

```typescript
// Limit log entries to prevent memory issues
tui.start({ maxLogs: 100 });

// Use appropriate log levels
tui.log('debug', 'app', 'Detailed debug info'); // Only in development
tui.log('info', 'app', 'Normal operation');
tui.log('warn', 'app', 'Potential issue');
tui.log('error', 'app', 'Error occurred');
```

### 3. Performance

```typescript
// Adjust refresh rate based on needs
tui.start({ 
  refreshRate: 2000  // Slower updates for less CPU usage
});

// Batch updates when possible
const updates = processes.map(p => ({
  id: p.id,
  cpu: p.cpu,
  memory: p.memory
}));
tui.batchUpdateProcesses(updates);
```

### 4. Error Handling

```typescript
try {
  tui.start();
} catch (error) {
  // Fallback to regular console logging
  console.error('TUI failed to start:', error);
  console.log('Falling back to console output');
}
```

## Terminal Compatibility

- **Unix/Linux**: Full support with ANSI escape sequences
- **macOS**: Full support in Terminal.app and iTerm2
- **Windows**: Requires Windows Terminal or ConEmu
- **SSH**: Works over SSH with proper terminal emulation
- **CI/CD**: Automatically disables in non-TTY environments

## Troubleshooting

### Common Issues

1. **"Terminal does not support ANSI escape codes"**
   - Use a modern terminal emulator
   - Enable ANSI support in Windows CMD

2. **"TUI not displaying correctly"**
   - Check terminal dimensions (minimum 80x24)
   - Verify TERM environment variable
   - Try a different theme

3. **"Keyboard controls not working"**
   - Ensure interactive mode is enabled
   - Check if another process is capturing input
   - Verify terminal is in raw mode

4. **"High CPU usage"**
   - Increase refresh rate
   - Reduce number of monitored items
   - Disable animations

### Debug Mode

```typescript
// Enable debug logging
process.env.TUI_DEBUG = 'true';

// Or programmatically
tui.setDebugMode(true);
```

## Integration Examples

### With Process Manager

```typescript
import { createProcess } from '@pact-toolbox/process-manager';
import { tui } from '@pact-toolbox/tui';

const process = await createProcess({
  id: 'my-app',
  name: 'My Application',
  command: 'node',
  args: ['app.js']
});

// TUI automatically picks up process updates
```

### With Container Orchestrator

```typescript
import { ContainerOrchestrator } from '@pact-toolbox/container-orchestrator';
import { tui } from '@pact-toolbox/tui';

const orchestrator = new ContainerOrchestrator();
// TUI automatically displays container status
```

### Custom Monitoring

```typescript
// Monitor custom metrics
setInterval(() => {
  tui.updateCustomMetric('api-calls', {
    value: getApiCallCount(),
    label: 'API Calls/sec',
    color: 'green'
  });
}, 1000);
```