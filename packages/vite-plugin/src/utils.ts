import { existsSync } from 'node:fs';
import path from 'node:path';
import { createFilter, normalizePath } from 'vite';
import { Arrayable, IdParser, ResolvedOptions } from './types.ts';

const VITE_FS_PREFIX = '/@fs/';
const IS_WINDOWS = process.platform === 'win32';

function createVirtualImportId(
  filename: string,
  root: string,
  // type: import('../types/id.d.ts').SvelteQueryTypes,
): string {
  const parts = ['pact', `type=module`];
  // if (type === 'style') {
  //   parts.push('lang.css');
  // }
  if (existsInRoot(filename, root)) {
    filename = root + filename;
  } else if (filename.startsWith(VITE_FS_PREFIX)) {
    filename = IS_WINDOWS
      ? filename.slice(VITE_FS_PREFIX.length) // remove /@fs/ from /@fs/C:/...
      : filename.slice(VITE_FS_PREFIX.length - 1); // remove /@fs from /@fs/home/user
  }
  return `${filename}?${parts.join('&')}`;
}

function resolvePath(filename: string, root: string, importer?: string): string {
  if (importer) {
    // Resolve the absolute path of the source relative to the importer
    return normalizePath(path.resolve(path.dirname(importer), filename));
  }

  return normalizePath(path.resolve(root, filename));
}

export function parseId(originalId: string) {
  const [pathId, query] = originalId.split('?');
  const queryStr = query || '';
  return {
    originalId,
    pathId,
    query: queryStr ? `?${query}` : '',
    params: new URLSearchParams(queryStr),
  };
}

function existsInRoot(filename: string, root: string): boolean {
  if (filename.startsWith(VITE_FS_PREFIX)) {
    return false; // vite already tagged it as out of root
  }
  return existsSync(root + filename);
}

function buildFilter(
  include: Arrayable<string> | undefined,
  exclude: Arrayable<string> | undefined,
  extensions: string[],
): (filename: string) => boolean {
  const rollupFilter = createFilter(include, exclude, { resolve: false });
  return (filename) => extensions.some((ext) => filename.endsWith(ext));
}

export function buildIdParser(options: ResolvedOptions): IdParser {
  const { root } = options;
  const normalizedRoot = normalizePath(root);
  // const filter = buildFilter(include, exclude, ['.pact']);
  const filter = buildFilter(undefined, undefined, ['.pact']);
  return (id, ssr, importer, timestamp = Date.now()) => {
    const { query, pathId, params } = parseId(id);
    if (filter(pathId)) {
      return {
        id,
        filename: pathId,
        query,
        params,
        timestamp,
        path: resolvePath(pathId, normalizedRoot, importer),
        normalizedFilename: normalizePath(pathId),
        ssr,
      };
    }
  };
}

export function arraify<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
