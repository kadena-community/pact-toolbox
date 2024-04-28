import { logger } from '@pact-toolbox/utils';
import { getPactInstallationInfo, installPact } from './install';
import { getLatestPactReleaseInfo } from './releaseInfo';

export async function isPactUpToDate(nightly = false) {
  const latestRelease = await getLatestPactReleaseInfo(nightly);
  const { isInstalled, isMatching } = await getPactInstallationInfo({
    version: latestRelease.tag_name,
    nightly,
  });
  return isInstalled && isMatching;
}

export async function upgradePact(nightly = false) {
  const { isInstalled, isMatching, isNewer, installedVersion, latestVersion } = await getPactInstallationInfo();

  if (isInstalled && isMatching) {
    logger.info(`Pact is already up to date at version ${installedVersion}`);
    return;
  }

  if (isNewer) {
    logger.info(`Pact version ${installedVersion} is newer than ${latestVersion}`);
    return;
  }

  if (!isInstalled) {
    logger.start(`Pact is not installed, Installing version ${latestVersion}`);
  } else {
    logger.start(`Upgrading Pact from ${installedVersion} to ${latestVersion}`);
  }
  await installPact({
    version: latestVersion,
    nightly,
  });
  logger.box(`Pact upgraded successfully 🎉`);
}
