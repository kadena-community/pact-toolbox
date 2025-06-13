import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createScript,
  runScript,
  loadScript,
  resolveScript,
  ScriptOptions,
  ScriptContext,
  ScriptDefinition
} from './index';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { resolveConfig } from '@pact-toolbox/config';
import path from 'path';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('@pact-toolbox/runtime');
vi.mock('@pact-toolbox/config');
vi.mock('fs/promises');
vi.mock('jiti', () => ({
  default: () => (modulePath: string) => {
    if (modulePath.includes('test-script')) {
      return {
        default: createScript({
          name: 'test-script',
          async run({ logger }) {
            logger.info('Test script executed');
          }
        })
      };
    }
    throw new Error('Module not found');
  }
}));

describe('@pact-toolbox/script', () => {
  let mockClient: PactToolboxClient;
  let mockLogger: any;
  let mockConfig: any;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn().mockResolvedValue({ status: 'success' }),
      deployContract: vi.fn().mockResolvedValue({ status: 'success' }),
      isContractDeployed: vi.fn().mockResolvedValue(false),
      listModules: vi.fn().mockResolvedValue([])
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      debug: vi.fn()
    };

    mockConfig = {
      contractsDir: './contracts',
      scriptsDir: './scripts',
      network: {
        type: 'devnet',
        name: 'local'
      }
    };

    vi.mocked(resolveConfig).mockResolvedValue(mockConfig);
    vi.clearAllMocks();
  });

  describe('createScript', () => {
    test('creates script definition with minimal options', () => {
      const script = createScript({
        async run(context) {
          context.logger.info('Running script');
        }
      });

      expect(script).toBeDefined();
      expect(script.run).toBeInstanceOf(Function);
    });

    test('creates script with full options', () => {
      const script = createScript({
        name: 'deploy-contracts',
        description: 'Deploy all project contracts',
        network: 'testnet',
        autoStartNetwork: true,
        async run(context) {
          context.logger.info('Deploying contracts');
        }
      });

      expect(script.name).toBe('deploy-contracts');
      expect(script.description).toBe('Deploy all project contracts');
      expect(script.network).toBe('testnet');
      expect(script.autoStartNetwork).toBe(true);
    });

    test('script preserves configuration', () => {
      const customConfig = {
        contractsDir: './custom-contracts'
      };

      const script = createScript({
        config: customConfig,
        async run(context) {
          expect(context.config.contractsDir).toBe('./custom-contracts');
        }
      });

      expect(script.config).toEqual(customConfig);
    });
  });

  describe('Script Context', () => {
    test('provides required context properties', async () => {
      let capturedContext: ScriptContext;

      const script = createScript({
        async run(context) {
          capturedContext = context;
        }
      });

      await script.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: { test: true },
        scriptName: 'test-script',
        scriptPath: './test-script.ts',
        utils: {
          delay: vi.fn(),
          retry: vi.fn(),
          confirm: vi.fn()
        }
      } as any);

      expect(capturedContext!.client).toBe(mockClient);
      expect(capturedContext!.logger).toBe(mockLogger);
      expect(capturedContext!.config).toBe(mockConfig);
      expect(capturedContext!.args).toEqual({ test: true });
      expect(capturedContext!.scriptName).toBe('test-script');
      expect(capturedContext!.scriptPath).toBe('./test-script.ts');
      expect(capturedContext!.utils).toBeDefined();
    });

    test('context utilities work correctly', async () => {
      const script = createScript({
        async run({ utils }) {
          // Test delay
          await utils.delay(100);

          // Test retry
          let attempts = 0;
          const result = await utils.retry(async () => {
            attempts++;
            if (attempts < 3) throw new Error('Not yet');
            return 'success';
          }, { retries: 5, delay: 10 });

          expect(result).toBe('success');
          expect(attempts).toBe(3);

          // Test confirm
          const confirmed = await utils.confirm('Continue?');
          expect(typeof confirmed).toBe('boolean');
        }
      });

      const mockUtils = {
        delay: vi.fn().mockResolvedValue(undefined),
        retry: vi.fn().mockImplementation(async (fn, options) => {
          let lastError;
          for (let i = 0; i <= (options?.retries || 3); i++) {
            try {
              return await fn();
            } catch (error) {
              lastError = error;
              if (i < (options?.retries || 3)) {
                await new Promise(r => setTimeout(r, options?.delay || 0));
              }
            }
          }
          throw lastError;
        }),
        confirm: vi.fn().mockResolvedValue(true)
      };

      await script.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {},
        utils: mockUtils
      } as any);

      expect(mockUtils.delay).toHaveBeenCalledWith(100);
      expect(mockUtils.confirm).toHaveBeenCalledWith('Continue?');
    });
  });

  describe('loadScript', () => {
    test('loads script from file', async () => {
      const scriptPath = './scripts/test-script.ts';
      
      const script = await loadScript(scriptPath);

      expect(script).toBeDefined();
      expect(script.name).toBe('test-script');
    });

    test('throws on invalid script file', async () => {
      await expect(loadScript('./invalid-script.ts'))
        .rejects.toThrow('Module not found');
    });

    test('handles missing default export', async () => {
      vi.mocked(require).mockReturnValue({
        // No default export
        someExport: {}
      });

      await expect(loadScript('./no-default.ts'))
        .rejects.toThrow();
    });
  });

  describe('resolveScript', () => {
    beforeEach(() => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
    });

    test('resolves script from scripts directory', async () => {
      const scriptName = 'deploy';
      const expectedPath = path.join(mockConfig.scriptsDir, 'deploy.ts');

      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error()) // package check
        .mockResolvedValueOnce(undefined); // scripts dir check

      const resolved = await resolveScript(scriptName, mockConfig);

      expect(resolved).toBe(expectedPath);
    });

    test('resolves script from project root', async () => {
      const scriptName = 'deploy';
      const expectedPath = path.join(process.cwd(), 'deploy.ts');

      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error()) // package check
        .mockRejectedValueOnce(new Error()) // scripts dir check
        .mockResolvedValueOnce(undefined); // project root check

      const resolved = await resolveScript(scriptName, mockConfig);

      expect(resolved).toBe(expectedPath);
    });

    test('resolves script from .scripts directory', async () => {
      const scriptName = 'deploy';
      const expectedPath = path.join(process.cwd(), '.scripts', 'deploy.ts');

      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error()) // package check
        .mockRejectedValueOnce(new Error()) // scripts dir check
        .mockRejectedValueOnce(new Error()) // project root check
        .mockResolvedValueOnce(undefined); // .scripts dir check

      const resolved = await resolveScript(scriptName, mockConfig);

      expect(resolved).toBe(expectedPath);
    });

    test('resolves npm package scripts', async () => {
      const scriptName = '@myorg/scripts/deploy';

      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const resolved = await resolveScript(scriptName, mockConfig);

      expect(resolved).toBe(scriptName);
    });

    test('tries multiple file extensions', async () => {
      const scriptName = 'deploy';

      // Mock file exists with .mjs extension
      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error()) // package
        .mockRejectedValueOnce(new Error()) // .ts
        .mockRejectedValueOnce(new Error()) // .js
        .mockResolvedValueOnce(undefined);  // .mjs

      const resolved = await resolveScript(scriptName, mockConfig);

      expect(resolved).toContain('deploy.mjs');
    });

    test('throws when script not found', async () => {
      const scriptName = 'nonexistent';

      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      await expect(resolveScript(scriptName, mockConfig))
        .rejects.toThrow(`Script not found: ${scriptName}`);
    });
  });

  describe('runScript', () => {
    const mockScriptDef: ScriptDefinition = {
      name: 'test-script',
      description: 'Test script',
      async run(context) {
        context.logger.info('Script executed');
        return { success: true };
      }
    };

    test('runs script with default options', async () => {
      const result = await runScript(mockScriptDef, {});

      expect(mockLogger.info).toHaveBeenCalledWith('Script executed');
      expect(result).toEqual({ success: true });
    });

    test('uses provided client', async () => {
      const customClient = {
        execute: vi.fn().mockResolvedValue({ status: 'custom' })
      } as any;

      let usedClient;
      const script: ScriptDefinition = {
        async run(context) {
          usedClient = context.client;
        }
      };

      await runScript(script, { client: customClient });

      expect(usedClient).toBe(customClient);
    });

    test('applies network override', async () => {
      const script: ScriptDefinition = {
        network: 'testnet',
        async run(context) {
          expect(context.config.network?.name).toBe('testnet');
        }
      };

      mockConfig.networks = {
        testnet: { type: 'chainweb', name: 'testnet' }
      };

      await runScript(script, {});
    });

    test('passes command line arguments', async () => {
      let capturedArgs;
      const script: ScriptDefinition = {
        async run(context) {
          capturedArgs = context.args;
        }
      };

      const args = {
        input: 'data.json',
        output: 'result.json',
        verbose: true
      };

      await runScript(script, { args });

      expect(capturedArgs).toEqual(args);
    });

    test('auto-starts network when configured', async () => {
      const mockNetwork = {
        start: vi.fn(),
        stop: vi.fn(),
        isOk: vi.fn().mockResolvedValue(false)
      };

      const script: ScriptDefinition = {
        autoStartNetwork: true,
        async run(context) {
          context.logger.info('Running with network');
        }
      };

      await runScript(script, {
        network: mockNetwork as any,
        autoStart: true
      });

      expect(mockNetwork.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Running with network');
    });

    test('handles script errors gracefully', async () => {
      const script: ScriptDefinition = {
        async run() {
          throw new Error('Script failed');
        }
      };

      await expect(runScript(script, {}))
        .rejects.toThrow('Script failed');
    });

    test('provides script metadata in context', async () => {
      let capturedName, capturedPath;
      const script: ScriptDefinition = {
        name: 'metadata-test',
        async run(context) {
          capturedName = context.scriptName;
          capturedPath = context.scriptPath;
        }
      };

      await runScript(script, {
        scriptPath: './scripts/metadata-test.ts'
      });

      expect(capturedName).toBe('metadata-test');
      expect(capturedPath).toBe('./scripts/metadata-test.ts');
    });
  });

  describe('Script Patterns', () => {
    test('deployment script pattern', async () => {
      const deployScript = createScript({
        name: 'deploy',
        description: 'Deploy contracts',
        async run({ client, logger }) {
          logger.info('Checking deployment status...');
          
          const isDeployed = await client.isContractDeployed('my-module');
          if (isDeployed) {
            logger.warn('Already deployed');
            return;
          }

          logger.info('Deploying contract...');
          const result = await client.deployContract('./my-module.pact');
          
          if (result.status === 'success') {
            logger.success('Deployment successful');
          } else {
            throw new Error('Deployment failed');
          }
        }
      });

      await deployScript.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {}
      } as any);

      expect(mockClient.isContractDeployed).toHaveBeenCalledWith('my-module');
      expect(mockClient.deployContract).toHaveBeenCalledWith('./my-module.pact');
      expect(mockLogger.success).toHaveBeenCalledWith('Deployment successful');
    });

    test('testing script pattern', async () => {
      const testScript = createScript({
        name: 'test',
        description: 'Run contract tests',
        async run({ client, logger, utils }) {
          const tests = [
            { name: 'Test 1', fn: async () => true },
            { name: 'Test 2', fn: async () => false },
            { name: 'Test 3', fn: async () => { throw new Error('Failed'); } }
          ];

          let passed = 0;
          let failed = 0;

          for (const test of tests) {
            try {
              const result = await utils.retry(test.fn, { retries: 2 });
              if (result) {
                logger.success(`✓ ${test.name}`);
                passed++;
              } else {
                logger.error(`✗ ${test.name}`);
                failed++;
              }
            } catch (error) {
              logger.error(`✗ ${test.name}: ${error.message}`);
              failed++;
            }
          }

          logger.info(`Tests: ${passed} passed, ${failed} failed`);
        }
      });

      const mockRetry = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('Failed'));

      await testScript.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {},
        utils: { retry: mockRetry }
      } as any);

      expect(mockLogger.success).toHaveBeenCalledWith('✓ Test 1');
      expect(mockLogger.error).toHaveBeenCalledWith('✗ Test 2');
      expect(mockLogger.error).toHaveBeenCalledWith('✗ Test 3: Failed');
      expect(mockLogger.info).toHaveBeenCalledWith('Tests: 1 passed, 2 failed');
    });

    test('interactive script pattern', async () => {
      const interactiveScript = createScript({
        name: 'interactive',
        description: 'Interactive deployment',
        async run({ client, logger, utils }) {
          const shouldDeploy = await utils.confirm('Deploy contract?');
          
          if (!shouldDeploy) {
            logger.info('Deployment cancelled');
            return;
          }

          logger.info('Proceeding with deployment...');
          await client.deployContract('./contract.pact');
        }
      });

      const mockConfirm = vi.fn().mockResolvedValue(false);

      await interactiveScript.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {},
        utils: { confirm: mockConfirm }
      } as any);

      expect(mockConfirm).toHaveBeenCalledWith('Deploy contract?');
      expect(mockLogger.info).toHaveBeenCalledWith('Deployment cancelled');
      expect(mockClient.deployContract).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('provides detailed error context', async () => {
      const script = createScript({
        name: 'error-test',
        async run({ client }) {
          throw new Error('Contract deployment failed: syntax error at line 42');
        }
      });

      await expect(script.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {},
        scriptName: 'error-test',
        scriptPath: './error-test.ts'
      } as any)).rejects.toThrow('syntax error at line 42');
    });

    test('handles async errors', async () => {
      const script = createScript({
        async run({ client }) {
          await new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Async error')), 10);
          });
        }
      });

      await expect(script.run({
        client: mockClient,
        logger: mockLogger,
        config: mockConfig,
        args: {}
      } as any)).rejects.toThrow('Async error');
    });
  });
});