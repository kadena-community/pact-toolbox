# @pact-toolbox/pact-transformer

High-performance Pact code transformer implemented in Rust with Node.js bindings via NAPI-RS.

## Features

- **Fast Parsing**: Uses tree-sitter-pact for efficient parsing with pooled parsers
- **Type Generation**: Generates TypeScript type definitions from Pact modules
- **Cross-Platform**: Supports Windows, macOS, Linux, FreeBSD, Android, and WebAssembly
- **Framework Support**: Generate framework-specific code for React, Vue, Angular, and more
- **File Watching**: Monitor Pact files and auto-transform on changes
- **Documentation Generation**: Create HTML, Markdown, or GitBook documentation
- **Test Generation**: Generate test suites for Jest, Vitest, Mocha, or AVA
- **Plugin System**: Extensible architecture with built-in plugins
- **Source Maps**: Full source map support for debugging

## Installation

```bash
npm install @pact-toolbox/pact-transformer
# or
pnpm add @pact-toolbox/pact-transformer
# or
yarn add @pact-toolbox/pact-transformer
```

The package will automatically install the appropriate native binary for your platform.

## Supported Platforms

| Operating System | Architecture                   | Node Version |
| ---------------- | ------------------------------ | ------------ |
| Windows          | x64, x86, arm64                | >= 20        |
| macOS            | x64, arm64                     | >= 20        |
| Linux            | x64, arm64 (glibc/musl), armv7 | >= 20        |
| FreeBSD          | x64                            | >= 20        |
| Android          | arm64, armv7                   | >= 20        |
| WebAssembly      | WASI                           | >= 20        |

## Quick Start

### Basic Transformation

```javascript
import { PactTransformer } from "@pact-toolbox/pact-transformer";

const pact = new PactTransformer();

const source = `
(module coin GOVERNANCE
  (defun transfer:string (from:string to:string amount:decimal)
    "Transfer tokens between accounts"
    (format "Transferred {} from {} to {}" [amount from to])))
`;

// Transform to JavaScript/TypeScript
const result = await pact.transform(source, { generateTypes: true });
console.log(result.javascript); // Generated JavaScript code
console.log(result.typescript); // Generated TypeScript types
```

### Parse and Analyze

```javascript
// Parse modules and get metadata
const modules = pact.parse(source);
modules.forEach((module) => {
  console.log(`Module: ${module.name}`);
  console.log(`Functions: ${module.functionCount}`);
  console.log(`Schemas: ${module.schemaCount}`);
});

// Get parsing errors
const errors = pact.getErrors(invalidSource);
errors.forEach((err) => {
  console.log(`Error at ${err.line}:${err.column} - ${err.message}`);
});
```

## File Operations

### Transform Files

```javascript
import { FileOps } from "@pact-toolbox/pact-transformer";

// Transform a single file
const result = await FileOps.transformFile(
  "contracts/coin.pact",
  { generateTypes: true },
  {
    outputDir: "dist",
    format: "ts", // or 'js-types' for separate .js and .d.ts
  },
);

// Transform multiple files
const results = await FileOps.transformFiles(
  ["src/**/*.pact", "contracts/*.pact"],
  { generateTypes: true },
  { outputDir: "dist", preserveStructure: true },
);

// Find Pact files
const files = await FileOps.findFiles(["src/**/*.pact"]);
```

## Watch Mode

```javascript
import { WatchSession } from "@pact-toolbox/pact-transformer";

// Start watching files
const watcher = await WatchSession.start(
  ["src/**/*.pact"],
  {
    debounceMs: 300,
    initialTransform: true,
    handleDeletions: true,
  },
  { generateTypes: true },
  { outputDir: "dist" },
);

// Get statistics
const stats = await watcher.stats();
console.log(`Watching ${stats.watchedFiles} files`);
console.log(`Processed ${stats.totalTransforms} transforms`);

// Stop watching
await watcher.stop();
```

## Documentation Generation

```javascript
import { DocsGenerator } from "@pact-toolbox/pact-transformer";

const docs = await DocsGenerator.generate(source, {
  format: "html",
  theme: "dark",
  includeExamples: true,
  searchEnabled: true,
  apiPlayground: true,
});

console.log(docs.content); // Generated documentation
console.log(docs.assets); // Additional assets (CSS, JS, images)
```

## Test Generation

```javascript
import { TestGenerator } from "@pact-toolbox/pact-transformer";

const tests = await TestGenerator.generate(source, {
  framework: "vitest",
  typescript: true,
  generateMocks: true,
  generateFixtures: true,
  propertyTests: true,
});

// Write test files
tests.testFiles.forEach((file) => {
  console.log(`Generated: ${file.path}`);
  // Write file.content to disk
});
```

## Framework Integration

```javascript
import { transformPactToFramework } from "@pact-toolbox/pact-transformer";

// Generate React hooks
const reactResult = await transformPactToFramework(source, {
  target: "react",
  patterns: ["hooks"],
  typescript: true,
  treeShaking: true,
});

// Generate Vue composables
const vueResult = await transformPactToFramework(source, {
  target: "vue",
  patterns: ["composables"],
  frameworkVersion: "3",
});
```

## Configuration

```javascript
import { ConfigManager } from "@pact-toolbox/pact-transformer";

// Load configuration
const config = await ConfigManager.load("./pact-toolbox.config.js", "production");

// Validate configuration
const isValid = ConfigManager.validate(config);
```

## Plugin System

```javascript
import { PluginManager } from "@pact-toolbox/pact-transformer";

// List available plugins
const plugins = PluginManager.list();

// Register and enable a plugin
PluginManager.register("minifier");
PluginManager.setEnabled("minifier", true);
```

## Performance Utilities

```javascript
import { Utils } from "@pact-toolbox/pact-transformer";

// Warm up parser pool for better initial performance
Utils.warmUp();

// Benchmark performance
const avgTime = Utils.benchmark(source, 1000); // Run 1000 iterations
console.log(`Average parse time: ${avgTime}ms`);

// Reset optimization state
Utils.resetOptimizations();
```

## API Reference

### Main Classes

- **`PactTransformer`** - Main API for transformations
- **`FileOps`** - File operation utilities
- **`WatchSession`** - File watching functionality
- **`DocsGenerator`** - Documentation generation
- **`TestGenerator`** - Test suite generation
- **`ConfigManager`** - Configuration management
- **`PluginManager`** - Plugin system
- **`Utils`** - Performance utilities

### Types

The package exports comprehensive TypeScript definitions for all APIs. See the [type definitions](./index.d.ts) for complete details.

## Development

### Prerequisites

- Node.js >= 20
- Rust toolchain (latest stable)
- pnpm

### Building from Source

```bash
# Clone the repository
git clone https://github.com/kadena-community/pact-toolbox
cd pact-toolbox/crates/pact-transformer

# Install dependencies
pnpm install

# Build the native module
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

### Cross-Platform Building

The project uses GitHub Actions for cross-platform builds. To build locally for a specific target:

```bash
# Build for a specific target
pnpm build --target x86_64-pc-windows-msvc

# Build with cross-compilation support
pnpm build --target aarch64-unknown-linux-gnu --use-napi-cross
```

## Performance

The Rust implementation provides significant performance improvements:

- **5-10x faster** parsing compared to pure JavaScript implementations
- **Pooled parsers** for efficient resource usage
- **Parallel processing** for batch operations
- **Memory efficient** through optimized data structures

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT

## Acknowledgments

- Built with [NAPI-RS](https://napi.rs/) for Node.js bindings
- Uses [tree-sitter-pact](https://github.com/kadena-community/tree-sitter-pact) for parsing
- Part of the [Pact Toolbox](https://github.com/kadena-community/pact-toolbox) ecosystem
