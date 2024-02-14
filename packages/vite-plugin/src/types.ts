import { PactToolboxConfigObj } from '@pact-toolbox/config';
import { ViteDevServer } from 'vite';

export type Arrayable<T> = T | T[];

export interface PactRequest {
  id: string;
  filename: string;
  normalizedFilename: string;
  params: URLSearchParams;
  query: string;
  timestamp: number;
  path: string;
  ssr: boolean;
}
export interface RequestQuery {
  // our own
  pact?: boolean;
  sourcemap?: boolean;
  // compilerOptions?: Pick<
  // 	CompileOptions,
  // 	'generate' | 'dev' | 'css' | 'hydratable' | 'customElement' | 'immutable' | 'enableSourcemap'
  // >;
  // vite specific
  url?: boolean;
  raw?: boolean;
  direct?: boolean;
}

export type IdParser = (id: string, ssr: boolean, importer?: string, timestamp?: number) => PactRequest | undefined;

export interface ResolvedOptions {
  root: string;
  isBuild: boolean;
  isServe: boolean;
  isDebug: boolean;
  isTest: boolean;
  isProduction: boolean;
  server?: ViteDevServer;
  toolboxConfig: Required<PactToolboxConfigObj>;
}
