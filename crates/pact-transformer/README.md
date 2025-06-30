# @pact-toolbox/pact-transformer

High-performance Pact code transformer implemented in Rust with Node.js bindings via NAPI-RS.

## Features

- **Clean API**: Simple `createPactTransformer` factory function with configuration-driven design
- **Fast Parsing**: Uses tree-sitter-pact for efficient parsing with pooled parsers
- **Type Generation**: Generates TypeScript type definitions from Pact modules
- **Cross-Platform**: Supports Windows, macOS, Linux, FreeBSD, Android, and WebAssembly
- **File Watching**: Built-in file monitoring and auto-transformation on changes
- **Plugin System**: Extensible architecture with built-in plugins
- **Source Maps**: Full source map support for debugging
- **Batch Processing**: Transform multiple files efficiently with glob patterns
- **Error Handling**: Built-in parsing error detection and reporting

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

### Basic Usage

```javascript
import { createPactTransformer } from "@pact-toolbox/pact-transformer";

// Create transformer instance with configuration
const transformer = createPactTransformer({
  transform: {
    generateTypes: true,
    sourceMaps: true,
  },
  fileOutput: {
    outputDir: "./output",
    format: "js-types",
  },
});

const pactCode = `
(module coin GOVERNANCE
  (defcap GOVERNANCE () true)
  (defun transfer:string (from:string to:string amount:decimal)
    "Transfer tokens between accounts"
    (format "Transferred {} from {} to {}" [amount from to])))
`;

// Transform to JavaScript/TypeScript
const result = await transformer.transform(pactCode, {
  moduleName: "coin-contract",
});

console.log(result.javascript); // Generated JavaScript code
console.log(result.typescript); // Generated TypeScript types
```

### Parse and Analyze

```javascript
// Parse modules and get metadata
const modules = transformer.parse(pactCode);
modules.forEach((module) => {
  console.log(`Module: ${module.name}`);
  console.log(`Functions: ${module.functionCount}`);
  console.log(`Schemas: ${module.schemaCount}`);
});

// Get parsing errors
const errors = transformer.getErrors(invalidCode);
errors.forEach((err) => {
  console.log(`Error at ${err.line}:${err.column} - ${err.message}`);
});
```

## File Operations

### Transform Files

```javascript
// Transform a single file
const fileResult = await transformer.transformFile("contracts/coin.pact", {
  transformOptions: { generateTypes: true },
});

console.log(`File ${fileResult.sourcePath} processed in ${fileResult.timeMs}ms`);

// Transform multiple files using glob patterns
const batchResult = await transformer.transformFiles(["src/**/*.pact", "contracts/*.pact"], {
  transformOptions: { generateTypes: true },
});

console.log(`Processed ${batchResult.successCount} files successfully`);
console.log(`Failed: ${batchResult.errorCount} files`);
```

### Watch Mode

```javascript
// Create transformer with watch configuration
const transformer = createPactTransformer({
  watch: {
    patterns: ["**/*.pact"],
    debounceMs: 300,
    initialTransform: true,
    handleDeletions: true,
  },
  fileOutput: {
    outputDir: "dist",
    format: "js-types",
  },
});

// Start watching files
const batchResult = await transformer.transformFiles(["src/**/*.pact"], {
  transformOptions: { generateTypes: true },
  watch: true, // Enable watch mode
});

// Watch mode will continue monitoring files in the background
```

### Configuration Override

```javascript
// Set default configuration
const transformer = createPactTransformer({
  transform: {
    generateTypes: false, // Default setting
    sourceMaps: true,
  },
});

// Override configuration per transform
const result = await transformer.transform(pactCode, {
  generateTypes: true, // Override the default
  moduleName: "custom-module",
});
```

## API Reference

### `createPactTransformer(config?: PactTransformerConfig): PactTransformer`

Creates a new transformer instance with the specified configuration.

#### Configuration Options

```typescript
interface PactTransformerConfig {
  plugins?: PluginConfig[];
  transform?: TransformOptions;
  fileOutput?: FileOutputOptions;
  watch?: WatchOptions;
}
```

### PactTransformer Methods

- **`transform(code: string, options?: TransformOptions): Promise<TransformResult>`** - Transform Pact source code
- **`transformFile(filePath: string, options?: TransformFileOptions): Promise<FileResult>`** - Transform single file with optional watch mode
- **`transformFiles(patterns: string[], options?: TransformFilesOptions): Promise<BatchResult>`** - Transform multiple files with glob patterns
- **`parse(code: string): ModuleInfo[]`** - Parse Pact code and return module information
- **`getErrors(code: string): ErrorInfo[]`** - Get parsing errors for source code

### Core Types

```typescript
interface TransformResult {
  javascript: string;
  typescript?: string;
  sourceMap?: string;
  declarationMap?: string;
}

interface FileResult {
  sourcePath: string;
  outputPath?: string;
  success: boolean;
  error?: string;
  timeMs: number;
}

interface ModuleInfo {
  name: string;
  namespace?: string;
  governance: string;
  functionCount: number;
  schemaCount: number;
  capabilityCount: number;
  constantCount: number;
}
```

See the [type definitions](./index.d.ts) for complete API documentation.

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
