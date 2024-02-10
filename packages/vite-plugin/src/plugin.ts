import { Plugin } from 'vite';
import { IdParser, ResolvedOptions } from './types';
import { buildIdParser } from './utils';

import { getCurrentNetworkConfig, getNetworkRpcUrl, isLocalNetwork } from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { preResolveOptions, resolveOptions } from './options';

interface VitePluginOptions {
  onReady?: (client: PactToolboxClient) => Promise<void>;
}
export function pactVitePlugin({ onReady }: VitePluginOptions): Plugin {
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

    async configResolved(config) {
      viteConfig = config;
      options = resolveOptions(options, config);
      requestParser = buildIdParser(options);
      const network = getCurrentNetworkConfig(options.toolboxConfig);
      const pickedConfig = {
        networkId: network.networkId,
        chainId: network.chainId,
        rpcUrl: getNetworkRpcUrl(network),
        gasLimit: network.gasLimit,
        gasPrice: network.gasPrice,
        ttl: network.ttl,
        senderAccount: network.senderAccount,
        signers: network.signers,
        type: network.type,
        keysets: network.keysets,
        name: network.name,
      };
      viteConfig.define = viteConfig.define || {};
      viteConfig.define['globalThis.__pactToolboxNetwork__'] = JSON.stringify(pickedConfig);
      const client = new PactToolboxClient(options.toolboxConfig);
      if (options.isServe && !options.isTest && isLocalNetwork(network)) {
        await startLocalNetwork(options.toolboxConfig, {
          client,
          logAccounts: true,
          // silent: false,
        });
      }

      if (options.isServe && !options.isTest && onReady) {
        await onReady(client);
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
