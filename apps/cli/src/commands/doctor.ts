import { getPactInstallationInfo, installPact } from '@pact-toolbox/installer';
import { isDockerInstalled, logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check if your system is ready to develop with Pact',
  },
  run: async () => {
    // check if pact is installed
    const { isInstalled, latestVersion } = await getPactInstallationInfo();
    if (!isInstalled) {
      logger.warn(`Pact is not installed!`);
      const answer = await logger.prompt(`Would you like to install Pact ${latestVersion}?`, {
        type: 'confirm',
        default: true,
      });
      if (answer === true) {
        await installPact({
          version: latestVersion,
        });
      }
    }
    // check if docker is installed
    const isDockerOk = isDockerInstalled();
    if (!isDockerOk) {
      logger.warn(
        `We could not establish a connection to docker daemon! make sure it is installed and running on your system.`,
      );
    }
    logger.box('Your system is ready to develop with Pact!');
  },
});
