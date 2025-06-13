# @pact-toolbox/script

> Scriptable runtime environment for Pact smart contract automation

## Overview

The `@pact-toolbox/script` package provides a powerful scripting framework for automating Pact smart contract operations. It enables developers to write reusable scripts for deployment, testing, contract interaction, and complex workflows with full TypeScript support and automatic network management.

## Installation

```bash
npm install @pact-toolbox/script
# or
pnpm add @pact-toolbox/script
```

## Features

- =Ý **TypeScript Support** - Write scripts in TypeScript with automatic compilation
- = **Auto Network Management** - Automatically start/stop networks for script execution
- = **Rich Context API** - Access client, logger, config, and utilities
- =€ **CLI Integration** - Run scripts directly from the command line
- =æ **Module Support** - Works with ESM, CJS, and TypeScript modules
- =à **Development Tools** - Hot-reloading, debugging, and error handling
- <¯ **Flexible Resolution** - Find scripts in multiple locations automatically

## Quick Start

### Creating a Script

Create a new script file (e.g., `deploy.ts`):

```typescript
import { createScript } from '@pact-toolbox/script';

export default createScript({
  // Script configuration
  name: 'deploy-contracts',
  description: 'Deploy all project contracts',
  network: 'devnet',
  autoStartNetwork: true,
  
  // Main script function
  async run({ client, logger, config, args }) {
    logger.info('Starting contract deployment...');
    
    // Deploy contracts
    const contracts = ['coin.pact', 'exchange.pact'];
    
    for (const contract of contracts) {
      logger.info(`Deploying ${contract}...`);
      const result = await client.deployContract(`./contracts/${contract}`);
      
      if (result.status === 'success') {
        logger.success(` ${contract} deployed successfully`);
      } else {
        logger.error(` Failed to deploy ${contract}`);
        throw new Error(result.error);
      }
    }
    
    logger.success('All contracts deployed!');
  }
});
```

### Running Scripts

```bash
# Run a local script
pact-toolbox run deploy

# Run with specific network
pact-toolbox run deploy --network testnet

# Run from npm package
pact-toolbox run @myorg/pact-scripts/deploy

# Pass arguments to script
pact-toolbox run deploy --arg1 value1 --arg2 value2

# Skip auto network start
pact-toolbox run deploy --no-auto-start
```

## Script API

### `createScript(options)`

Creates a script definition with configuration and run function.

```typescript
interface ScriptOptions {
  // Script metadata
  name?: string;              // Script name for identification
  description?: string;       // Description shown in help
  
  // Network configuration
  network?: string;          // Default network to use
  autoStartNetwork?: boolean; // Auto-start network if not running
  
  // The main script function
  run: (context: ScriptContext) => Promise<void>;
}
```

### Script Context

The context object passed to your script's run function:

```typescript
interface ScriptContext {
  // Pact client for blockchain interaction
  client: PactToolboxClient;
  
  // Logger for formatted output
  logger: Logger;
  
  // Resolved configuration
  config: PactToolboxConfig;
  
  // Command line arguments
  args: Record<string, any>;
  
  // Script metadata
  scriptName: string;
  scriptPath: string;
  
  // Utility functions
  utils: {
    delay: (ms: number) => Promise<void>;
    retry: <T>(fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;
    confirm: (message: string) => Promise<boolean>;
  };
}
```

## Common Script Patterns

### Deployment Script

```typescript
export default createScript({
  name: 'deploy',
  description: 'Deploy and initialize contracts',
  autoStartNetwork: true,
  
  async run({ client, logger, config }) {
    // Check if already deployed
    const isDeployed = await client.isContractDeployed('my-module');
    if (isDeployed) {
      logger.warn('Contract already deployed, skipping...');
      return;
    }
    
    // Deploy contract
    logger.info('Deploying contract...');
    const deployResult = await client.deployContract(
      './contracts/my-module.pact'
    );
    
    if (deployResult.status !== 'success') {
      throw new Error(`Deployment failed: ${deployResult.error}`);
    }
    
    // Initialize contract
    logger.info('Initializing contract...');
    const initResult = await client.execute('(my-module.init)');
    
    if (initResult.status === 'success') {
      logger.success('Contract deployed and initialized!');
    }
  }
});
```

### Testing Script

```typescript
export default createScript({
  name: 'test-integration',
  description: 'Run integration tests',
  
  async run({ client, logger, utils }) {
    logger.info('Running integration tests...');
    
    const tests = [
      {
        name: 'Create Account',
        test: async () => {
          const result = await client.execute(
            '(coin.create-account "test-account" (read-keyset "ks"))',
            { data: { ks: { keys: ['test-key'], pred: 'keys-all' } } }
          );
          return result.status === 'success';
        }
      },
      {
        name: 'Transfer Tokens',
        test: async () => {
          const result = await client.execute(
            '(coin.transfer "alice" "bob" 10.0)'
          );
          return result.status === 'success';
        }
      }
    ];
    
    let passed = 0;
    for (const { name, test } of tests) {
      try {
        const success = await utils.retry(test, { 
          retries: 3, 
          delay: 1000 
        });
        
        if (success) {
          logger.success(` ${name}`);
          passed++;
        } else {
          logger.error(` ${name}`);
        }
      } catch (error) {
        logger.error(` ${name}: ${error.message}`);
      }
    }
    
    logger.info(`Tests: ${passed}/${tests.length} passed`);
  }
});
```

### Data Migration Script

```typescript
export default createScript({
  name: 'migrate-data',
  description: 'Migrate data between contract versions',
  
  async run({ client, logger, args, utils }) {
    const batchSize = args.batchSize || 100;
    const dryRun = args.dryRun || false;
    
    logger.info(`Starting migration (batch size: ${batchSize})...`);
    
    // Get all accounts
    const accounts = await client.execute('(my-module.get-all-accounts)');
    if (accounts.status !== 'success') {
      throw new Error('Failed to fetch accounts');
    }
    
    const accountList = accounts.data;
    logger.info(`Found ${accountList.length} accounts to migrate`);
    
    // Process in batches
    for (let i = 0; i < accountList.length; i += batchSize) {
      const batch = accountList.slice(i, i + batchSize);
      logger.info(`Processing batch ${i / batchSize + 1}...`);
      
      if (!dryRun) {
        const result = await client.execute(
          `(my-module.migrate-batch ${JSON.stringify(batch)})`
        );
        
        if (result.status !== 'success') {
          const shouldContinue = await utils.confirm(
            'Batch failed. Continue with next batch?'
          );
          if (!shouldContinue) break;
        }
      }
      
      // Progress update
      const progress = Math.round((i + batch.length) / accountList.length * 100);
      logger.info(`Progress: ${progress}%`);
    }
    
    logger.success('Migration completed!');
  }
});
```

### Network Monitoring Script

```typescript
export default createScript({
  name: 'monitor',
  description: 'Monitor network and contract activity',
  
  async run({ client, logger, utils }) {
    logger.info('Starting network monitor...');
    
    const checkInterval = 5000; // 5 seconds
    let lastBlockHeight = 0;
    
    while (true) {
      try {
        // Check network health
        const health = await client.local('(+ 1 1)');
        if (health.result.status !== 'success') {
          logger.error('Network health check failed');
        }
        
        // Get current block height
        const blockInfo = await client.execute('(at "block-height" (chain-data))');
        if (blockInfo.status === 'success') {
          const currentHeight = blockInfo.data;
          if (currentHeight > lastBlockHeight) {
            logger.info(`New block: ${currentHeight} (+${currentHeight - lastBlockHeight})`);
            lastBlockHeight = currentHeight;
          }
        }
        
        // Check contract status
        const modules = await client.listModules();
        logger.info(`Active modules: ${modules.length}`);
        
        // Wait before next check
        await utils.delay(checkInterval);
        
      } catch (error) {
        logger.error(`Monitor error: ${error.message}`);
        await utils.delay(checkInterval);
      }
    }
  }
});
```

## Advanced Features

### Script Composition

```typescript
// shared/utils.ts
export async function setupTestAccounts(client: PactToolboxClient) {
  const accounts = ['alice', 'bob', 'charlie'];
  for (const account of accounts) {
    await client.execute(
      `(coin.create-account "${account}" (read-keyset "${account}-ks"))`,
      { data: { [`${account}-ks`]: { keys: [`${account}-key`], pred: 'keys-all' } } }
    );
  }
}

// scripts/setup.ts
import { setupTestAccounts } from '../shared/utils';

export default createScript({
  name: 'setup',
  async run({ client, logger }) {
    logger.info('Setting up test environment...');
    await setupTestAccounts(client);
    logger.success('Test accounts created!');
  }
});
```

### Error Handling

```typescript
export default createScript({
  name: 'robust-deploy',
  
  async run({ client, logger, utils }) {
    try {
      // Attempt deployment
      const result = await client.deployContract('./contract.pact');
      
      if (result.status !== 'success') {
        // Detailed error handling
        if (result.error.includes('already exists')) {
          logger.warn('Contract already deployed');
          return;
        }
        
        if (result.error.includes('syntax error')) {
          logger.error('Contract has syntax errors:');
          logger.error(result.error);
          process.exit(1);
        }
        
        // Retry logic for transient errors
        logger.warn('Deployment failed, retrying...');
        await utils.retry(
          () => client.deployContract('./contract.pact'),
          { retries: 3, delay: 2000 }
        );
      }
      
    } catch (error) {
      logger.error('Fatal error:', error);
      
      // Cleanup on error
      if (await utils.confirm('Attempt cleanup?')) {
        await cleanup(client, logger);
      }
      
      throw error;
    }
  }
});
```

### Interactive Scripts

```typescript
import { prompt } from 'enquirer';

export default createScript({
  name: 'interactive-deploy',
  
  async run({ client, logger, utils }) {
    // Get user input
    const { contractPath } = await prompt({
      type: 'input',
      name: 'contractPath',
      message: 'Enter contract path:',
      initial: './contracts/'
    });
    
    const { network } = await prompt({
      type: 'select',
      name: 'network',
      message: 'Select network:',
      choices: ['local', 'testnet', 'mainnet']
    });
    
    // Confirmation
    const shouldDeploy = await utils.confirm(
      `Deploy ${contractPath} to ${network}?`
    );
    
    if (!shouldDeploy) {
      logger.info('Deployment cancelled');
      return;
    }
    
    // Execute deployment
    logger.info(`Deploying to ${network}...`);
    const result = await client.deployContract(contractPath);
    
    if (result.status === 'success') {
      logger.success('Deployment successful!');
    }
  }
});
```

## Script Organization

### Recommended Structure

```
project/
   scripts/
      deploy.ts         # Deployment scripts
      test.ts          # Testing scripts
      migrate.ts       # Migration scripts
      utils/          # Shared utilities
          accounts.ts
          helpers.ts
   contracts/
   pact-toolbox.config.ts
```

### Script Discovery

Scripts are resolved in the following order:

1. `scripts/` directory
2. Project root
3. `.scripts/` directory
4. Node modules (for packaged scripts)

## Configuration

### Script-Level Config

```typescript
export default createScript({
  // Override configuration for this script
  config: {
    network: {
      type: 'devnet',
      devnet: {
        containerConfig: {
          port: 8080,
          onDemandMining: true
        }
      }
    }
  },
  
  async run({ client, logger }) {
    // Script uses overridden config
  }
});
```

### Environment Variables

```typescript
export default createScript({
  async run({ client, logger }) {
    // Access environment variables
    const apiKey = process.env.API_KEY;
    const debug = process.env.DEBUG === 'true';
    
    if (debug) {
      logger.debug('Debug mode enabled');
    }
  }
});
```

## Testing Scripts

```typescript
// scripts/deploy.test.ts
import { describe, test, expect } from 'vitest';
import deployScript from './deploy';

describe('Deploy Script', () => {
  test('deploys contracts successfully', async () => {
    const mockContext = {
      client: {
        deployContract: vi.fn().mockResolvedValue({ status: 'success' })
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn()
      },
      config: {},
      args: {}
    };
    
    await deployScript.run(mockContext);
    
    expect(mockContext.client.deployContract).toHaveBeenCalled();
    expect(mockContext.logger.success).toHaveBeenCalled();
  });
});
```

## Best Practices

### 1. Idempotent Scripts

```typescript
// Make scripts safe to run multiple times
export default createScript({
  async run({ client, logger }) {
    // Check current state
    const isDeployed = await client.isContractDeployed('my-module');
    
    if (isDeployed) {
      logger.info('Contract already deployed, checking version...');
      const version = await client.execute('(my-module.get-version)');
      logger.info(`Current version: ${version.data}`);
      return;
    }
    
    // Proceed with deployment
    await client.deployContract('./my-module.pact');
  }
});
```

### 2. Proper Logging

```typescript
export default createScript({
  async run({ client, logger }) {
    logger.debug('Starting detailed operation...');
    logger.info('Processing accounts...');
    logger.warn('Large batch size may be slow');
    logger.error('Failed to process account');
    logger.success(' Operation completed');
  }
});
```

### 3. Resource Cleanup

```typescript
export default createScript({
  async run({ client, logger }) {
    let cleanup = false;
    
    try {
      // Create temporary resources
      await client.execute('(my-module.create-temp-data)');
      cleanup = true;
      
      // Do work
      await processData(client);
      
    } finally {
      // Always cleanup
      if (cleanup) {
        await client.execute('(my-module.cleanup-temp-data)');
      }
    }
  }
});
```

## Troubleshooting

### Common Issues

1. **"Script not found"**
   - Check script location (scripts/, project root, .scripts/)
   - Verify file extension (.ts, .js, .mjs, .cjs)
   - Ensure script exports default

2. **"Network connection failed"**
   - Verify network is running
   - Check network configuration
   - Use `--auto-start` flag

3. **"TypeScript errors"**
   - Ensure @types are installed
   - Check tsconfig.json configuration
   - Verify import paths

4. **"Module not found"**
   - Install missing dependencies
   - Check NODE_PATH environment
   - Verify package.json exports