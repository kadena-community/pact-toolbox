import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { InstalledPactVersionMetadata } from './activate';
import { PACT4X_REPO, PACT5X_REPO, PACT_ROOT_DIR } from './constants';
import { isActivePactVersion } from './install';
import { fetchPactGithubReleases } from './releaseInfo';
import { compareVersions, getCurrentPactVersion, isNightlyPactVersion, normalizeVersion } from './utils';

export async function listRemotePactVersions() {
  const releases = await fetchPactGithubReleases(PACT4X_REPO);
  const nightlyReleases = await fetchPactGithubReleases(PACT5X_REPO);
  return {
    [PACT4X_REPO]: releases.map((r) => ({
      version: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease || r.draft || r.tag_name.includes('development'),
    })),
    [PACT5X_REPO]: nightlyReleases.map((r) => ({
      version: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease || r.draft || r.tag_name.includes('development'),
    })),
  };
}

export interface InstalledPactVersion extends InstalledPactVersionMetadata {
  version: string;
  path: string;
  isActive: boolean;
}
export async function listInstalledPactVersions(includeNightly = true) {
  const versions: InstalledPactVersion[] = [];
  const currentVersion = await getCurrentPactVersion();
  if (!existsSync(PACT_ROOT_DIR)) {
    return versions;
  }
  for (const f of await readdir(PACT_ROOT_DIR)) {
    if (!includeNightly && isNightlyPactVersion(normalizeVersion(f))) {
      continue;
    }
    const areNightly = isNightlyPactVersion(f) && currentVersion && isNightlyPactVersion(currentVersion);
    const isActive = await isActivePactVersion(f, currentVersion);
    const path = join(PACT_ROOT_DIR, f);
    const metadata = await readFile(join(path, 'metadata.json'), 'utf-8')
      .then(JSON.parse)
      .catch(() => undefined);
    versions.push({
      path,
      version: f,
      isActive: areNightly || isActive,
      ...metadata,
    });
  }

  return versions.sort((a, b) => compareVersions(a.version, b.version));
}
