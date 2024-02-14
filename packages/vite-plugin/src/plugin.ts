import { getNetworkConfig, getSerializableNetworkConfig, isLocalNetwork } from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxRuntime } from '@pact-toolbox/runtime';
import { Plugin } from 'vite';
import { preResolveOptions, resolveOptions } from './options';
import { IdParser, ResolvedOptions } from './types';
import { buildIdParser } from './utils';

interface VitePluginOptions {
  onReady?: (client: PactToolboxRuntime) => Promise<void>;
  startNetwork?: boolean;
}
export function pactVitePlugin({ onReady, startNetwork = true }: VitePluginOptions): Plugin {
  let requestParser: IdParser;
  let options!: ResolvedOptions;
  let viteConfig!: any;
  return {
    name: 'pact-toolbox:transformer',
    enforce: 'post',
    async config(config, configEnv) {
      options = await preResolveOptions(config, configEnv);
      return config;
    },
    async configureServer() {
      const network = getNetworkConfig(options.toolboxConfig);
      const runtime = new PactToolboxRuntime(options.toolboxConfig);
      if (options.isServe && !options.isTest && isLocalNetwork(network) && startNetwork) {
        await startLocalNetwork(options.toolboxConfig, {
          runtime,
          isStateless: false,
          enableProxy: true,
          logAccounts: true,
        });
      }

      if (options.isServe && !options.isTest && onReady) {
        await onReady(runtime);
      }
    },
    async configResolved(config) {
      viteConfig = config;
      options = resolveOptions(options, config);
      requestParser = buildIdParser(options);
      if (!options.isTest) {
        const networkConfig = getSerializableNetworkConfig(options.toolboxConfig);
        viteConfig.define = viteConfig.define || {};
        viteConfig.define['globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__'] = JSON.stringify(networkConfig);
      }
    },

    resolveId(source, importer, opts) {
      const ssr = !!opts?.ssr;
      const req = requestParser(source, ssr, importer);
      if (req) {
        return req.path;
      }
      return null;
    },

    async load(id, { ssr } = {}) {
      const req = requestParser(id, !!ssr);
      if (req) {
        // const content = await readFile(req.path, 'utf8');
        // const transformed = transformPactModule(content);
        // return transformed;
        return '';
      }
      return null;
    },
  };
}
