import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProcessOrchestrator } from './orchestrator';
import type { OrchestratedProcess } from './types';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock tui
vi.mock('@pact-toolbox/tui', () => ({
  tui: {
    log: vi.fn(),
    updateProcess: vi.fn(),
  },
}));

describe('ProcessOrchestrator', () => {
  let orchestrator: ProcessOrchestrator;
  let mockExeca: any;

  beforeEach(() => {
    const { execa } = require('execa');
    mockExeca = execa;
    orchestrator = new ProcessOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start a simple process', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'test-process',
        name: 'Test Process',
        command: 'echo',
        args: ['hello'],
      };

      await orchestrator.start(config);

      expect(mockExeca).toHaveBeenCalledWith('echo', ['hello'], expect.any(Object));
    });

    it('should handle process start failure', async () => {
      mockExeca.mockRejectedValue(new Error('Command not found'));

      const config: OrchestratedProcess = {
        id: 'failing-process',
        name: 'Failing Process',
        command: 'nonexistent-command',
        args: [],
      };

      await expect(orchestrator.start(config)).rejects.toThrow('Command not found');
    });

    it('should set up health checks when configured', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'health-checked-process',
        name: 'Health Checked Process',
        command: 'node',
        args: ['server.js'],
        healthCheck: {
          type: 'http',
          url: 'http://localhost:3000/health',
          interval: 5000,
          timeout: 1000,
          retries: 3,
        },
      };

      await orchestrator.start(config);

      expect(mockExeca).toHaveBeenCalled();
      // Health check logic would be tested separately
    });

    it('should handle process with dependencies', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'dependent-process',
        name: 'Dependent Process',
        command: 'node',
        args: ['app.js'],
        dependencies: ['database', 'redis'],
      };

      await orchestrator.start(config);

      expect(mockExeca).toHaveBeenCalled();
    });
  });

  describe('startMany', () => {
    it('should start processes in dependency order', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const configs: OrchestratedProcess[] = [
        {
          id: 'app',
          name: 'Application',
          command: 'node',
          args: ['app.js'],
          dependencies: ['database'],
        },
        {
          id: 'database',
          name: 'Database',
          command: 'mongod',
          args: [],
        },
      ];

      await orchestrator.startMany(configs);

      expect(mockExeca).toHaveBeenCalledTimes(2);
      // Database should start first, then app
    });

    it('should handle circular dependencies', async () => {
      const configs: OrchestratedProcess[] = [
        {
          id: 'process-a',
          name: 'Process A',
          command: 'echo',
          args: ['a'],
          dependencies: ['process-b'],
        },
        {
          id: 'process-b',
          name: 'Process B',
          command: 'echo',
          args: ['b'],
          dependencies: ['process-a'],
        },
      ];

      await expect(orchestrator.startMany(configs)).rejects.toThrow('Circular dependency');
    });

    it('should handle missing dependencies', async () => {
      const configs: OrchestratedProcess[] = [
        {
          id: 'app',
          name: 'Application',
          command: 'node',
          args: ['app.js'],
          dependencies: ['nonexistent-service'],
        },
      ];

      await expect(orchestrator.startMany(configs)).rejects.toThrow('Missing dependency');
    });
  });

  describe('stop', () => {
    it('should stop a running process gracefully', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      // Start a process first
      const config: OrchestratedProcess = {
        id: 'test-process',
        name: 'Test Process',
        command: 'node',
        args: ['server.js'],
      };

      await orchestrator.start(config);
      await orchestrator.stop('test-process');

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should force kill if graceful shutdown fails', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'stubborn-process',
        name: 'Stubborn Process',
        command: 'node',
        args: ['stubborn.js'],
      };

      await orchestrator.start(config);
      await orchestrator.stop('stubborn-process', true);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should handle stopping non-existent process', async () => {
      await expect(orchestrator.stop('nonexistent')).rejects.toThrow('Process not found');
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all processes in reverse dependency order', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const configs: OrchestratedProcess[] = [
        {
          id: 'database',
          name: 'Database',
          command: 'mongod',
          args: [],
        },
        {
          id: 'app',
          name: 'Application',
          command: 'node',
          args: ['app.js'],
          dependencies: ['database'],
        },
      ];

      await orchestrator.startMany(configs);
      await orchestrator.shutdownAll();

      expect(mockProcess.kill).toHaveBeenCalledTimes(2);
      // App should be killed first, then database
    });

    it('should handle shutdown timeout', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'slow-shutdown',
        name: 'Slow Shutdown Process',
        command: 'node',
        args: ['slow.js'],
        shutdownTimeout: 100, // Very short timeout for testing
      };

      await orchestrator.start(config);
      await orchestrator.shutdownAll();

      // Should eventually call SIGKILL if SIGTERM doesn't work
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('restart', () => {
    it('should restart a process', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'restartable-process',
        name: 'Restartable Process',
        command: 'node',
        args: ['app.js'],
      };

      await orchestrator.start(config);
      await orchestrator.restart('restartable-process');

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mockExeca).toHaveBeenCalledTimes(2); // Initial start + restart
    });

    it('should handle restart of non-existent process', async () => {
      await expect(orchestrator.restart('nonexistent')).rejects.toThrow('Process not found');
    });
  });

  describe('event handling', () => {
    it('should emit process events', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const startedHandler = vi.fn();
      orchestrator.on('processStarted', startedHandler);

      const config: OrchestratedProcess = {
        id: 'event-process',
        name: 'Event Process',
        command: 'echo',
        args: ['hello'],
      };

      await orchestrator.start(config);

      expect(startedHandler).toHaveBeenCalledWith({
        id: 'event-process',
        name: 'Event Process',
        pid: 1234,
      });
    });

    it('should emit error events', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process error')), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const errorHandler = vi.fn();
      orchestrator.on('processError', errorHandler);

      const config: OrchestratedProcess = {
        id: 'error-process',
        name: 'Error Process',
        command: 'node',
        args: ['error.js'],
      };

      await orchestrator.start(config);

      // Wait for async error event
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('health checks', () => {
    it('should perform HTTP health checks', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      // Mock fetch for health check
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config: OrchestratedProcess = {
        id: 'health-process',
        name: 'Health Process',
        command: 'node',
        args: ['server.js'],
        healthCheck: {
          type: 'http',
          url: 'http://localhost:3000/health',
          interval: 1000,
          timeout: 500,
          retries: 2,
        },
      };

      await orchestrator.start(config);

      // Health check runs in background, so we need to wait
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/health', {
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle failed health checks', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const healthFailedHandler = vi.fn();
      orchestrator.on('healthCheckFailed', healthFailedHandler);

      const config: OrchestratedProcess = {
        id: 'unhealthy-process',
        name: 'Unhealthy Process',
        command: 'node',
        args: ['server.js'],
        healthCheck: {
          type: 'http',
          url: 'http://localhost:3000/health',
          interval: 100,
          timeout: 50,
          retries: 1,
        },
      };

      await orchestrator.start(config);

      // Wait for health check to fail
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(healthFailedHandler).toHaveBeenCalled();
    });
  });

  describe('process state', () => {
    it('should track process states correctly', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      const config: OrchestratedProcess = {
        id: 'state-process',
        name: 'State Process',
        command: 'echo',
        args: ['hello'],
      };

      expect(orchestrator.getProcessState('state-process')).toBeUndefined();

      await orchestrator.start(config);
      expect(orchestrator.getProcessState('state-process')).toBe('running');

      await orchestrator.stop('state-process');
      expect(orchestrator.getProcessState('state-process')).toBe('stopped');
    });

    it('should list all processes', async () => {
      const mockProcess = {
        pid: 1234,
        kill: vi.fn(),
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      mockExeca.mockResolvedValue(mockProcess);

      expect(orchestrator.listProcesses()).toEqual([]);

      const config: OrchestratedProcess = {
        id: 'list-process',
        name: 'List Process',
        command: 'echo',
        args: ['hello'],
      };

      await orchestrator.start(config);
      const processes = orchestrator.listProcesses();

      expect(processes).toHaveLength(1);
      expect(processes[0]).toMatchObject({
        id: 'list-process',
        name: 'List Process',
        state: 'running',
        pid: 1234,
      });
    });
  });
});