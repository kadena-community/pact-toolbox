/* eslint-disable no-unused-vars */
import { resolveConfig } from '@pact-toolbox/config';
import path from 'node:path';
import { ConfigEnv, ResolvedConfig, UserConfig, normalizePath } from 'vite';
import { ResolvedOptions } from './types';

export async function preResolveOptions(viteUserConfig: UserConfig, viteEnv: ConfigEnv): Promise<ResolvedOptions> {
  const toolboxConfig = await resolveConfig();

  return {
    root: resolveViteRoot(viteUserConfig),
    isBuild: viteEnv.command === 'build',
    isServe: viteEnv.command === 'serve',
    isDebug: process.env.DEBUG != null,
    isProduction: viteEnv.mode === 'production',
    isTest: viteEnv.mode === 'test',
    toolboxConfig,
  };
}

export function resolveOptions(preResolveOptions: ResolvedOptions, viteConfig: ResolvedConfig): ResolvedOptions {
  const defaultOptions = {
    hot: viteConfig.isProduction
      ? false
      : {
          partialAccept: !!viteConfig.experimental?.hmrPartialAccept,
        },
    compilerOptions: {
      dev: !viteConfig.isProduction,
    },
  };
  const extraOptions = {
    root: viteConfig.root,
    isProduction: viteConfig.isProduction,
  };
  const merged = {
    ...defaultOptions,
    ...preResolveOptions,
    ...extraOptions,
  };

  return merged;
}

function resolveViteRoot(viteConfig: UserConfig): string {
  return normalizePath(viteConfig.root ? path.resolve(viteConfig.root) : process.cwd());
}
