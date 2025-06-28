# @pact-toolbox/script

> Powerful, flexible deployment and automation script runner for Pact smart contracts

## Overview

The `@pact-toolbox/script` package provides a comprehensive framework for creating, deploying, and managing Pact smart contracts with advanced features like:

- **Flexible Signing** - Support for CLI args, environment variables, and wallet integration
- **Principal Namespace Handling** - Automatic detection and creation of principal namespaces
- **Rich Context** - Pre-configured KDA services and utilities
- **Multi-chain Deployment** - Deploy to specific chains or all 20 chains
- **Dependency Management** - Automatic contract dependency resolution
- **Network Integration** - Seamless integration with devnet, testnet, and mainnet

## Installation

```bash
npm install @pact-toolbox/script
# or
pnpm add @pact-toolbox/script
```

## Quick Start

### Creating a Simple Deployment Script

```typescript
// scripts/deploy-token.ts
import { createScript } from '@pact-toolbox/script';

export default createScript({
  metadata: {
    name: 'Deploy Token',
    description: 'Deploy a token contract with namespace handling',
    version: '1.0.0'
  },

  autoStartNetwork: true,
  network: 'development',
  
  namespaceHandling: {
    autoCreate: true,
    interactive: false
  },

  signing: {
    privateKeyEnv: 'DEPLOY_PRIVATE_KEY',
    accountEnv: 'DEPLOY_ACCOUNT'
  },

  async run({ deploy, logger, currentSigner, generateNamespace, pact }) {
    logger.info('🚀 Starting token deployment');

    // Generate namespace for current signer
    const signerKeyset = pact.createSingleKeyKeyset(currentSigner.publicKey);
    const namespaceName = generateNamespace(signerKeyset);
    
    logger.info(`🏷️ Generated namespace: ${namespaceName}`);

    // Deploy token contract
    const result = await deploy(`${namespaceName}.token`, {
      gasLimit: 200000,
      validate: true,
      namespaceHandling: {
        autoCreate: true,
        adminKeyset: signerKeyset
      },
      initData: {
        'admin-keyset': signerKeyset,
        'token-name': 'MyToken',
        'token-symbol': 'MTK'
      }
    });

    logger.success(`✅ Token deployed: ${result.contractName}`);
    return result;
  }
});
```

### Running Scripts

```bash
# Using environment variables
DEPLOY_PRIVATE_KEY=your-key pact-toolbox run deploy-token

# Using CLI arguments
pact-toolbox run deploy-token --private-key your-key --account your-account

# Interactive mode
pact-toolbox run deploy-token --interactive
```

## Enhanced Features

### Flexible Signing

The script package supports multiple signing methods:

```typescript
export default createScript({
  signing: {
    // From environment variables
    privateKeyEnv: 'DEPLOY_PRIVATE_KEY',
    accountEnv: 'DEPLOY_ACCOUNT',
    
    // Direct private key (not recommended for production)
    privateKey: 'your-private-key',
    account: 'your-account',
    
    // Interactive TUI
    interactive: true,
    
    // Desktop wallet integration (future)
    walletType: 'ecko' // 'zelcore', 'chainweaver', 'walletconnect'
  },
  
  async run({ currentSigner, switchAccount }) {
    // Current signer is automatically available
    console.log(`Deploying as: ${currentSigner.account}`);
    
    // Switch to different account if needed
    await switchAccount('other-account');
  }
});
```

### Principal Namespace Handling

Automatically detect and create principal namespaces:

```typescript
export default createScript({
  namespaceHandling: {
    autoCreate: true,          // Auto-create namespaces if needed
    interactive: false,        // Don't prompt user
    chainId: "0"              // Target chain
  },

  async run({ namespaceHandler, generateNamespace, pact }) {
    // Generate namespace for any keyset
    const keyset = pact.createSingleKeyKeyset('your-public-key');
    const namespace = generateNamespace(keyset);
    
    // Analyze contract for namespace requirements
    const analysis = await namespaceHandler.analyzeContract(`
      (module ${namespace}.token GOVERNANCE
        ; Contract code here
      )
    `);
    
    if (analysis.hasNamespace) {
      console.log(`Contract uses namespace: ${analysis.namespaceName}`);
    }
  }
});
```

### Script Context

Access pre-configured services and utilities:

```typescript
export default createScript({
  async run({
    // Core components
    client, config, network, chainId, currentSigner,
    
    // KDA Services (pre-configured)
    coinService, marmaladeService, namespaceService,
    
    // Enhanced utilities
    deployments, interactions,
    
    // Pact utilities
    pact,
    
    // Convenience methods
    deploy, call, send,
    getBalance, transfer, createAccount,
    createToken, mintToken, transferToken,
    createNamespace, generateNamespace,
    
    // Wallet operations
    switchAccount, addCapability, clearCapabilities,
    
    // Utility methods
    sleep, retry, formatTime, parseTime,
    validateAccount, validatePublicKey,
    
    // Transaction helpers
    withSigner, withCapabilities, waitForTransaction, estimateGas
  }) {
    // Use any of these directly without setup
    const balance = await getBalance('sender00');
    await transfer('sender00', 'k:receiver', '10.0');
    
    // Or use services directly
    const coinBalance = await coinService.getBalance('sender00');
    
    // Utility functions
    await sleep(1000);
    const result = await retry(() => someOperation(), 3, 2000);
  }
});
```

### Transaction Validation

Built-in validation and error handling:

```typescript
export default createScript({
  async run({ send, interactions }) {
    // Enhanced send with validation
    const result = await send('my-contract', 'my-function', ['arg1', 'arg2'], {
      gasLimit: 50000,
      gasPrice: 0.00001,
      
      // Validation options
      dryRun: true,           // Simulate before sending
      autoRetry: true,        // Retry on failure
      maxRetries: 3,
      
      // Gas optimization
      gasPriceStrategy: 'auto',
      
      // Transaction metadata
      metadata: {
        purpose: 'Contract interaction'
      }
    });
    
    // Enhanced interactions with caching
    const cachedResult = await interactions.call('contract', 'function', [], {
      cache: true,
      cacheTtl: 300000, // 5 minutes
      
      // Result formatting
      formatter: (result) => parseFloat(result),
      
      // Result validation
      validator: (result) => result > 0
    });
  }
});
```

### Testing Framework

Comprehensive testing utilities:

```typescript
// scripts/test-token.ts
import { createScript } from '@pact-toolbox/script';

export default createScript({
  async run({ testing }) {
    const testSuite = createTestSuite({
      name: 'Token Contract Tests',
      
      scenarios: [
        createTestScenario({
          name: 'Deploy and mint token',
          async test(context, expect) {
            // Deploy contract
            const deployment = await context.deploy('my-token');
            expect.contractToBeDeployed('my-token');
            
            // Test minting
            const result = await context.send('my-token', 'mint', ['recipient', 100]);
            expect.transactionToSucceed(result);
            
            // Check balance
            const balance = await context.call('my-token', 'get-balance', ['recipient']);
            expect.toEqual(balance, 100);
          }
        }),
        
        createTestScenario({
          name: 'Transfer tokens',
          async test(context, expect) {
            // Test transfer
            const result = await context.send('my-token', 'transfer', ['sender', 'receiver', 50]);
            expect.transactionToSucceed(result);
            
            // Verify balances
            await expect.toHaveBalance('receiver', '50');
          }
        })
      ]
    });
    
    // Run tests
    const report = await testing.runSuite(testSuite);
    
    console.log(`Tests: ${report.summary.passed}/${report.summary.totalTests} passed`);
    return report;
  }
});
```

## Quick Start Example

### Simple Deployment Script

```typescript
// scripts/deploy.ts
import { createScript } from '@pact-toolbox/script';

export default createScript({
  metadata: {
    name: 'deploy-contract',
    description: 'Deploy a simple contract',
  },

  async run(ctx) {
    const { logger, deployments } = ctx;
    
    logger.info('🚀 Deploying contract...');
    
    const result = await deployments.deploy('my-contract', {
      gasLimit: 10000,
      gasPrice: 0.00001,
      skipIfAlreadyDeployed: true,
    });
    
    logger.success(`✅ Contract deployed: ${result.transactionHash}`);
    return result;
  }
});
```

### Running the Script

```bash
# Run on local development network
pact-toolbox run scripts/deploy.ts

# Run on testnet
pact-toolbox run scripts/deploy.ts --network testnet

# With specific account
pact-toolbox run scripts/deploy.ts --account sender00 --private-key your-key
```

## Advanced Examples

### Multi-Contract Deployment with Dependencies

```typescript
export default createScript({
  async run({ deployments }) {
    // Deploy multiple contracts with dependency resolution
    const results = await deployments.deployMany([
      {
        name: 'base-contract',
        options: { gasLimit: 150000 }
      },
      {
        name: 'dependent-contract',
        options: {
          dependencies: ['base-contract'],
          gasLimit: 200000
        }
      }
    ]);
    
    return results;
  }
});
```

### Cross-Chain Operations

```typescript
export default createScript({
  async run({ coinService, logger }) {
    // Transfer across chains
    const result = await coinService.transferCrosschain({
      from: 'sender00',
      to: 'k:receiver',
      amount: '10.0',
      sourceChainId: '0',
      targetChainId: '1'
    });
    
    logger.success(`Cross-chain transfer initiated: ${result.requestKey}`);
    return result;
  }
});
```

### Contract Migration

```typescript
export default createScript({
  environment: {
    MIGRATION_STRATEGY: 'upgrade' // 'replace', 'upgrade', 'migrate'
  },

  async run({ deploy, deployments, logger }) {
    const strategy = process.env.MIGRATION_STRATEGY;
    
    switch (strategy) {
      case 'upgrade':
        const result = await deployments.upgrade('my-contract', '2.0.0', {
          gasLimit: 300000,
          migrationStrategy: 'upgrade'
        });
        break;
        
      case 'replace':
        await deploy('my-contract', {
          skipIfAlreadyDeployed: false,
          migrationStrategy: 'replace'
        });
        break;
    }
  }
});
```

## Configuration

### Script Configuration

```typescript
export default createScript({
  // Basic options
  autoStartNetwork: true,    // Auto-start devnet/testnet
  persist: false,           // Keep network running after script
  network: 'development',   // Target network
  timeout: 300000,          // Script timeout (5 minutes)
  profile: true,            // Enable performance profiling
  
  // Signing configuration
  signing: {
    privateKeyEnv: 'PRIVATE_KEY',
    accountEnv: 'ACCOUNT',
    interactive: false
  },
  
  // Namespace handling
  namespaceHandling: {
    autoCreate: true,
    interactive: false,
    chainId: "0"
  },
  
  // Environment variables
  environment: {
    TOKEN_NAME: 'MyToken',
    INITIAL_SUPPLY: '1000000'
  },
  
  // Hooks
  hooks: {
    async preRun(context) {
      // Pre-execution setup
    },
    
    async postRun(context, result) {
      // Post-execution cleanup
    },
    
    async onError(context, error) {
      // Error handling
    }
  }
});
```

### Validation Configuration

```typescript
import { createTransactionValidator, CommonValidationRules } from '@pact-toolbox/script';

const validator = createTransactionValidator(client, {
  maxGasLimit: 1000000,
  minGasPrice: 0.000001,
  strict: true,
  
  customRules: [
    CommonValidationRules.deployment(),
    CommonValidationRules.tokenTransfer(1, 1000000),
    CommonValidationRules.namespace(),
    
    // Custom rule
    {
      name: 'custom-validation',
      description: 'Custom validation logic',
      validate: (tx) => ({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      })
    }
  ]
});
```

## CLI Integration

The enhanced script package integrates with the pact-toolbox CLI:

```bash
# List available scripts
pact-toolbox script list

# Run a script with various options
pact-toolbox run deploy-token \
  --network development \
  --private-key $PRIVATE_KEY \
  --account sender00 \
  --gas-limit 200000 \
  --interactive

# Run with environment file
pact-toolbox run deploy-token --env .env.development

# Dry run mode
pact-toolbox run deploy-token --dry-run

# Profile script execution
pact-toolbox run deploy-token --profile
```

## Best Practices

### 1. Environment Management

```typescript
// Use environment-specific configurations
const config = {
  development: {
    network: 'development',
    gasPrice: 0.00001,
    autoStartNetwork: true
  },
  testnet: {
    network: 'testnet',
    gasPrice: 0.00001,
    autoStartNetwork: false
  },
  mainnet: {
    network: 'mainnet',
    gasPrice: 0.00005,
    verify: true
  }
};

export default createScript({
  ...config[process.env.NODE_ENV || 'development'],
  
  async run(context) {
    // Script logic
  }
});
```

### 2. Error Handling

```typescript
export default createScript({
  hooks: {
    async onError(context, error) {
      // Log error details
      context.logger.error('Script failed:', error);
      
      // Send notifications (if configured)
      // await sendAlert(error);
      
      // Cleanup resources
      // await cleanup();
    }
  },

  async run({ retry, logger }) {
    try {
      // Use retry for flaky operations
      const result = await retry(async () => {
        return await someUnreliableOperation();
      }, 3, 5000);
      
      return result;
    } catch (error) {
      logger.error('Operation failed after retries:', error);
      throw error;
    }
  }
});
```

### 3. Testing

```typescript
// Always include tests for your scripts
export default createScript({
  async run({ testing, deploy, call }) {
    // Deploy contract
    await deploy('my-contract');
    
    // Test deployment
    const testSuite = createTestSuite({
      name: 'Deployment Verification',
      scenarios: [
        createTestScenario({
          name: 'Contract is callable',
          async test(context, expect) {
            const result = await context.call('my-contract', 'get-info', []);
            expect.toBeTruthy(result);
          }
        })
      ]
    });
    
    await testing.runSuite(testSuite);
  }
});
```

## Troubleshooting

### Common Issues

1. **Private Key Not Found**
   ```bash
   Error: No signing method configured
   ```
   - Set `PRIVATE_KEY` environment variable
   - Use `--private-key` CLI argument
   - Enable `--interactive` mode

2. **Namespace Already Exists**
   ```bash
   Error: Namespace already exists
   ```
   - Use `forceCreate: true` in namespace options
   - Check if namespace is owned by different keyset

3. **Gas Limit Too Low**
   ```bash
   Error: Transaction failed: gas limit exceeded
   ```
   - Increase `gasLimit` in deployment options
   - Use `estimateGas` to get accurate estimates

4. **Network Connection Issues**
   ```bash
   Error: Network timeout
   ```
   - Check network configuration
   - Ensure Docker is running for local networks
   - Verify internet connection for public networks

### Debug Mode

Enable debug logging:

```bash
DEBUG=1 pact-toolbox run your-script
```

Or in script:

```typescript
export default createScript({
  hooks: {
    async preRun(context) {
      context.logger.level = 'debug';
    }
  }
});
```

## API Reference

See the TypeScript definitions for complete API documentation. Key interfaces:

- `ScriptContext` - The script execution context
- `ScriptOptions` - Script configuration options
- `SigningConfig` - Wallet and signing configuration
- `NamespaceHandlingOptions` - Namespace management options
- `EnhancedDeploymentOptions` - Contract deployment options
- `ValidationConfig` - Transaction validation configuration

## Contributing

When contributing to this package:

1. **Follow Patterns** - Use existing patterns for consistency
2. **Add Tests** - All new functionality must have tests
3. **Update Docs** - Keep README and examples current
4. **Validate Changes** - Test with real contracts and networks

## License

MIT

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)