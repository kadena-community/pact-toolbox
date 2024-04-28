import { logger } from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { mkdir, readFile, symlink, unlink } from 'node:fs/promises';
import { join } from 'pathe';
import { KADENA_BIN_DIR, PACT_ROOT_DIR, PACT_SYMLINK } from './constants';

export interface PactMetadata {
  version: string;
  binary: string;
  files: string[];
}
export async function activatePactVersion(version: string, binary?: string) {
  const versionDir = join(PACT_ROOT_DIR, version);
  const metadataPath = join(versionDir, 'metadata.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Could not find metadata for version ${version}`);
  }
  const metadata: PactMetadata = await readFile(metadataPath, 'utf-8')
    .then(JSON.parse)
    .catch(() => {
      throw new Error(`Could not find metadata for version ${version}`);
    });
  binary = binary || metadata.binary;
  const pactBinary = binary.startsWith('/') ? binary : join(versionDir, binary);
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
  logger.success(`Switched to pact version ${version}`);
}
