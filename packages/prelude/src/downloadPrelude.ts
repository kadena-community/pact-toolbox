import type { PactToolboxClient } from '@pact-toolbox/runtime';
import { logger, writeFileAtPath } from '@pact-toolbox/utils';
import { downloadTemplate } from 'giget';
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'pathe';
import { resolvePreludes } from './resolvePrelude';
import type { CommonPreludeOptions, PactDependency, PactPrelude } from './types';
import { getBaseRepo, parseGitURI, renderTemplate, sortPreludesNames } from './utils';

export function groupByBaseRepo(specs: PactDependency[]) {
  const groups: Record<string, PactDependency[]> = {};
  for (const spec of specs) {
    const repo = getBaseRepo(spec.uri);
    if (!groups[repo]) {
      groups[repo] = [];
    }
    groups[repo].push(spec);
  }
  return groups;
}

const tempDir = join(process.cwd(), '.pact-toolbox/tmp');
export async function downloadGitRepo(dest: string, uri: string, force = false, preferOffline = false) {
  if (!existsSync(dest) || force) {
    await downloadTemplate(uri, {
      dir: dest,
      cwd: process.cwd(),
      force: true,
      silent: false,
      preferOffline,
    });
  }
}
export async function downloadPactDependency(dep: PactDependency, preludeDir: string) {
  const dir = join(preludeDir, dep.group || 'root');
  let uri = dep.uri;
  const { subdir, repo, provider, ref } = parseGitURI(dep.uri);
  const isSingleFile = subdir.endsWith('.pact');
  if (isSingleFile) {
    uri = `${provider}:${repo}#${ref}`;
  }
  try {
    const clonePath = join(tempDir, dep.group || 'root');
    await downloadGitRepo(clonePath, uri, false);
    if (isSingleFile) {
      const fileName = subdir.split('/').pop() ?? dep.name;
      await cp(join(clonePath, fileName), join(dir, dep.name), {
        recursive: true,
      });
    }
  } catch (e) {
    throw new Error(`Failed to download ${dep.name} from ${uri}, ${e}`);
  }

  if (dep.requires) {
    await Promise.all(dep.requires.map((dep) => downloadPactDependency(dep, preludeDir)));
  }
}

export async function downloadPrelude(
  prelude: PactPrelude,
  preludesDir: string,
  client: PactToolboxClient,
  allPreludes: PactPrelude[] = [],
  downloaded: Set<string> = new Set(),
) {
  if (downloaded.has(prelude.name)) {
    return;
  }
  if (prelude.requires) {
    for (const dep of prelude.requires) {
      const found = allPreludes.find((p) => p.name === dep);
      if (!found) {
        throw new Error(`Prelude ${dep} not found`);
      }

      if (downloaded.has(dep)) {
        continue;
      }
      await downloadPrelude(found, preludesDir, client, allPreludes, downloaded);
    }
  }
  const preludeDir = join(preludesDir, prelude.name);
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  const groups = groupByBaseRepo(specs);
  for (const [repo, specs] of Object.entries(groups)) {
    const clonePath = join(tempDir, prelude.name);
    await downloadGitRepo(clonePath, repo, false);
    for (const spec of specs) {
      const dir = join(preludeDir, spec.group || 'root');
      const { subdir } = parseGitURI(spec.uri);
      await cp(join(clonePath, subdir), join(dir, spec.name), {
        recursive: true,
      });
    }
  }
  const installScript = await prelude.repl(client);
  await writeFileAtPath(join(preludeDir, 'install.repl'), installScript);
  downloaded.add(prelude.name);
  logger.success(`Downloaded ${prelude.name} prelude`);
}

export async function downloadPreludes(config: CommonPreludeOptions) {
  const downloaded = new Set<string>();
  const { preludes, preludesDir } = await resolvePreludes(config);
  // clean temp dir
  await rm(tempDir, { recursive: true, force: true });
  // clean preludes dir
  await rm(preludesDir, { recursive: true, force: true });

  // download preludes
  for (const prelude of preludes) {
    await downloadPrelude(prelude, preludesDir, config.client, preludes, downloaded);
  }

  // write accounts repl
  await mkdir(join(preludesDir, 'tools'), { recursive: true });
  const accountsTemplate = (await import('./accounts.handlebars')).template;
  await writeFileAtPath(
    join(preludesDir, 'tools/test-accounts.repl'),
    renderTemplate(accountsTemplate, {
      accounts: config.client.network.signers ?? [],
    }),
  );
  const initTemplate = (await import('./init.handlebars')).template;
  const preludeNames = sortPreludesNames(preludes);
  await writeFileAtPath(
    join(preludesDir, 'init.repl'),
    renderTemplate(initTemplate, {
      preludes: preludeNames,
      gasLimit: config.client.network.meta?.gasLimit || 1000000,
    }),
  );
}

export function isPreludeDownloaded(prelude: PactPrelude, preludesDir: string) {
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  const paths = specs.map((spec) => join(preludesDir, prelude.name, spec.group || 'root', spec.name));
  return paths.every((p) => existsSync(p));
}

export async function shouldDownloadPreludes(config: CommonPreludeOptions) {
  const { preludes, preludesDir } = await resolvePreludes(config);
  return preludes.some((p) => !isPreludeDownloaded(p, preludesDir));
}
