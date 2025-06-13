import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  downloadAllPreludes,
  deployPreludes,
  resolvePrelude,
  getPreludeRegistry,
  PreludeRegistry,
  PactPrelude,
  DownloadPreludesOptions,
  DeployPreludesOptions
} from './index';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('@pact-toolbox/runtime');
vi.mock('@pact-toolbox/utils');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@pact-toolbox/prelude', () => {
  let mockClient: PactToolboxClient;
  let mockFs: typeof fs;

  beforeEach(() => {
    mockClient = {
      deployContract: vi.fn().mockResolvedValue({ status: 'success' }),
      execute: vi.fn().mockResolvedValue({ status: 'success' }),
      local: vi.fn().mockResolvedValue({ result: { status: 'success' } })
    } as any;

    mockFs = fs as any;
    vi.clearAllMocks();
  });

  describe('downloadAllPreludes', () => {
    const defaultOptions: DownloadPreludesOptions = {
      contractsDir: './contracts',
      preludes: ['kadena/chainweb'],
      client: mockClient
    };

    test('downloads standard preludes', async () => {
      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      const mockRegistry = {
        get: vi.fn().mockResolvedValue({
          name: 'kadena/chainweb',
          url: 'https://github.com/kadena/chainweb.pact',
          content: '(module coin ...)'
        })
      };

      await downloadAllPreludes(defaultOptions, mockRegistry as any);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('contracts'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('chainweb.pact'),
        '(module coin ...)'
      );
    });

    test('skips existing preludes unless forced', async () => {
      vi.mocked(mockFs.access).mockResolvedValue(undefined); // File exists

      await downloadAllPreludes(defaultOptions);

      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // Test force download
      await downloadAllPreludes({ ...defaultOptions, force: true });
      
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('downloads custom preludes', async () => {
      const customPrelude: PactPrelude = {
        name: 'my-prelude',
        path: './preludes/custom.pact',
        url: 'https://example.com/custom.pact'
      };

      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('(module custom ...)')
      });

      await downloadAllPreludes({
        ...defaultOptions,
        preludes: [customPrelude]
      });

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/custom.pact');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom.pact'),
        '(module custom ...)'
      );
    });

    test('applies templates to preludes', async () => {
      const templatedPrelude: PactPrelude = {
        name: 'templated',
        path: './templated.pact',
        templateData: {
          namespace: 'free',
          adminKeyset: '"admin-ks"',
          version: '1.0.0'
        },
        content: '(namespace "{{namespace}}")\n(defconst VERSION "{{version}}")'
      };

      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      await downloadAllPreludes({
        ...defaultOptions,
        preludes: [templatedPrelude]
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('(namespace "free")')
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('(defconst VERSION "1.0.0")')
      );
    });

    test('handles download errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const badPrelude: PactPrelude = {
        name: 'bad-prelude',
        url: 'https://example.com/not-found.pact'
      };

      await expect(downloadAllPreludes({
        ...defaultOptions,
        preludes: [badPrelude]
      })).rejects.toThrow('Failed to download');
    });

    test('creates nested directories', async () => {
      const nestedPrelude: PactPrelude = {
        name: 'org/project/module',
        path: './contracts/org/project/module.pact',
        content: '(module test ...)'
      };

      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      await downloadAllPreludes({
        ...defaultOptions,
        preludes: [nestedPrelude]
      });

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('org/project'),
        { recursive: true }
      );
    });
  });

  describe('deployPreludes', () => {
    const defaultOptions: DeployPreludesOptions = {
      contractsDir: './contracts',
      preludes: ['kadena/chainweb'],
      client: mockClient
    };

    test('deploys preludes in order', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue('(module coin ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      await deployPreludes(defaultOptions);

      expect(mockClient.deployContract).toHaveBeenCalledWith(
        expect.stringContaining('chainweb.pact')
      );
    });

    test('respects dependencies', async () => {
      const preludes: PactPrelude[] = [
        { name: 'base', path: './base.pact' },
        { 
          name: 'dependent', 
          path: './dependent.pact',
          dependencies: ['base']
        }
      ];

      vi.mocked(mockFs.readFile).mockResolvedValue('(module test ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const deployOrder: string[] = [];
      mockClient.deployContract.mockImplementation(async (path) => {
        deployOrder.push(path);
        return { status: 'success' };
      });

      await deployPreludes({
        ...defaultOptions,
        preludes
      });

      expect(deployOrder[0]).toContain('base.pact');
      expect(deployOrder[1]).toContain('dependent.pact');
    });

    test('skips already deployed preludes', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue('(module coin ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      // Mock that module is already deployed
      mockClient.local.mockResolvedValue({
        result: { 
          status: 'success',
          data: { module: 'coin' }
        }
      });

      await deployPreludes({
        ...defaultOptions,
        skipDeployed: true
      });

      expect(mockClient.deployContract).not.toHaveBeenCalled();
    });

    test('handles deployment failures', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue('(module bad ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      mockClient.deployContract.mockRejectedValue(
        new Error('Deployment failed: syntax error')
      );

      await expect(deployPreludes(defaultOptions)).rejects.toThrow(
        'Deployment failed'
      );
    });

    test('provides progress updates', async () => {
      const progressUpdates: any[] = [];
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress);
      });

      vi.mocked(mockFs.readFile).mockResolvedValue('(module test ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      await deployPreludes({
        ...defaultOptions,
        preludes: ['prelude1', 'prelude2'],
        onProgress
      });

      expect(onProgress).toHaveBeenCalledTimes(4); // Start and complete for each
      expect(progressUpdates[0]).toMatchObject({
        current: 1,
        total: 2,
        prelude: 'prelude1',
        status: 'deploying'
      });
      expect(progressUpdates[3]).toMatchObject({
        current: 2,
        total: 2,
        prelude: 'prelude2',
        status: 'deployed'
      });
    });

    test('deploys in parallel when enabled', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue('(module test ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const deployTimes: number[] = [];
      mockClient.deployContract.mockImplementation(async () => {
        deployTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 50));
        return { status: 'success' };
      });

      await deployPreludes({
        ...defaultOptions,
        preludes: ['prelude1', 'prelude2', 'prelude3'],
        parallelDeploy: true
      });

      // All deploys should start roughly at the same time
      const timeDiffs = deployTimes.slice(1).map((t, i) => t - deployTimes[i]);
      expect(Math.max(...timeDiffs)).toBeLessThan(10);
    });
  });

  describe('resolvePrelude', () => {
    test('resolves string prelude from registry', async () => {
      const mockRegistry = new PreludeRegistry();
      mockRegistry.register({
        name: 'kadena/chainweb',
        url: 'https://github.com/kadena/chainweb.pact',
        version: '1.0.0',
        description: 'Core Kadena contracts'
      });

      const resolved = await resolvePrelude('kadena/chainweb', {
        registry: mockRegistry,
        contractsDir: './contracts'
      });

      expect(resolved).toMatchObject({
        name: 'kadena/chainweb',
        path: expect.stringContaining('chainweb.pact'),
        url: 'https://github.com/kadena/chainweb.pact',
        version: '1.0.0'
      });
    });

    test('resolves object prelude', async () => {
      const prelude: PactPrelude = {
        name: 'custom',
        path: './custom.pact',
        dependencies: ['base'],
        templateData: { version: '1.0.0' }
      };

      const resolved = await resolvePrelude(prelude, {
        contractsDir: './contracts'
      });

      expect(resolved).toEqual({
        ...prelude,
        path: path.resolve('./contracts', './custom.pact')
      });
    });

    test('validates template data', async () => {
      const prelude: PactPrelude = {
        name: 'templated',
        path: './templated.pact',
        content: '{{namespace}} {{missing}}',
        templateData: { namespace: 'free' }
      };

      await expect(resolvePrelude(prelude, {
        contractsDir: './contracts',
        validateTemplate: true
      })).rejects.toThrow('Missing template variable: missing');
    });

    test('handles prelude not found in registry', async () => {
      const mockRegistry = new PreludeRegistry();

      await expect(resolvePrelude('unknown/prelude', {
        registry: mockRegistry,
        contractsDir: './contracts'
      })).rejects.toThrow('Prelude not found: unknown/prelude');
    });
  });

  describe('PreludeRegistry', () => {
    let registry: PreludeRegistry;

    beforeEach(() => {
      registry = new PreludeRegistry();
    });

    test('registers and retrieves preludes', () => {
      registry.register({
        name: 'test/prelude',
        url: 'https://example.com/test.pact',
        version: '1.0.0'
      });

      const prelude = registry.get('test/prelude');
      expect(prelude).toMatchObject({
        name: 'test/prelude',
        url: 'https://example.com/test.pact'
      });
    });

    test('lists all registered preludes', () => {
      registry.register({ name: 'prelude1', url: 'url1' });
      registry.register({ name: 'prelude2', url: 'url2' });

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map(p => p.name)).toContain('prelude1');
      expect(list.map(p => p.name)).toContain('prelude2');
    });

    test('searches preludes', () => {
      registry.register({ 
        name: 'kadena/chainweb',
        description: 'Core blockchain contracts' 
      });
      registry.register({ 
        name: 'kadena/marmalade',
        description: 'NFT standard' 
      });
      registry.register({ 
        name: 'custom/defi',
        description: 'DeFi primitives' 
      });

      const kadenaResults = registry.search('kadena');
      expect(kadenaResults).toHaveLength(2);

      const nftResults = registry.search('nft');
      expect(nftResults).toHaveLength(1);
      expect(nftResults[0].name).toBe('kadena/marmalade');
    });

    test('throws on duplicate registration', () => {
      registry.register({ name: 'test', url: 'url1' });
      
      expect(() => {
        registry.register({ name: 'test', url: 'url2' });
      }).toThrow('Prelude already registered: test');
    });

    test('caches remote preludes', async () => {
      const cacheRegistry = new PreludeRegistry({ cache: true });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { name: 'remote/prelude', url: 'https://example.com' }
        ])
      });

      await cacheRegistry.loadRemote('https://registry.example.com');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await cacheRegistry.loadRemote('https://registry.example.com');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPreludeRegistry', () => {
    test('returns default registry with standard preludes', () => {
      const registry = getPreludeRegistry();
      
      expect(registry.get('kadena/chainweb')).toBeDefined();
      expect(registry.get('kadena/marmalade')).toBeDefined();
      expect(registry.get('kadena/gas-station')).toBeDefined();
    });

    test('registry is singleton', () => {
      const registry1 = getPreludeRegistry();
      const registry2 = getPreludeRegistry();
      
      expect(registry1).toBe(registry2);
    });
  });

  describe('Complex Scenarios', () => {
    test('handles circular dependencies', async () => {
      const preludes: PactPrelude[] = [
        { name: 'A', dependencies: ['B'] },
        { name: 'B', dependencies: ['C'] },
        { name: 'C', dependencies: ['A'] }
      ];

      await expect(deployPreludes({
        contractsDir: './contracts',
        preludes,
        client: mockClient
      })).rejects.toThrow('Circular dependency detected');
    });

    test('processes template inheritance', async () => {
      const baseTemplate = {
        namespace: 'free',
        version: '1.0.0'
      };

      const preludes: PactPrelude[] = [
        {
          name: 'base',
          content: '(namespace "{{namespace}}")',
          templateData: baseTemplate
        },
        {
          name: 'extended',
          content: '(namespace "{{namespace}}") (defconst V "{{version}}")',
          templateData: { ...baseTemplate, version: '2.0.0' }
        }
      ];

      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      await downloadAllPreludes({
        contractsDir: './contracts',
        preludes,
        client: mockClient
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('(defconst V "2.0.0")')
      );
    });

    test('handles large batch deployments', async () => {
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        name: `prelude-${i}`,
        path: `./prelude-${i}.pact`
      }));

      vi.mocked(mockFs.readFile).mockResolvedValue('(module test ...)');
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const deployments: string[] = [];
      mockClient.deployContract.mockImplementation(async (path) => {
        deployments.push(path);
        return { status: 'success' };
      });

      await deployPreludes({
        contractsDir: './contracts',
        preludes: largeBatch,
        client: mockClient,
        parallelDeploy: true,
        batchSize: 10
      });

      expect(deployments).toHaveLength(50);
    });
  });
});