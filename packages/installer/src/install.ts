import {
  compareVersions,
  execAsync,
  getCurrentPactVersion,
  logger,
  normalizeVersion,
  writeFileAtPath,
} from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'pathe';
import { activatePactVersion } from './activate';
import { KADENA_BIN_DIR, PACT4X_REPO, PACT5X_REPO, PACT_ROOT_DIR, Z3_URL } from './constants';
import { updateShellProfileScript } from './env';
import { extractTarball } from './extract';
import { InstalledPactVersion, listInstalledPactVersions } from './list';
import {
  PactRemoteAssetInfo,
  downloadTarball,
  fetchLatestPactGithubRelease,
  fetchPactGithubReleases,
  findPactRelease,
  getPactRemoteAssetInfo,
} from './releaseInfo';
import { PactInstallCommonOptions } from './types';
import { isNightlyPactVersion } from './utils';

export function areVersionMatching(version1: string, version2: string) {
  if (isNightlyPactVersion(version1) && isNightlyPactVersion(version2)) {
    return true;
  }

  if (isNightlyPactVersion(version1) || isNightlyPactVersion(version2)) {
    return false;
  }

  return (
    normalizeVersion(version1).includes(normalizeVersion(version2)) ||
    normalizeVersion(version2).includes(normalizeVersion(version1)) ||
    version2 === version1
  );
}

export async function isActivePactVersion(version: string, currentVersion?: string) {
  if (!currentVersion) {
    currentVersion = await getCurrentPactVersion();
  }
  if (!currentVersion) {
    return false;
  }
  return areVersionMatching(currentVersion, version);
}

export async function isPactVersionInstalled(version: string) {
  const currentVersion = await getCurrentPactVersion();
  const installedVersions = await listInstalledPactVersions();
  return installedVersions.some((v) => areVersionMatching(v.version, version)) || !!currentVersion;
}

export interface PactInstallationInfo {
  foundAnyVersion: boolean;
  updatedAt: string;
  isNightlyVersion: boolean;
  isInstalled: boolean;
  currentVersion?: string;
  latestVersion: string;
  isManagedVersion: boolean;
  isCurrentVersion: boolean;
  isUpToDate: boolean;
  versionInfo: InstalledPactVersion;
}

export async function getPactInstallationInfo({
  version,
  nightly,
}: PactInstallCommonOptions = {}): Promise<PactInstallationInfo> {
  const latestRelease = await fetchLatestPactGithubRelease(nightly ? PACT5X_REPO : PACT4X_REPO);
  const latestVersion = latestRelease.tag_name;
  if (!version) {
    version = latestVersion;
  }
  const currentVersion = await getCurrentPactVersion();
  const isManagedVersion = await execAsync('which pact')
    .then((o) => o.stdout.trim() === join(KADENA_BIN_DIR, 'pact'))
    .catch(() => false);
  const managedVersions = await listInstalledPactVersions(nightly);
  const isCurrentVersion = await isActivePactVersion(version, currentVersion);
  const isInstalled = isCurrentVersion || managedVersions.some((mv) => areVersionMatching(mv.version, version));
  const isNightlyVersion = !!currentVersion && isNightlyPactVersion(currentVersion);
  const foundManagedVersion = managedVersions.find((mv) => areVersionMatching(mv.version, version))!;
  let isUpToDate = false;
  if (latestRelease.assets.length > 0) {
    const latestUpdate = latestRelease.assets[0].updated_at;
    const currentUpdate = foundManagedVersion?.updatedAt;
    if (currentUpdate && latestUpdate && new Date(currentUpdate) >= new Date(latestUpdate)) {
      isUpToDate = true;
    }
  } else if (currentVersion && compareVersions(currentVersion, latestVersion) >= 0) {
    isUpToDate = true;
  }

  return {
    foundAnyVersion: !!currentVersion || managedVersions.length > 0,
    updatedAt: foundManagedVersion?.updatedAt ?? latestRelease.assets[0].updated_at,
    isNightlyVersion,
    isInstalled,
    currentVersion,
    latestVersion,
    isManagedVersion,
    isCurrentVersion,
    isUpToDate,
    versionInfo: foundManagedVersion ?? {},
  };
}

export async function isZ3Installed() {
  return execAsync('z3 --version')
    .then(() => true)
    .catch(() => false);
}

export async function installZ3() {
  logger.start(`Installing Z3`);
  const z3Path = await downloadTarball(Z3_URL);
  await extractTarball(z3Path, KADENA_BIN_DIR, {
    executable: 'z3',
    filter: ['z3'],
  });
  logger.success(`Z3 installed successfully 🎉`);
}

export async function writeVersionMetadata(
  asset: PactRemoteAssetInfo,
  pactExecutable: string = 'pact',
  files: string[] = [],
) {
  const dest = join(PACT_ROOT_DIR, asset.version);
  // write metadata file
  await writeFileAtPath(
    join(dest, 'metadata.json'),
    JSON.stringify(
      {
        ...asset,
        files,
        pactExecutable,
        pactExecutablePath: join(dest, pactExecutable),
      },
      null,
      2,
    ),
  );
}

export interface InstallPactOptions extends PactInstallCommonOptions {
  activate?: boolean;
  force?: boolean;
}

export async function installPact({
  version,
  nightly = false,
  force = false,
  activate = false,
}: InstallPactOptions = {}): Promise<InstalledPactVersion> {
  const repo = nightly ? PACT5X_REPO : PACT4X_REPO;
  const releases = await fetchPactGithubReleases(repo);
  if (!version) {
    version = (await fetchLatestPactGithubRelease(repo)).tag_name;
  } else {
    version = (await findPactRelease({ version, nightly })).tag_name;
  }
  const assetInfo = await getPactRemoteAssetInfo(releases, version, nightly);
  const { isInstalled, currentVersion, versionInfo } = await getPactInstallationInfo({
    version: assetInfo.version,
    nightly,
  });
  const versionDir = join(PACT_ROOT_DIR, assetInfo.version);
  if (isInstalled && !force) {
    logger.info(`Pact version ${assetInfo.version} is already installed at ${versionDir}`);
    return versionInfo;
  }
  logger.start(`Installing Pact version ${assetInfo.version}`);
  const path = await downloadTarball(assetInfo.downloadUrl);
  const { binary, files } = await extractTarball(path, versionDir, {
    executable: 'pact',
  });
  await writeVersionMetadata(assetInfo, binary, files);

  if (!(await isZ3Installed())) {
    await installZ3();
  }
  logger.success(`Pact installed successfully 🎉`);
  if (!currentVersion || activate) {
    await activatePactVersion(assetInfo.version);
  }
  await updateShellProfileScript();

  return {
    ...versionInfo,
    pactExecutablePath: join(versionDir, binary ?? 'pact'),
    pactExecutable: binary ?? 'pact',
    files,
    version: assetInfo.version,
    updatedAt: assetInfo.updatedAt,
    createdAt: assetInfo.createdAt,
    downloadUrl: assetInfo.downloadUrl,
    isActive: Boolean(activate || !currentVersion || versionInfo?.isActive),
    path: versionDir,
  };
}

export async function removePactVersion(version: string) {
  const versionDir = join(PACT_ROOT_DIR, version);
  const exists = existsSync(versionDir);
  if (!exists) {
    throw new Error(`Pact version ${version} not found`);
  }
  await rm(versionDir, { recursive: true });
}
