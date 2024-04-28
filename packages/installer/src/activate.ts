import { logger, normalizeVersion } from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { mkdir, readFile, symlink, unlink } from 'node:fs/promises';
import { join } from 'pathe';
import { KADENA_BIN_DIR, PACT_SYMLINK } from './constants';
import { listInstalledPactVersions } from './list';
import { PactRemoteAssetInfo } from './releaseInfo';

export interface InstalledPactVersionMetadata extends PactRemoteAssetInfo {
  version: string;
  pactExecutable: string;
  pactExecutablePath: string;
  files: string[];
}
export async function activatePactVersion(version: string, pactExecutable?: string) {
  const managedVersions = await listInstalledPactVersions();
  const installedVersion = managedVersions.find((v) => normalizeVersion(v.version).includes(normalizeVersion(version)));
  if (!installedVersion) {
    throw new Error(`${version} is not installed`);
  }
  const versionPath = installedVersion.path;
  const metadataPath = join(versionPath, 'metadata.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Could not find metadata for version ${version}`);
  }
  const metadata: InstalledPactVersionMetadata = await readFile(metadataPath, 'utf-8')
    .then(JSON.parse)
    .catch(() => {
      throw new Error(`Could not find metadata for version ${version}`);
    });
  pactExecutable = pactExecutable || metadata.pactExecutable;
  const pactBinary = pactExecutable.startsWith('/') ? pactExecutable : join(versionPath, pactExecutable);
  if (!existsSync(pactBinary)) {
    throw new Error(`Could not find binary ${pactBinary}`);
  }
  if (!existsSync(KADENA_BIN_DIR)) {
    await mkdir(KADENA_BIN_DIR, { recursive: true });
  }
  if (existsSync(PACT_SYMLINK)) {
    await unlink(PACT_SYMLINK);
  }
  await symlink(pactBinary, PACT_SYMLINK, 'file');
  logger.success(`Switched to pact version ${metadata.version}`);
}
