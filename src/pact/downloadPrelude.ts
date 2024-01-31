import { downloadTemplate } from 'giget';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PactToolboxClient } from '../client';
import { PactConfig, PactDependency, PactPrelude } from '../config';
import { logger } from '../logger';
import { renderTemplate } from '../utils';
import { resolvePreludes } from './resolvePrelude';
import { parseGitURI } from './utils';

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
  logger.info(`Downloaded ${dep.name} contract`);
}

export async function downloadPrelude(prelude: PactPrelude, preludesDir: string, client: PactToolboxClient) {
  logger.start(`Downloading ${prelude.name} prelude`);
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  await Promise.all(specs.map((dep) => downloadPactDependency(dep, preludesDir)));
  const installScript = await prelude.repl(client);
  const dir = join(preludesDir, prelude.name);
  await writeFile(join(dir, 'install.repl'), installScript);
  logger.success(`Downloaded ${prelude.name} prelude`);
}

export async function downloadPreludes(config: PactConfig, client: PactToolboxClient) {
  const { preludes, preludesDir } = await resolvePreludes(config);
  // clean preludes dir
  await rm(preludesDir, { recursive: true, force: true });

  // download preludes
  await Promise.all(preludes.map((prelude) => downloadPrelude(prelude, preludesDir, client)));

  // write accounts repl
  const __dirname = new URL('.', import.meta.url).pathname;
  await mkdir(join(preludesDir, 'tools'), { recursive: true });
  await writeFile(
    join(preludesDir, 'tools/test-accounts.repl'),
    renderTemplate((await import('./accounts.handlebars')).template, {
      accounts: client.network.signers ?? [],
    }),
  );

  // write init repl
  await writeFile(
    join(preludesDir, 'init.repl'),
    renderTemplate((await import('./accounts.handlebars')).template, {
      preludes: preludes.map((p) => p.name),
      gasLimit: client.network.gasLimit || 1000000,
    }),
  );
}
