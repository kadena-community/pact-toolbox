import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'pathe';
import { PACT4X_REPO, PACT5X_REPO, PACT_ROOT_DIR } from './constants';
import { fetchPactGithubReleases } from './releaseInfo';
import { getInstalledPactVersion, isNightlyPactVersion, normalizeVersion } from './utils';

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

export interface InstalledPactVersion {
  version: string;
  path: string;
  isActive: boolean;
}
export async function listInstalledPactVersions() {
  const versions: InstalledPactVersion[] = [];
  const installedVersion = await getInstalledPactVersion();
  if (!existsSync(PACT_ROOT_DIR)) {
    return versions;
  }
  for (const f of await readdir(PACT_ROOT_DIR)) {
    const areNightly = isNightlyPactVersion(f) && installedVersion && isNightlyPactVersion(installedVersion);
    const isActive = installedVersion ? normalizeVersion(f).includes(normalizeVersion(installedVersion)) : false;
    versions.push({
      version: f,
      path: join(PACT_ROOT_DIR, f),
      isActive: areNightly || isActive,
    });
  }

  return versions;
}
