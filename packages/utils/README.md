# @pact-toolbox/utils

> Cross-platform utility functions for Pact smart contract development

## Overview

The `@pact-toolbox/utils` package provides essential utility functions that support the Pact Toolbox ecosystem. This package focuses on cross-platform utilities that work in both browser and Node.js environments, including chainweb API interactions, async helpers, template processing, and event handling.

## Installation

```bash
npm install @pact-toolbox/utils
# or
pnpm add @pact-toolbox/utils
# or
yarn add @pact-toolbox/utils
```

## Features

- **Chainweb API Utilities** - Health checks, block height monitoring, and block creation
- **Async Operation Helpers** - Delays, polling with timeout support, and cancellation
- **Template Processing** - Mustache-style string templating with validation
- **Event Emitter** - Type-safe, cross-platform event handling
- **UUID Generation** - Cryptographically secure unique identifiers
- **Date Formatting** - Locale-aware date formatting utilities

## API Reference

### Chainweb API Utilities

#### `isChainWebNodeOk(serviceUrl, timeout?)`

Check if a Chainweb node is responding and healthy.

```typescript
import { isChainWebNodeOk } from "@pact-toolbox/utils";

const isHealthy = await isChainWebNodeOk("https://api.chainweb.com", 5000);
console.log(isHealthy ? "Node is healthy" : "Node is down");
```

**Parameters:**

- `serviceUrl: string` - The base URL of the Chainweb service
- `timeout?: number` - Optional timeout in milliseconds (default: 5000)

**Returns:** `Promise<boolean>` - True if the node is healthy, false otherwise

#### `isChainWebAtHeight(targetHeight, serviceUrl, timeout?)`

Check if a Chainweb node has reached a specific block height.

```typescript
import { isChainWebAtHeight } from "@pact-toolbox/utils";

const hasReached = await isChainWebAtHeight(1000000, "https://api.chainweb.com");
console.log(`Node has reached height: ${hasReached}`);
```

**Parameters:**

- `targetHeight: number` - The target block height
- `serviceUrl: string` - The base URL of the Chainweb service
- `timeout?: number` - Optional timeout in milliseconds (default: 5000)

**Returns:** `Promise<boolean>` - True if at or above target height, false otherwise

#### `makeBlocks(params)`

Request block creation on specified chains (for development networks with on-demand mining).

```typescript
import { makeBlocks } from "@pact-toolbox/utils";

const result = await makeBlocks({
  count: 5,
  chainIds: ["0", "1", "2"],
  onDemandUrl: "http://localhost:8080",
});
```

**Parameters:**

- `params: MakeBlocksParams`
  - `count?: number` - Number of blocks to create (default: 1)
  - `chainIds?: string[]` - Chain IDs to create blocks on (default: ['0'])
  - `onDemandUrl: string` - URL of the on-demand mining endpoint

**Returns:** `Promise<any>` - Response data from the server

#### `didMakeBlocks(params)`

Validate that blocks were successfully created.

```typescript
import { didMakeBlocks } from "@pact-toolbox/utils";

const success = await didMakeBlocks({
  count: 5,
  chainIds: ["0"],
  onDemandUrl: "http://localhost:8080",
});
```

**Returns:** `Promise<boolean>` - True if blocks were created successfully

### Async Operation Helpers

#### `delay(ms, signal?)`

Create a cancellable delay.

```typescript
import { delay } from "@pact-toolbox/utils";

// Simple delay
await delay(1000); // Wait 1 second

// Cancellable delay
const controller = new AbortController();
setTimeout(() => controller.abort(), 500);

try {
  await delay(1000, controller.signal);
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Delay was cancelled");
  }
}
```

**Parameters:**

- `ms: number` - Milliseconds to delay
- `signal?: AbortSignal` - Optional signal for cancellation

**Returns:** `Promise<void>`

#### `pollFn(fn, options)`

Poll a function until it returns true or times out.

```typescript
import { pollFn } from "@pact-toolbox/utils";

await pollFn(
  async () => {
    const response = await fetch("/api/status");
    return response.ok;
  },
  {
    timeout: 30000, // 30 seconds total
    interval: 1000, // Check every second
    stopOnError: false, // Continue polling even if fn throws
  },
);
```

**Parameters:**

- `fn: () => Promise<boolean>` - Function to poll (should return true when done)
- `options: PollOptions`
  - `timeout: number` - Total timeout in milliseconds
  - `interval?: number` - Polling interval in milliseconds (default: 100)
  - `signal?: AbortSignal` - Optional signal for cancellation
  - `stopOnError?: boolean` - Stop polling if fn throws (default: false)

**Returns:** `Promise<void>`

**Throws:** `TimeoutError` if timeout is reached, `AbortError` if cancelled

### Template Processing

#### `fillTemplatePlaceholders(template, context)`

Process Mustache-style templates with validation.

```typescript
import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

const template = "Hello {{name}}, your balance is {{balance}} KDA.";
const context = { name: "Alice", balance: "100.5" };

const result = fillTemplatePlaceholders(template, context);
console.log(result); // "Hello Alice, your balance is 100.5 KDA."

// Error handling for missing variables
try {
  fillTemplatePlaceholders("Hello {{name}}", {}); // Missing 'name'
} catch (error) {
  console.error("Template error:", error.message);
  // "Missing required context values for keys: name"
}
```

**Parameters:**

- `template: string` - Template string with {{key}} placeholders
- `context: Record<string, any>` - Object with values for placeholders

**Returns:** `string` - Processed template

**Throws:** `Error` if any placeholders are missing from context

### Event Emitter

#### `EventEmitter<T>`

Type-safe, cross-platform event emitter.

```typescript
import { EventEmitter } from "@pact-toolbox/utils";

// Define your event types
interface MyEvents {
  data: (value: string) => void;
  error: (error: Error) => void;
  complete: () => void;
}

// Create typed emitter
const emitter = new EventEmitter<MyEvents>();

// Add listeners
emitter.on("data", (value) => console.log("Data:", value));
emitter.on("error", (err) => console.error("Error:", err));

// Emit events
emitter.emit("data", "Hello"); // Type-safe!
emitter.emit("complete");

// One-time listeners
emitter.once("data", (value) => {
  console.log("First data only:", value);
});

// Remove listeners
const handler = (value: string) => console.log(value);
emitter.on("data", handler);
emitter.off("data", handler);

// Check listeners
console.log(emitter.listenerCount("data")); // 2
console.log(emitter.hasListeners("error")); // true
```

**Methods:**

- `on(event, listener)` - Add a listener
- `once(event, listener)` - Add a one-time listener
- `off(event, listener)` - Remove a listener
- `emit(event, ...args)` - Emit an event
- `removeAllListeners(event?)` - Remove all listeners
- `listenerCount(event)` - Get listener count
- `hasListeners(event)` - Check if event has listeners
- `eventNames()` - Get all event names with listeners
- `listeners(event)` - Get all listeners for an event
- `prependListener(event, listener)` - Add listener to beginning
- `prependOnceListener(event, listener)` - Add one-time listener to beginning

### UUID Generation

#### `getUuid()`

Generate cryptographically secure UUIDs.

```typescript
import { getUuid } from "@pact-toolbox/utils";

const id = getUuid();
console.log("Generated UUID:", id); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Returns:** `string` - UUID v4 string

#### `nanoid(length?)`

Generate URL-safe unique IDs.

```typescript
import { nanoid } from "@pact-toolbox/utils";

const id = nanoid(); // Default 21 characters
const shortId = nanoid(10); // Custom length
```

**Parameters:**

- `length?: number` - ID length (default: 21)

**Returns:** `string` - URL-safe unique ID

### Date Utilities

#### `formatDate(date)`

Format dates using locale-aware formatting.

```typescript
import { formatDate } from "@pact-toolbox/utils";

const formatted = formatDate(new Date());
console.log("Current date:", formatted); // "Dec 25, 2023, 10:30:00"

// Also accepts date strings
const fromString = formatDate("2023-12-25T10:30:00Z");
```

**Parameters:**

- `date: Date | string` - Date to format

**Returns:** `string` - Formatted date string

## Error Classes

### `TimeoutError`

Thrown when an operation times out.

```typescript
import { TimeoutError, pollFn } from "@pact-toolbox/utils";

try {
  await pollFn(() => checkService(), { timeout: 5000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error("Operation timed out");
  }
}
```

### `AbortError`

Thrown when an operation is cancelled via AbortSignal.

```typescript
import { AbortError, delay } from "@pact-toolbox/utils";

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  await delay(5000, controller.signal);
} catch (error) {
  if (error instanceof AbortError) {
    console.log("Operation was cancelled");
  }
}
```

### `ChainWebError`

Thrown for Chainweb-specific errors.

```typescript
import { ChainWebError } from "@pact-toolbox/utils";

try {
  await makeBlocks({ onDemandUrl: "invalid-url" });
} catch (error) {
  if (error instanceof ChainWebError) {
    console.error("Chainweb error:", error.message);
    console.error("Cause:", error.cause);
  }
}
```

## Examples

### Waiting for Blockchain Sync

```typescript
import { pollFn, isChainWebAtHeight, TimeoutError } from "@pact-toolbox/utils";

async function waitForBlockHeight(targetHeight: number, nodeUrl: string) {
  try {
    await pollFn(() => isChainWebAtHeight(targetHeight, nodeUrl), {
      timeout: 60000, // 1 minute timeout
      interval: 2000, // Check every 2 seconds
    });
    console.log(`Node reached height ${targetHeight}`);
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error("Node did not reach target height in time");
    }
    throw error;
  }
}
```

### Event-Driven Architecture

```typescript
import { EventEmitter } from "@pact-toolbox/utils";

interface BlockchainEvents {
  "block:new": (height: number, hash: string) => void;
  "transaction:confirmed": (txId: string) => void;
  error: (error: Error) => void;
}

class BlockchainMonitor extends EventEmitter<BlockchainEvents> {
  async startMonitoring() {
    // Monitor blockchain
    setInterval(async () => {
      try {
        const block = await fetchLatestBlock();
        this.emit("block:new", block.height, block.hash);
      } catch (error) {
        this.emit("error", error as Error);
      }
    }, 5000);
  }
}

const monitor = new BlockchainMonitor();

monitor.on("block:new", (height, hash) => {
  console.log(`New block: ${height} (${hash})`);
});

monitor.on("error", (error) => {
  console.error("Monitoring error:", error);
});

await monitor.startMonitoring();
```

### Template-Based Configuration

```typescript
import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

const configTemplate = `{
  "node": "{{nodeUrl}}",
  "chainId": "{{chainId}}",
  "account": "{{accountName}}",
  "gasLimit": {{gasLimit}}
}`;

const config = fillTemplatePlaceholders(configTemplate, {
  nodeUrl: "https://api.chainweb.com",
  chainId: "0",
  accountName: "alice",
  gasLimit: "150000",
});

const parsedConfig = JSON.parse(config);
```

## Migration Guide

If you're looking for Node.js-specific utilities that were previously in this package, they have been moved to `@pact-toolbox/node-utils`:

- Process management (`runBin`, `killProcess`, `executeCommand`)
- File system utilities (`ensureDir`, `writeFile`)
- Port management (`getRandomPort`, `isPortTaken`)
- Logging infrastructure
- CLI prompts
- Pact installation utilities

```bash
# Install Node.js-specific utilities
pnpm add @pact-toolbox/node-utils
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
