import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContainerOrchestrator } from './orchestrator';
import type { ContainerConfig } from './types';

// Mock dockerode
vi.mock('dockerode', () => {
  return {
    default: vi.fn(() => ({
      createContainer: vi.fn(),
      listContainers: vi.fn(),
      getContainer: vi.fn(),
      createNetwork: vi.fn(),
      listNetworks: vi.fn(),
      getNetwork: vi.fn(),
      createVolume: vi.fn(),
      listVolumes: vi.fn(),
      getVolume: vi.fn(),
    })),
  };
});

// Mock tui
vi.mock('@pact-toolbox/tui', () => ({
  tui: {
    log: vi.fn(),
    updateContainer: vi.fn(),
  },
}));

describe('ContainerOrchestrator', () => {
  let orchestrator: ContainerOrchestrator;
  let mockDocker: any;

  beforeEach(() => {
    const Docker = require('dockerode').default;
    mockDocker = new Docker();
    orchestrator = new ContainerOrchestrator({
      networkName: 'test-network',
      volumes: ['test-volume'],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startContainer', () => {
    it('should start a simple container', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true, Health: { Status: 'healthy' } },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'test-container',
        name: 'test-container',
        image: 'nginx',
        tag: 'latest',
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith({
        name: 'test-container',
        Image: 'nginx:latest',
        HostConfig: {
          NetworkMode: 'test-network',
          PortBindings: {},
          Binds: [],
          RestartPolicy: { Name: 'no' },
        },
        Labels: {},
        Env: [],
        Cmd: undefined,
        Entrypoint: undefined,
        WorkingDir: undefined,
        ExposedPorts: {},
        Healthcheck: undefined,
      });

      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should handle container with port mappings', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: { '80/tcp': [{ HostPort: '8080' }] } },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'web-container',
        name: 'web-container',
        image: 'nginx',
        tag: 'latest',
        ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            PortBindings: { '80/tcp': [{ HostPort: '8080' }] },
          }),
          ExposedPorts: { '80/tcp': {} },
        })
      );
    });

    it('should handle container with volumes', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'data-container',
        name: 'data-container',
        image: 'postgres',
        tag: '13',
        volumes: [
          { host: '/host/data', container: '/var/lib/postgresql/data', mode: 'rw' },
          { host: 'named-volume', container: '/backup', mode: 'ro' },
        ],
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            Binds: ['/host/data:/var/lib/postgresql/data:rw', 'named-volume:/backup:ro'],
          }),
        })
      );
    });

    it('should handle container with environment variables', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'env-container',
        name: 'env-container',
        image: 'node',
        tag: '18',
        env: { NODE_ENV: 'production', PORT: '3000' },
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: ['NODE_ENV=production', 'PORT=3000'],
        })
      );
    });

    it('should handle container with custom command', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'custom-container',
        name: 'custom-container',
        image: 'ubuntu',
        tag: 'latest',
        command: ['bash', '-c', 'echo hello'],
        entrypoint: ['/custom/entrypoint.sh'],
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['bash', '-c', 'echo hello'],
          Entrypoint: ['/custom/entrypoint.sh'],
        })
      );
    });

    it('should handle container start failure', async () => {
      mockDocker.createContainer.mockRejectedValue(new Error('Image not found'));

      const config: ContainerConfig = {
        id: 'failing-container',
        name: 'failing-container',
        image: 'nonexistent',
        tag: 'latest',
      };

      await expect(orchestrator.startContainer(config)).rejects.toThrow('Image not found');
    });
  });

  describe('stopContainer', () => {
    it('should stop a running container gracefully', async () => {
      const mockContainer = {
        id: 'container123',
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false },
        }),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await orchestrator.stopContainer('test-container');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 30 }); // 30 second timeout
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should force kill container if graceful stop fails', async () => {
      const mockContainer = {
        id: 'container123',
        stop: vi.fn().mockRejectedValue(new Error('Stop timeout')),
        kill: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false },
        }),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await orchestrator.stopContainer('stubborn-container', true);

      expect(mockContainer.kill).toHaveBeenCalledWith({ signal: 'SIGKILL' });
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should handle stopping non-existent container', async () => {
      mockDocker.getContainer.mockReturnValue({
        stop: vi.fn().mockRejectedValue({ statusCode: 404 }),
      });

      // Should not throw for non-existent container
      await expect(orchestrator.stopContainer('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('startServices', () => {
    it('should start multiple containers in dependency order', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const configs: ContainerConfig[] = [
        {
          id: 'web',
          name: 'web',
          image: 'nginx',
          tag: 'latest',
          dependencies: ['database'],
        },
        {
          id: 'database',
          name: 'database',
          image: 'postgres',
          tag: '13',
        },
      ];

      await orchestrator.startServices(configs);

      expect(mockDocker.createContainer).toHaveBeenCalledTimes(2);
      // Database should be created first, then web
    });

    it('should handle circular dependencies', async () => {
      const configs: ContainerConfig[] = [
        {
          id: 'service-a',
          name: 'service-a',
          image: 'nginx',
          tag: 'latest',
          dependencies: ['service-b'],
        },
        {
          id: 'service-b',
          name: 'service-b',
          image: 'postgres',
          tag: '13',
          dependencies: ['service-a'],
        },
      ];

      await expect(orchestrator.startServices(configs)).rejects.toThrow('Circular dependency');
    });

    it('should handle missing dependencies', async () => {
      const configs: ContainerConfig[] = [
        {
          id: 'web',
          name: 'web',
          image: 'nginx',
          tag: 'latest',
          dependencies: ['nonexistent-service'],
        },
      ];

      await expect(orchestrator.startServices(configs)).rejects.toThrow('Missing dependency');
    });
  });

  describe('stopAllServices', () => {
    it('should stop all containers in reverse dependency order', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);
      mockDocker.listContainers.mockResolvedValue([
        { Id: 'container123', Names: ['/web'], Labels: { 'pact-toolbox.service': 'web' } },
        { Id: 'container456', Names: ['/database'], Labels: { 'pact-toolbox.service': 'database' } },
      ]);

      // Start services first
      const configs: ContainerConfig[] = [
        {
          id: 'database',
          name: 'database',
          image: 'postgres',
          tag: '13',
        },
        {
          id: 'web',
          name: 'web',
          image: 'nginx',
          tag: 'latest',
          dependencies: ['database'],
        },
      ];

      await orchestrator.startServices(configs);
      await orchestrator.stopAllServices();

      expect(mockContainer.stop).toHaveBeenCalledTimes(2);
      // Web should be stopped first, then database
    });
  });

  describe('health checks', () => {
    it('should perform container health checks', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          State: { 
            Running: true,
            Health: { Status: 'healthy' },
          },
          NetworkSettings: { Ports: {} },
        }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'health-container',
        name: 'health-container',
        image: 'nginx',
        tag: 'latest',
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/health'],
          interval: '30s',
          timeout: '10s',
          retries: 3,
          startPeriod: '60s',
        },
      };

      await orchestrator.startContainer(config);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Healthcheck: {
            Test: ['CMD', 'curl', '-f', 'http://localhost/health'],
            Interval: 30000000000, // 30s in nanoseconds
            Timeout: 10000000000,   // 10s in nanoseconds
            Retries: 3,
            StartPeriod: 60000000000, // 60s in nanoseconds
          },
        })
      );
    });

    it('should wait for container to be healthy', async () => {
      const mockContainer = {
        id: 'container123',
        start: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn()
          .mockResolvedValueOnce({
            State: { 
              Running: true,
              Health: { Status: 'starting' },
            },
            NetworkSettings: { Ports: {} },
          })
          .mockResolvedValueOnce({
            State: { 
              Running: true,
              Health: { Status: 'healthy' },
            },
            NetworkSettings: { Ports: {} },
          }),
        logs: vi.fn().mockResolvedValue('Container logs'),
      };

      mockDocker.createContainer.mockResolvedValue(mockContainer);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const config: ContainerConfig = {
        id: 'slow-start-container',
        name: 'slow-start-container',
        image: 'nginx',
        tag: 'latest',
        healthCheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost/health'],
          interval: '10s',
          timeout: '5s',
          retries: 2,
        },
      };

      await orchestrator.startContainer(config);

      expect(mockContainer.inspect).toHaveBeenCalledTimes(2);
    });
  });

  describe('networking', () => {
    it('should create custom network if specified', async () => {
      const mockNetwork = {
        id: 'network123',
        inspect: vi.fn().mockResolvedValue({ Name: 'custom-network' }),
      };

      mockDocker.createNetwork.mockResolvedValue(mockNetwork);
      mockDocker.listNetworks.mockResolvedValue([]);
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      const orchestratorWithCustomNetwork = new ContainerOrchestrator({
        networkName: 'custom-network',
        volumes: [],
      });

      // Network creation happens during setup
      await orchestratorWithCustomNetwork['setupNetwork']();

      expect(mockDocker.createNetwork).toHaveBeenCalledWith({
        Name: 'custom-network',
        Driver: 'bridge',
        Labels: {
          'pact-toolbox.network': 'true',
        },
      });
    });

    it('should use existing network if available', async () => {
      mockDocker.listNetworks.mockResolvedValue([
        { Name: 'existing-network', Id: 'network123' },
      ]);

      const orchestratorWithExistingNetwork = new ContainerOrchestrator({
        networkName: 'existing-network',
        volumes: [],
      });

      await orchestratorWithExistingNetwork['setupNetwork']();

      expect(mockDocker.createNetwork).not.toHaveBeenCalled();
    });
  });

  describe('volumes', () => {
    it('should create named volumes if specified', async () => {
      const mockVolume = {
        name: 'test-volume',
        inspect: vi.fn().mockResolvedValue({ Name: 'test-volume' }),
      };

      mockDocker.createVolume.mockResolvedValue(mockVolume);
      mockDocker.listVolumes.mockResolvedValue({ Volumes: [] });
      mockDocker.getVolume.mockReturnValue(mockVolume);

      const orchestratorWithVolumes = new ContainerOrchestrator({
        networkName: 'test-network',
        volumes: ['test-volume'],
      });

      await orchestratorWithVolumes['setupVolumes']();

      expect(mockDocker.createVolume).toHaveBeenCalledWith({
        Name: 'test-volume',
        Labels: {
          'pact-toolbox.volume': 'true',
        },
      });
    });

    it('should use existing volumes if available', async () => {
      mockDocker.listVolumes.mockResolvedValue({
        Volumes: [{ Name: 'existing-volume' }],
      });

      const orchestratorWithExistingVolume = new ContainerOrchestrator({
        networkName: 'test-network',
        volumes: ['existing-volume'],
      });

      await orchestratorWithExistingVolume['setupVolumes']();

      expect(mockDocker.createVolume).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Docker daemon connection errors', async () => {
      mockDocker.listContainers.mockRejectedValue(new Error('Cannot connect to Docker daemon'));

      await expect(orchestrator.isDockerRunning()).resolves.toBe(false);
    });

    it('should handle container creation failures gracefully', async () => {
      mockDocker.createContainer.mockRejectedValue(new Error('Out of disk space'));

      const config: ContainerConfig = {
        id: 'failing-container',
        name: 'failing-container',
        image: 'nginx',
        tag: 'latest',
      };

      await expect(orchestrator.startContainer(config)).rejects.toThrow('Out of disk space');
    });
  });
});