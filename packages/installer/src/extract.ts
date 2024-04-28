import { normalizeVersion, writeFileAtPath } from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rm } from 'node:fs/promises';
import { join } from 'pathe';
import { extract } from 'tar';
import { Open } from 'unzipper';

export interface ExtractTarballOptions {
  filter?: string[];
  executable?: string;
  writeMetadata?: boolean;
}
export async function extractTarball(
  tarball: string,
  dest: string,
  { executable = 'pact', filter, writeMetadata = true }: ExtractTarballOptions = {},
) {
  const isTarball = tarball.endsWith('.tar.gz');
  let version = dest.split('/').pop();
  version = version ? normalizeVersion(version) : undefined;
  const files: string[] = [];
  if (!existsSync(dest)) {
    await mkdir(dest, { recursive: true });
  }
  if (isTarball) {
    // Extract tarball
    await extract({
      file: tarball,
      cwd: dest,
      onentry: (entry) => {
        files.push(entry.path);
      },
      filter: (path) => (filter ? filter.some((f) => path.includes(f)) : true),
    });
  } else {
    // Extract zip file
    const directory = await Open.file(tarball);
    if (existsSync(dest)) {
      await rm(dest, { recursive: true });
    }
    await directory.extract({ path: dest, verbose: true });
    for (const entry of directory.files) {
      files.push(entry.path);
    }
  }
  // make it executable
  const binary = files.find((f) => f.endsWith(executable));
  if (binary) {
    await chmod(join(dest, binary), 0o755);
  }
  if (writeMetadata) {
    // write metadata file
    await writeFileAtPath(
      join(dest, 'metadata.json'),
      JSON.stringify(
        {
          version,
          binary,
          files,
        },
        null,
        2,
      ),
    );
  }
}
