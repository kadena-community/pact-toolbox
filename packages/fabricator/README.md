# @pact-toolbox/fabricator

> Smart contract code generation and templating for Pact development

## Overview

The `@pact-toolbox/fabricator` package provides a template-based code generation system for Pact smart contracts. It helps developers quickly scaffold new contracts with best practices, common patterns, and consistent structure built-in.

## Installation

```bash
npm install @pact-toolbox/fabricator
# or
pnpm add @pact-toolbox/fabricator
```

## Features

- =Ý **Template-Based Generation** - Create contracts from well-tested templates
- <× **Common Patterns** - Built-in support for modules, gas stations, and tokens
- =' **Customizable** - Configure generated code through context parameters
- =á **Best Practices** - Templates include governance, upgrade patterns, and security
- <¯ **Type Safety** - Full TypeScript support with typed context objects
- ¡ **CLI Integration** - Generate contracts directly from the command line
- >é **Extensible** - Easy to add custom templates and generators

## Quick Start

### Using the CLI

```bash
# Generate a basic Pact module
pact-toolbox generate module my-token

# Generate a gas station contract
pact-toolbox generate station my-gas-station

# Specify custom options
pact-toolbox generate module my-token --namespace free --admin-keyset admin-ks
```

### Programmatic Usage

```typescript
import { 
  generateModule, 
  generateGasStation,
  generateFungible 
} from '@pact-toolbox/fabricator';

// Generate a basic module
const moduleCode = generateModule({
  name: 'my-token',
  namespace: 'free',
  adminKeyset: 'token-admin'
});

// Generate a gas station
const gasStationCode = generateGasStation({
  name: 'token-gas-station',
  namespace: 'free',
  adminKeyset: 'admin-keyset',
  account: 'k:1234567890abcdef...',
  module: 'my-token'
});

// Write to file
await fs.writeFile('./contracts/my-token.pact', moduleCode);
```

## Available Generators

### Module Generator

Creates a basic Pact module with governance and upgrade support.

```typescript
generateModule(context: ModuleContext): string

interface ModuleContext {
  name: string;           // Module name
  namespace?: string;     // Namespace (default: 'free')
  adminKeyset?: string;   // Admin keyset name (default: 'admin-keyset')
}
```

**Generated Features:**
- Namespace declaration
- Module definition with admin keyset
- Governance capability
- Upgrade function
- Sample function template

**Example Output:**
```pact
(namespace "free")

(module my-token admin-keyset
  (defcap GOVERNANCE ()
    (enforce-keyset admin-keyset))
  
  (defun upgrade ()
    (if (read-msg "upgrade")
      (capabilities.install)
      []))
  
  (defun my-function ()
    "A sample function"
    true)
)
```

### Gas Station Generator

Creates a gas station contract for subsidizing transaction costs.

```typescript
generateGasStation(context: GasStationContext): string

interface GasStationContext {
  name: string;           // Gas station module name
  namespace?: string;     // Namespace (default: 'free')
  adminKeyset?: string;   // Admin keyset (default: 'admin-keyset')
  account: string;        // Gas payer account (k:address format)
  module: string;         // Module to subsidize gas for
}
```

**Generated Features:**
- Implements `gas-payer-v1` interface
- Enforces maximum gas price
- Restricts gas payment to specific modules
- Creates accounts with gas payer guard
- Admin governance

**Example Usage:**
```typescript
const gasStation = generateGasStation({
  name: 'dex-gas-station',
  namespace: 'free',
  adminKeyset: 'dex-admin',
  account: 'k:abc123...',
  module: 'dex'
});
```

### Fungible Token Generator

Creates a fungible token module (currently similar to gas station).

```typescript
generateFungible(context: FungibleContext): string

interface FungibleContext {
  name: string;           // Token module name
  namespace?: string;     // Namespace
  adminKeyset?: string;   // Admin keyset
  // Additional token-specific fields (future enhancement)
}
```

## Template System

### How Templates Work

The fabricator uses a simple yet powerful template system:

1. **Placeholders**: Templates contain `{{placeholder}}` markers
2. **Context**: You provide values for placeholders via context objects
3. **Validation**: Missing placeholders throw errors
4. **Type Safety**: TypeScript ensures correct context shape

### Custom Templates

You can create custom generators using the template utilities:

```typescript
import { fillTemplatePlaceholders } from '@pact-toolbox/fabricator';

const nftTemplate = `
(namespace "{{namespace}}")

(module {{name}} {{adminKeyset}}
  
  (implements fungible-v2)
  (implements non-fungible-v1)
  
  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}}))
  
  (defschema nft-schema
    id: string
    owner: string
    metadata: object)
  
  (deftable nfts:{nft-schema})
  
  {{#if marketplace}}
  (defun list-for-sale (id:string price:decimal)
    "List NFT for sale"
    ; Implementation
  )
  {{/if}}
)
`;

function generateNFT(context: NFTContext): string {
  return fillTemplatePlaceholders(nftTemplate, context);
}

// Usage
const nftCode = generateNFT({
  name: 'my-nft-collection',
  namespace: 'free',
  adminKeyset: 'nft-admin',
  marketplace: true
});
```

## Advanced Usage

### Composing Generators

```typescript
import { generateModule, generateGasStation } from '@pact-toolbox/fabricator';

async function generateDeFiProtocol(config: DeFiConfig) {
  const contracts = [];
  
  // Generate core module
  contracts.push({
    name: 'defi-core.pact',
    code: generateModule({
      name: `${config.prefix}-core`,
      namespace: config.namespace,
      adminKeyset: config.adminKeyset
    })
  });
  
  // Generate token modules
  for (const token of config.tokens) {
    contracts.push({
      name: `${token.symbol}.pact`,
      code: generateModule({
        name: `${config.prefix}-${token.symbol}`,
        namespace: config.namespace,
        adminKeyset: config.adminKeyset
      })
    });
  }
  
  // Generate gas station
  contracts.push({
    name: 'gas-station.pact',
    code: generateGasStation({
      name: `${config.prefix}-gas`,
      namespace: config.namespace,
      adminKeyset: config.adminKeyset,
      account: config.gasPayerAccount,
      module: `${config.prefix}-core`
    })
  });
  
  return contracts;
}
```

### Integration with Build Tools

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { generateModule } from '@pact-toolbox/fabricator';

export default defineConfig({
  plugins: [
    {
      name: 'pact-generator',
      buildStart() {
        // Generate contracts at build time
        const contracts = [
          { name: 'token', namespace: 'free' },
          { name: 'exchange', namespace: 'free' }
        ];
        
        contracts.forEach(config => {
          const code = generateModule(config);
          this.emitFile({
            type: 'asset',
            fileName: `contracts/${config.name}.pact`,
            source: code
          });
        });
      }
    }
  ]
});
```

### Dynamic Template Generation

```typescript
function generateMultiSigModule(signers: string[]): string {
  const template = `
(module multisig GOVERNANCE
  
  (defcap GOVERNANCE ()
    (enforce-keyset "multisig-admin"))
  
  (defschema proposal
    id: string
    description: string
    signatures: [string]
    executed: bool)
  
  (deftable proposals:{proposal})
  
  {{#each signers}}
  (defcap SIGNER_{{@index}} ()
    (enforce-keyset "{{this}}"))
  {{/each}}
  
  (defun propose (description:string)
    ; Implementation
  )
  
  (defun sign (proposal-id:string)
    (with-capability (SIGNER_{{signerIndex}})
      ; Implementation
    ))
  
  (defun execute (proposal-id:string)
    (enforce (>= (length signatures) {{threshold}})
      "Insufficient signatures")
    ; Implementation
  )
)`;

  return fillTemplatePlaceholders(template, {
    signers,
    threshold: Math.ceil(signers.length * 0.6)
  });
}
```

## CLI Usage

### Generate Commands

```bash
# Basic module generation
pact-toolbox generate module <name> [options]

Options:
  --namespace, -n      Namespace for the module [default: "free"]
  --admin-keyset, -a   Admin keyset name [default: "admin-keyset"]
  --output, -o         Output file path [default: ./contracts/<name>.pact]

# Gas station generation
pact-toolbox generate station <name> [options]

Options:
  --namespace, -n      Namespace for the gas station
  --admin-keyset, -a   Admin keyset name
  --account, -k        Gas payer account (k:address format) [required]
  --module, -m         Module to subsidize gas for [required]
  --output, -o         Output file path
```

### Examples

```bash
# Generate a token module
pact-toolbox generate module my-token \
  --namespace token-ns \
  --admin-keyset token-admin \
  --output ./contracts/tokens/my-token.pact

# Generate a gas station for the token
pact-toolbox generate station token-gas \
  --namespace token-ns \
  --account k:1234567890abcdef... \
  --module my-token \
  --output ./contracts/gas/token-gas.pact

# Generate with defaults
pact-toolbox generate module simple-module
```

## Best Practices

### 1. Namespace Organization

```typescript
// Group related contracts in the same namespace
const contracts = ['dex-core', 'dex-token', 'dex-pool'].map(name =>
  generateModule({
    name,
    namespace: 'dex',  // Common namespace
    adminKeyset: 'dex-governance'
  })
);
```

### 2. Consistent Naming

```typescript
// Use prefixes for related modules
const projectPrefix = 'myapp';

function generateProjectModule(name: string) {
  return generateModule({
    name: `${projectPrefix}-${name}`,
    namespace: projectPrefix,
    adminKeyset: `${projectPrefix}-admin`
  });
}
```

### 3. Template Validation

```typescript
// Validate context before generation
function validateAndGenerate(context: ModuleContext): string {
  // Validate module name
  if (!/^[a-z][a-z0-9-]*$/.test(context.name)) {
    throw new Error('Invalid module name format');
  }
  
  // Validate namespace
  if (context.namespace && !/^[a-z][a-z0-9-]*$/.test(context.namespace)) {
    throw new Error('Invalid namespace format');
  }
  
  return generateModule(context);
}
```

### 4. Post-Generation Processing

```typescript
import { format } from '@pact-toolbox/utils';

async function generateAndFormat(context: ModuleContext): Promise<string> {
  // Generate code
  let code = generateModule(context);
  
  // Add custom headers
  code = `;;
;; ${context.name} - Generated by pact-toolbox
;; Generated: ${new Date().toISOString()}
;;

${code}`;
  
  // Format code
  code = await format(code);
  
  return code;
}
```

## Extending Fabricator

### Creating Custom Generators

```typescript
// my-generators.ts
export interface CustomModuleContext {
  name: string;
  features: {
    pausable?: boolean;
    upgradeable?: boolean;
    mintable?: boolean;
    burnable?: boolean;
  };
}

export function generateCustomModule(context: CustomModuleContext): string {
  const template = `
(module {{name}} GOVERNANCE
  
  {{#if features.pausable}}
  (defschema pause-schema
    paused: bool)
  
  (deftable pause-status:{pause-schema})
  
  (defun pause ()
    (with-capability (GOVERNANCE)
      (write pause-status "status" { "paused": true })))
  {{/if}}
  
  {{#if features.mintable}}
  (defcap MINT (account:string amount:decimal)
    (with-capability (GOVERNANCE)
      true))
  
  (defun mint (account:string amount:decimal)
    (with-capability (MINT account amount)
      ; Implementation
    ))
  {{/if}}
  
  ; More features...
)`;

  return fillTemplatePlaceholders(template, context);
}
```

### Generator Registry

```typescript
// generator-registry.ts
export class GeneratorRegistry {
  private generators = new Map<string, GeneratorFunction>();
  
  register(name: string, generator: GeneratorFunction) {
    this.generators.set(name, generator);
  }
  
  generate(name: string, context: any): string {
    const generator = this.generators.get(name);
    if (!generator) {
      throw new Error(`Unknown generator: ${name}`);
    }
    return generator(context);
  }
  
  list(): string[] {
    return Array.from(this.generators.keys());
  }
}

// Usage
const registry = new GeneratorRegistry();
registry.register('module', generateModule);
registry.register('gas-station', generateGasStation);
registry.register('custom', generateCustomModule);

const code = registry.generate('custom', { 
  name: 'my-module',
  features: { pausable: true }
});
```

## Troubleshooting

### Common Issues

1. **"Missing placeholder" errors**
   - Ensure all template placeholders have values in context
   - Check for typos in placeholder names
   - Use optional chaining for conditional placeholders

2. **Invalid Pact syntax in generated code**
   - Validate input values (names, keysets)
   - Ensure proper escaping of special characters
   - Test generated code with Pact compiler

3. **Template not found**
   - Check import paths
   - Ensure template string is properly defined
   - Verify generator function is exported

4. **CLI generation fails**
   - Check required options are provided
   - Verify output directory exists
   - Ensure proper file permissions