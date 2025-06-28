---
title: "Universal Plugin"
description: "Universal plugin for Pact smart contract development. Works with Vite, Webpack, Next.js, Nuxt, and 10+ other bundlers."
---

# Universal Plugin

The Universal Plugin (`@pact-toolbox/unplugin`) is the core build tool integration for Pact Toolbox. It provides seamless Pact contract compilation, TypeScript type generation, and hot module replacement across 10+ different bundlers.

## Features

- 🔌 **Universal Compatibility** - Works with Vite, Webpack, Next.js, Nuxt, Rollup, esbuild, RSpack, Rsbuild, Farm, and Jest
- 🔥 **Hot Module Replacement** - Instant feedback during development
- 📝 **TypeScript Generation** - Automatic type generation from Pact contracts
- 🚀 **Framework Support** - Generate React, Vue, Angular, and Svelte bindings
- 🛠️ **Zero Config** - Works out of the box with sensible defaults
- ⚡ **Fast** - Rust-powered parser for maximum performance
- 🔍 **Source Maps** - Full debugging support

## Installation

```bash
# npm
npm install -D @pact-toolbox/unplugin

# pnpm
pnpm add -D @pact-toolbox/unplugin

# yarn
yarn add -D @pact-toolbox/unplugin
```

## Quick Start

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import pactPlugin from '@pact-toolbox/unplugin/vite'

export default defineConfig({
  plugins: [
    pactPlugin({
      // Optional configuration
    })
  ]
})
```

### Webpack

```javascript
// webpack.config.js
const PactPlugin = require('@pact-toolbox/unplugin/webpack')

module.exports = {
  plugins: [
    new PactPlugin({
      // Optional configuration
    })
  ]
}
```

### Next.js

```javascript
// next.config.js
const withPact = require('@pact-toolbox/unplugin/next')

module.exports = withPact({
  // Your Next.js config
})
```

### Nuxt

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  modules: [
    '@pact-toolbox/unplugin/nuxt'
  ],
  pactToolbox: {
    // Optional configuration
  }
})
```

### Rollup

```javascript
// rollup.config.js
import pactPlugin from '@pact-toolbox/unplugin/rollup'

export default {
  plugins: [
    pactPlugin({
      // Optional configuration
    })
  ]
}
```

## Configuration

### Basic Options

```typescript
interface PactPluginOptions {
  // Glob patterns for Pact files to include
  include?: string | string[]
  // Default: ['**/*.pact']
  
  // Glob patterns for files to exclude
  exclude?: string | string[]
  // Default: ['**/node_modules/**']
  
  // Output directory for generated TypeScript files
  outputDir?: string
  // Default: '.pact-toolbox'
  
  // Enable hot module replacement
  hmr?: boolean
  // Default: true in development
  
  // Enable source maps
  sourcemap?: boolean
  // Default: true
  
  // Transform options
  transform?: TransformOptions
}
```

### Transform Options

```typescript
interface TransformOptions {
  // Target framework for code generation
  framework?: 'none' | 'react' | 'vue' | 'angular' | 'svelte'
  // Default: 'none'
  
  // TypeScript generation options
  typescript?: {
    // Generate .d.ts files
    declarations?: boolean
    // Default: true
    
    // Emit JSDoc comments
    jsdoc?: boolean
    // Default: true
    
    // Custom type mappings
    typeMappings?: Record<string, string>
  }
  
  // Documentation generation
  docs?: {
    // Generate markdown documentation
    markdown?: boolean
    // Generate HTML documentation
    html?: boolean
    // Generate JSON schema
    json?: boolean
  }
  
  // Test generation
  tests?: {
    // Generate test files
    generate?: boolean
    // Test framework
    framework?: 'vitest' | 'jest' | 'mocha'
  }
}
```

## Usage Examples

### Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import pactPlugin from '@pact-toolbox/unplugin/vite'

export default defineConfig({
  plugins: [
    pactPlugin({
      include: ['src/**/*.pact'],
      outputDir: 'src/generated',
      transform: {
        framework: 'react',
        typescript: {
          declarations: true,
          jsdoc: true
        }
      }
    })
  ]
})
```

### Importing Pact Contracts

Once configured, you can import Pact contracts directly in your TypeScript/JavaScript code:

```typescript
// Import contract with generated types
import { todos } from './contracts/todos.pact'

// Use with full type safety
const result = await todos.createTodo({
  id: 'todo-1',
  title: 'Build awesome dApp',
  completed: false
})
.sign()
.submitAndListen()

// TypeScript knows the return type
console.log(result.data) // Fully typed!
```

### Framework-Specific Usage

#### React

```typescript
// Configure for React
pactPlugin({
  transform: {
    framework: 'react'
  }
})

// Use generated React hooks
import { useTodos } from './contracts/todos.pact'

function TodoList() {
  const { data, loading, error } = useTodos.getAllTodos()
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <ul>
      {data.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

#### Vue

```typescript
// Configure for Vue
pactPlugin({
  transform: {
    framework: 'vue'
  }
})

// Use generated Vue composables
import { useTodos } from './contracts/todos.pact'

export default {
  setup() {
    const { data, loading, error } = useTodos.getAllTodos()
    
    return { data, loading, error }
  }
}
```

### Advanced Configuration

#### Custom Type Mappings

```typescript
pactPlugin({
  transform: {
    typescript: {
      typeMappings: {
        'decimal': 'string | number',
        'time': 'Date | string',
        'guard': 'KeysetGuard | CustomGuard'
      }
    }
  }
})
```

#### Multiple Contract Directories

```typescript
pactPlugin({
  include: [
    'src/contracts/**/*.pact',
    'lib/shared-contracts/**/*.pact'
  ],
  outputDir: 'src/types/contracts'
})
```

#### Development vs Production

```typescript
const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [
    pactPlugin({
      hmr: isDev,
      sourcemap: isDev,
      transform: {
        typescript: {
          declarations: true,
          jsdoc: isDev // Only in development
        },
        docs: {
          markdown: !isDev // Only in production
        }
      }
    })
  ]
})
```

## Hot Module Replacement

The plugin supports HMR out of the box. When you modify a Pact contract:

1. The contract is automatically recompiled
2. TypeScript types are regenerated
3. Your application hot-reloads with the changes
4. No manual restart required!

```typescript
// This will auto-reload when todos.pact changes
import { todos } from './contracts/todos.pact'

// Your app stays in sync with contract changes
```

## Error Handling

The plugin provides detailed error messages for common issues:

```typescript
// Contract syntax error
❌ Error in contracts/invalid.pact:5:10
   Expected ')', found ','
   
// Type generation error  
❌ Failed to generate types for contracts/complex.pact
   Unsupported type: custom-guard-type
   
// Import error
❌ Cannot find module './contracts/missing.pact'
   Make sure the file exists and matches your include patterns
```

## Performance Optimization

### Caching

The plugin automatically caches:
- Parsed Pact ASTs
- Generated TypeScript code
- Transformation results

### Parallel Processing

Multiple contracts are processed in parallel using Rust's threading capabilities.

### Incremental Builds

Only changed files are reprocessed during watch mode.

## Migration Guide

### From Manual Contract Loading

```typescript
// Before
const response = await fetch('/contracts/todos.pact')
const contractCode = await response.text()
const client = new PactClient()
await client.eval(contractCode)

// After
import { todos } from './contracts/todos.pact'
// Ready to use with types!
```

### From @kadena/pactjs-cli

```typescript
// Before - Manual type generation
pactjs contract-generate --file ./contracts/todos.pact

// After - Automatic with HMR
// Just configure the plugin and import!
```

## Troubleshooting

### Common Issues

**Plugin not transforming .pact files**

Make sure your bundler is configured to handle `.pact` extensions:

```typescript
// vite.config.ts
export default {
  resolve: {
    extensions: ['.ts', '.js', '.pact']
  }
}
```

**Types not generating**

Check that:
1. The `outputDir` is included in your TypeScript config
2. The Pact files match your `include` patterns
3. There are no syntax errors in your contracts

**HMR not working**

Ensure:
1. `hmr: true` is set (default in development)
2. Your bundler supports HMR
3. You're running in development mode

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
pactPlugin({
  debug: true, // Enables detailed logging
  logLevel: 'verbose' // 'error' | 'warn' | 'info' | 'verbose'
})
```

## API Reference

### Plugin Exports

- `unplugin/vite` - Vite plugin
- `unplugin/webpack` - Webpack plugin
- `unplugin/rollup` - Rollup plugin
- `unplugin/esbuild` - esbuild plugin
- `unplugin/next` - Next.js plugin
- `unplugin/nuxt` - Nuxt module
- `unplugin/rspack` - Rspack plugin
- `unplugin/rsbuild` - Rsbuild plugin
- `unplugin/farm` - Farm plugin
- `unplugin/jest` - Jest transformer

### Type Exports

```typescript
import type {
  PactPluginOptions,
  TransformOptions,
  TransformResult,
  PactContract
} from '@pact-toolbox/unplugin'
```

## Best Practices

1. **Organize Contracts** - Keep contracts in a dedicated directory
2. **Use TypeScript** - Leverage generated types for safety
3. **Enable HMR** - For faster development cycles
4. **Configure Output** - Place generated files in a git-ignored directory
5. **Framework Integration** - Use framework-specific transforms when applicable