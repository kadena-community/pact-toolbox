import type { PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { downloadTemplate } from 'giget';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePreludes } from './resolvePrelude';
import { CommonPreludeOptions, PactDependency, PactPrelude } from './types';
import { parseGitURI, renderTemplate } from './utils';

const tempDir = join(tmpdir(), 'pact-toolbox');
export async function downloadPactDependency(dep: PactDependency, preludeDir: string, preferOffline = true) {
  const dir = join(preludeDir, dep.group || 'root');
  let uri = dep.uri;
  const { subdir } = parseGitURI(dep.uri);
  const isSingleFile = subdir.endsWith('.pact');
  if (isSingleFile) {
    uri = uri.replace(subdir, subdir.split('/').slice(0, -1).join('/'));
  }
  const res = await downloadTemplate(uri, {
    dir: join(tempDir, dep.group || 'root'),
    cwd: process.cwd(),
    force: true,
    silent: true,
    preferOffline,
  });

  if (isSingleFile) {
    const fileName = subdir.split('/').pop() ?? dep.name;
    await cp(join(res.dir, fileName), join(dir, dep.name), { recursive: true });
  }

  if (dep.requires) {
    await Promise.all(dep.requires.map((dep) => downloadPactDependency(dep, preludeDir)));
  }
}

export async function downloadPrelude(prelude: PactPrelude, preludesDir: string, client: PactToolboxRuntime) {
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  await Promise.all(specs.map((dep) => downloadPactDependency(dep, preludesDir)));
  const installScript = await prelude.repl(client);
  const dir = join(preludesDir, prelude.name);
  await writeFile(join(dir, 'install.repl'), installScript);
  logger.success(`Downloaded ${prelude.name} prelude`);
}

export async function downloadPreludes(config: CommonPreludeOptions) {
  const { preludes, preludesDir } = await resolvePreludes(config);
  // clean preludes dir
  await rm(preludesDir, { recursive: true, force: true });

  // download preludes
  await Promise.all(preludes.map((prelude) => downloadPrelude(prelude, preludesDir, config.runtime)));

  // write accounts repl
  await mkdir(join(preludesDir, 'tools'), { recursive: true });
  const accountsTemplate = (await import('./accounts.handlebars')).template;
  await writeFile(
    join(preludesDir, 'tools/test-accounts.repl'),
    renderTemplate(accountsTemplate, {
      accounts: config.runtime.network.signers ?? [],
    }),
  );
  const initTemplate = (await import('./init.handlebars')).template;
  // write init repl
  await writeFile(
    join(preludesDir, 'init.repl'),
    renderTemplate(initTemplate, {
      preludes: preludes.map((p) => p.name),
      gasLimit: config.runtime.network.gasLimit || 1000000,
    }),
  );
}
