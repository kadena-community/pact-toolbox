import { compareVersions, execAsync, getInstalledPactVersion, logger } from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'pathe';
import { activatePactVersion } from './activate';
import { KADENA_BIN_DIR, PACT4X_REPO, PACT5X_REPO, PACT_ROOT_DIR, Z3_URL } from './constants';
import { extractTarball } from './extract';
import {
  downloadTarball,
  fetchLatestPactGithubRelease,
  fetchPactGithubReleases,
  getPactDownloadInfo,
} from './releaseInfo';
import { PactInstallCommonOptions } from './types';

export async function getPactInstallationInfo({ version, nightly }: PactInstallCommonOptions = {}) {
  const latestStable = await fetchLatestPactGithubRelease(nightly ? PACT5X_REPO : PACT4X_REPO);
  const latestVersion = latestStable.tag_name;
  if (!version) {
    version = latestVersion;
  }
  const installedVersion = await getInstalledPactVersion();
  const info = {
    isInstalled: false,
    isMatching: false,
    isOlder: false,
    isNewer: false,
    installedVersion,
    latestVersion,
  };

  if (!installedVersion) {
    return info;
  }

  if (!version) {
    return {
      ...info,
      isInstalled: true,
    };
  }

  const comparison = compareVersions(version, installedVersion);
  if (comparison === 0) {
    return {
      ...info,
      isInstalled: true,
      isMatching: true,
    };
  }

  if (comparison === 1) {
    return {
      ...info,
      isInstalled: true,
      isOlder: true,
    };
  }

  return {
    ...info,
    isInstalled: true,
    isNewer: true,
  };
}

export async function versionCheckMiddleware() {
  const { isInstalled, isMatching, isNewer, installedVersion, latestVersion } = await getPactInstallationInfo();

  if (!isInstalled) {
    logger.error(`Pact is not installed, please install it first using \`pact-toolbox pact install\``);
    process.exit(1);
  }

  if (!isMatching) {
    logger.info(
      `Pact version ${latestVersion} is released, please upgrade using \`pact-toolbox pact upgrade\` or \`pact-toolbox pact install ${latestVersion}\``,
    );
  }

  if (isNewer) {
    logger.warn(`Pact version ${installedVersion} is newer than latest released version ${latestVersion}!`);
  }
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
    writeMetadata: false,
    filter: ['z3'],
  });
  logger.success(`Z3 installed successfully 🎉`);
}

export async function installPact({ version, nightly = false }: PactInstallCommonOptions = {}) {
  const repo = nightly ? PACT5X_REPO : PACT4X_REPO;
  const releases = await fetchPactGithubReleases(repo);
  if (!version) {
    version = (await fetchLatestPactGithubRelease(repo)).tag_name;
  }
  const { downloadUrl, releaseVersion } = await getPactDownloadInfo(releases, version, nightly);
  const { isMatching, isInstalled } = await getPactInstallationInfo({
    version: releaseVersion,
    nightly,
  });
  const versionDir = join(PACT_ROOT_DIR, releaseVersion);
  if (isInstalled && isMatching) {
    logger.info(`Pact version ${releaseVersion} is already installed at ${versionDir}`);
    return;
  }
  logger.start(`Installing Pact version ${releaseVersion}`);
  const path = await downloadTarball(downloadUrl);
  await extractTarball(path, versionDir, {
    executable: 'pact',
  });

  if (!(await isZ3Installed())) {
    await installZ3();
  }
  logger.success(`Pact installed successfully 🎉`);
  if (!isInstalled) {
    await activatePactVersion(releaseVersion);
  }
  logger.box(`Make sure it's in your shell PATH \n\`export PATH="$PATH:${KADENA_BIN_DIR}"\``);
}

export async function removePactVersion(version: string) {
  const versionDir = join(PACT_ROOT_DIR, version);
  const exists = existsSync(versionDir);
  if (!exists) {
    throw new Error(`Pact version ${version} not found`);
  }
  await rm(versionDir, { recursive: true });
}
