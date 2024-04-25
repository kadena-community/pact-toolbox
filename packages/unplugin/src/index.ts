import { getSerializableNetworkConfig, resolveConfig } from '@pact-toolbox/config';
import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';
import { PLUGIN_NAME, startToolboxNetwork } from './core';
import type { Options } from './core/options';

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options) => {
  const toolboxConfig = resolveConfig();
  let isTest = process.env.NODE_ENV === 'test';
  let isServe = false;
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    vite: {
      async configureServer() {
        await startToolboxNetwork({ isServe, isTest }, await toolboxConfig, options!);
      },
      async configResolved(config) {
        // @ts-expect-error
        isTest = config.command === 'test' || isTest;
        isServe = config.command === 'serve';
        // @ts-expect-error
        if (!isTest) {
          const networkConfig = getSerializableNetworkConfig(await toolboxConfig);
          // @ts-expect-error
          config.define = config.define || {};
          config.define['globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__'] = JSON.stringify(networkConfig);
        }
      },
    },
    esbuild: {
      async setup(build) {
        const options = build.initialOptions;
        const networkConfig = getSerializableNetworkConfig(await toolboxConfig);
        options.define = options.define || {};
        options.define['globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__'] = JSON.stringify(networkConfig);
      },
    },
    async rspack(compiler) {
      const DefinePlugin = (await import('@rspack/core')).DefinePlugin;
      const networkConfig = getSerializableNetworkConfig(await toolboxConfig);
      const define = new DefinePlugin({
        'globalThis.__PACT_TOOLBOX_NETWORK_CONFIG__': JSON.stringify(networkConfig),
      });
      define.apply(compiler);
      if (compiler.options.mode === 'development') {
        await startToolboxNetwork({ isServe: true, isTest: false }, await toolboxConfig, options!);
      }
    },
  };
};

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export default unplugin;
