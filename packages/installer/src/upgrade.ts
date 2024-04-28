import { formatDate, logger } from '@pact-toolbox/utils';
import { getPactInstallationInfo, installPact } from './install';
import { getLatestPactReleaseInfo } from './releaseInfo';

export async function isPactUpToDate(nightly = false) {
  const latestRelease = await getLatestPactReleaseInfo(nightly);
  const { isInstalled, isUpToDate } = await getPactInstallationInfo({
    version: latestRelease.tag_name,
    nightly,
  });
  return isInstalled && isUpToDate;
}

export async function upgradePact(nightly = false) {
  const { foundAnyVersion, isUpToDate, latestVersion, currentVersion, isCurrentVersion, updatedAt, isNightlyVersion } =
    await getPactInstallationInfo({
      nightly,
    });

  if (isUpToDate && isCurrentVersion) {
    logger.info(
      `Pact is already up to date at version ${currentVersion}${isNightlyVersion ? '-nightly' : ''} (${formatDate(updatedAt)}), no need to upgrade.`,
    );
    return;
  }

  if (isUpToDate && !isCurrentVersion) {
    logger.info(
      `Pact is already up to date at version ${currentVersion}, but not the active version run 'pact-toolbox use ${latestVersion}' to activate it.`,
    );
    return;
  }

  if (!foundAnyVersion) {
    logger.start(`Pact is not installed, Installing version ${latestVersion}`);
  } else {
    logger.start(`Upgrading Pact from ${currentVersion} to ${latestVersion}`);
  }
  await installPact({
    version: latestVersion,
    nightly,
    force: nightly,
    activate: true,
  });
  logger.box(`Pact upgraded successfully 🎉`);
}
