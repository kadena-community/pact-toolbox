import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  runReplTests,
  createPactTestEnv,
  RunReplTestsOptions,
  CreatePactTestEnvOptions,
  PactTestEnv
} from './index';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { PactToolboxNetwork } from '@pact-toolbox/network';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('os');
vi.mock('@pact-toolbox/runtime');
vi.mock('@pact-toolbox/network');
vi.mock('@pact-toolbox/config', () => ({
  resolveConfig: vi.fn().mockResolvedValue({
    contractsDir: './contracts',
    networks: {},
    preludes: []
  })
}));

describe('@pact-toolbox/test', () => {
  let mockClient: PactToolboxClient;
  let mockNetwork: PactToolboxNetwork;
  let mockFs: typeof fs;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn().mockResolvedValue({ status: 'success' }),
      deployContract: vi.fn().mockResolvedValue({ status: 'success' }),
      local: vi.fn().mockResolvedValue({ result: { status: 'success' } })
    } as any;

    mockNetwork = {
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      isOk: vi.fn().mockResolvedValue(true),
      getServicePort: vi.fn().mockReturnValue(8080),
      getNodeServiceUrl: vi.fn().mockReturnValue('http://localhost:8080'),
      getMiningClientUrl: vi.fn().mockReturnValue('http://localhost:8080'),
      hasOnDemandMining: vi.fn().mockReturnValue(false),
      id: 'test-network'
    } as any;

    mockFs = fs as any;

    vi.mocked(os.cpus).mockReturnValue(new Array(4));
    vi.clearAllMocks();
  });

  describe('runReplTests', () => {
    const defaultOptions: RunReplTestsOptions = {
      contractsDir: './contracts'
    };

    test('discovers and runs REPL test files', async () => {
      const testFiles = [
        './contracts/tests/coin.repl',
        './contracts/tests/exchange.repl',
        './contracts/prelude/test.repl'
      ];

      vi.mocked(mockFs.readdir).mockImplementation(async (dir) => {
        if (dir.toString().includes('tests')) {
          return ['coin.repl', 'exchange.repl'] as any;
        }
        if (dir.toString().includes('prelude')) {
          return ['test.repl'] as any;
        }
        return ['tests', 'prelude'] as any;
      });

      vi.mocked(mockFs.stat).mockImplementation(async (path) => ({
        isDirectory: () => !path.toString().endsWith('.repl'),
        isFile: () => path.toString().endsWith('.repl')
      } as any));

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('Test passed'));
            }
          })
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(''));
            }
          })
        }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const results = await runReplTests(defaultOptions);

      expect(spawn).toHaveBeenCalledTimes(3);
      expect(spawn).toHaveBeenCalledWith('pact', ['-t', expect.any(String)]);
      expect(results.totalTests).toBe(3);
      expect(results.passedTests).toBe(3);
      expect(results.failedTests).toBe(0);
    });

    test('handles test failures', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue(['failing.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 10);
          }
        }),
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('FAILURE: test failed'));
            }
          })
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('Error in test'));
            }
          })
        }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const results = await runReplTests(defaultOptions);

      expect(results.failedTests).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain('failing.repl');
    });

    test('respects concurrency limits', async () => {
      const testFiles = Array.from({ length: 10 }, (_, i) => `test${i}.repl`);
      
      vi.mocked(mockFs.readdir).mockResolvedValue(testFiles as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      let activeProcesses = 0;
      let maxActiveProcesses = 0;

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => {
              activeProcesses--;
              handler(0);
            }, 50);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      vi.mocked(spawn).mockImplementation(() => {
        activeProcesses++;
        maxActiveProcesses = Math.max(maxActiveProcesses, activeProcesses);
        return mockProcess as any;
      });

      await runReplTests({ ...defaultOptions, concurrency: 3 });

      expect(maxActiveProcesses).toBeLessThanOrEqual(3);
    });

    test('filters test files', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue([
        'coin.repl',
        'exchange.repl',
        'token.repl'
      ] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') handler(0);
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await runReplTests({ 
        ...defaultOptions, 
        filter: 'coin' 
      });

      expect(spawn).toHaveBeenCalledTimes(1);
      expect(spawn).toHaveBeenCalledWith('pact', ['-t', expect.stringContaining('coin.repl')]);
    });

    test('continues on error when configured', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue(['test1.repl', 'test2.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        callCount++;
        return {
          on: vi.fn((event, handler) => {
            if (event === 'exit') {
              handler(callCount === 1 ? 1 : 0); // First test fails
            }
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() }
        } as any;
      });

      const results = await runReplTests({ 
        ...defaultOptions, 
        continueOnError: true 
      });

      expect(spawn).toHaveBeenCalledTimes(2);
      expect(results.failedTests).toBe(1);
      expect(results.passedTests).toBe(1);
    });

    test('handles verbose output', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue(['test.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') handler(0);
        }),
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('Verbose test output'));
            }
          })
        },
        stderr: { on: vi.fn() }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await runReplTests({ 
        ...defaultOptions, 
        verbose: true 
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verbose test output'));
      consoleLogSpy.mockRestore();
    });

    test('ignores prelude directory by default', async () => {
      vi.mocked(mockFs.readdir).mockImplementation(async (dir) => {
        if (dir === './contracts') {
          return ['tests', 'prelude'] as any;
        }
        if (dir.toString().includes('tests')) {
          return ['test.repl'] as any;
        }
        return [] as any;
      });

      vi.mocked(mockFs.stat).mockImplementation(async (path) => ({
        isDirectory: () => !path.toString().endsWith('.repl'),
        isFile: () => path.toString().endsWith('.repl')
      } as any));

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') handler(0);
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await runReplTests(defaultOptions);

      // Should only run tests from 'tests' directory, not 'prelude'
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPactTestEnv', () => {
    test('creates test environment with default config', async () => {
      const mockCreateNetwork = vi.fn().mockResolvedValue({
        network: mockNetwork,
        client: mockClient
      });

      vi.mock('@pact-toolbox/network', () => ({
        createPactToolboxNetwork: mockCreateNetwork
      }));

      const env = await createPactTestEnv();

      expect(env).toHaveProperty('client');
      expect(env).toHaveProperty('config');
      expect(env).toHaveProperty('network');
      expect(env).toHaveProperty('start');
      expect(env).toHaveProperty('stop');
      expect(env).toHaveProperty('restart');
    });

    test('uses custom configuration', async () => {
      const customConfig = {
        contractsDir: './custom-contracts',
        preludes: ['kadena/chainweb']
      };

      const env = await createPactTestEnv({
        config: customConfig
      });

      expect(env.config).toMatchObject(customConfig);
    });

    test('uses specified network type', async () => {
      await createPactTestEnv({
        networkType: 'devnet'
      });

      expect(env.config.network.type).toBe('devnet');
    });

    test('uses random port when port is 0', async () => {
      const getPortMock = vi.fn().mockResolvedValue(12345);
      vi.mock('get-port', () => ({ default: getPortMock }));

      const env = await createPactTestEnv({ port: 0 });

      expect(getPortMock).toHaveBeenCalled();
      expect(env.config.network.pactServer?.port || 
             env.config.network.devnet?.containerConfig?.port).toBe(12345);
    });

    test('starts network', async () => {
      const env = await createPactTestEnv();
      await env.start();

      expect(mockNetwork.start).toHaveBeenCalled();
    });

    test('stops network', async () => {
      const env = await createPactTestEnv();
      await env.stop();

      expect(mockNetwork.stop).toHaveBeenCalled();
    });

    test('restarts network', async () => {
      const env = await createPactTestEnv();
      await env.restart();

      expect(mockNetwork.restart).toHaveBeenCalled();
    });

    test('injects network config into global', async () => {
      const env = await createPactTestEnv();

      expect(global.__PACT_TOOLBOX_NETWORK_CONFIG__).toBeDefined();
      expect(global.__PACT_TOOLBOX_NETWORK_CONFIG__.apiUrl).toBe('http://localhost:8080');
    });

    test('handles network creation errors', async () => {
      const mockCreateNetwork = vi.fn().mockRejectedValue(
        new Error('Failed to create network')
      );

      vi.mock('@pact-toolbox/network', () => ({
        createPactToolboxNetwork: mockCreateNetwork
      }));

      await expect(createPactTestEnv()).rejects.toThrow('Failed to create network');
    });
  });

  describe('Integration Scenarios', () => {
    test('runs REPL tests in test environment', async () => {
      // Create test environment
      const env = await createPactTestEnv();
      await env.start();

      // Setup test files
      vi.mocked(mockFs.readdir).mockResolvedValue(['integration.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const mockProcess = {
        on: vi.fn((event, handler) => {
          if (event === 'exit') handler(0);
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      // Run tests
      const results = await runReplTests({
        contractsDir: env.config.contractsDir
      });

      expect(results.totalTests).toBe(1);
      expect(results.passedTests).toBe(1);

      // Cleanup
      await env.stop();
    });

    test('supports watch mode simulation', async () => {
      const env = await createPactTestEnv();
      
      // Simulate file change and re-run
      const runTest = async () => {
        vi.mocked(mockFs.readdir).mockResolvedValue(['watch-test.repl'] as any);
        vi.mocked(mockFs.stat).mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true
        } as any);

        const mockProcess = {
          on: vi.fn((event, handler) => {
            if (event === 'exit') handler(0);
          }),
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() }
        };

        vi.mocked(spawn).mockReturnValue(mockProcess as any);

        return runReplTests({ contractsDir: env.config.contractsDir });
      };

      // Initial run
      await env.start();
      const results1 = await runTest();
      expect(results1.passedTests).toBe(1);

      // Simulate change and re-run
      await env.restart();
      const results2 = await runTest();
      expect(results2.passedTests).toBe(1);

      await env.stop();
    });

    test('handles parallel test environments', async () => {
      // Create multiple isolated environments
      const envs = await Promise.all([
        createPactTestEnv({ port: 0 }),
        createPactTestEnv({ port: 0 }),
        createPactTestEnv({ port: 0 })
      ]);

      // Verify each has unique port
      const ports = envs.map(env => 
        env.config.network.pactServer?.port || 
        env.config.network.devnet?.containerConfig?.port
      );
      
      expect(new Set(ports).size).toBe(ports.length);

      // Start all environments
      await Promise.all(envs.map(env => env.start()));

      // Stop all environments
      await Promise.all(envs.map(env => env.stop()));
    });
  });

  describe('Error Handling', () => {
    test('handles missing pact executable', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue(['test.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('spawn pact ENOENT');
      });

      await expect(runReplTests(defaultOptions)).rejects.toThrow(
        'Pact executable not found'
      );
    });

    test('handles directory read errors', async () => {
      vi.mocked(mockFs.readdir).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(runReplTests(defaultOptions)).rejects.toThrow(
        'Permission denied'
      );
    });

    test('handles test timeout', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue(['timeout.repl'] as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      const mockProcess = {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn()
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const resultsPromise = runReplTests({ 
        ...defaultOptions, 
        timeout: 100 
      });

      // Simulate timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await expect(resultsPromise).rejects.toThrow('Test timeout');
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});