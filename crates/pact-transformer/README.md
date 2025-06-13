# pact-transformer-napi

High-performance Pact code transformer implemented in Rust with Node.js bindings via NAPI-RS.

## Features

- **Fast Parsing**: Uses tree-sitter-pact for efficient parsing
- **Parallel Processing**: Leverages Rust's rayon for parallel module processing
- **Memory Optimized**: Uses arena allocation and efficient data structures
- **Type Generation**: Generates TypeScript type definitions from Pact schemas
- **Error Reporting**: Detailed error reporting with line/column information
- **Cross-Platform**: Supports Windows, macOS, Linux, and more

## Installation

```bash
npm install @pact-toolbox/transformer-native
```

## Usage

### Async API

```javascript
import { transformPactToJs } from '@pact-toolbox/transformer-native';

const pactCode = `
(module coin GOVERNANCE
  (defun transfer:string (from:string to:string amount:decimal)
    "Transfer tokens"
    (format "Transferred {} from {} to {}" [amount from to])))
`;

const result = await transformPactToJs(pactCode, {
  generateTypes: true
});

console.log(result.code);   // Generated JavaScript
console.log(result.types);  // Generated TypeScript types
console.log(result.modules); // Parsed module AST
```

### Sync API

```javascript
import { createPactTransformer } from '@pact-toolbox/transformer-native';

const transformer = createPactTransformer();
const modules = transformer.transform(pactCode);
const errors = transformer.getErrors(invalidCode);
```

## Performance

The Rust implementation provides significant performance improvements over the TypeScript version:

- **3-5x faster** parsing for large modules
- **Parallel processing** of multiple modules
- **Lower memory usage** through arena allocation
- **Better scalability** for large codebases

## Development

### Building

```bash
# Install dependencies
npm install

# Build native module
npm run build

# Run tests
npm test

# Run benchmarks
node benchmark.mjs
```

### Architecture

The transformer uses:
- **tree-sitter-pact** for parsing Pact code
- **rayon** for parallel processing
- **bumpalo** for arena allocation
- **NAPI-RS** for Node.js bindings

## License

MIT