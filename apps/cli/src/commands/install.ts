import { resolveConfig } from '@pact-toolbox/config';
import { getLatestReleaseVersion, installPact } from '@pact-toolbox/installer';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const installCommand = defineCommand({
  meta: {
    name: 'install',
    description: 'Install pact version from github releases',
  },
  args: {
    version: {
      type: 'positional',
      name: 'version',
      description: 'Pact version to install, e.g. 4.10.0 if not specified will use `config.pact.version` or latest',
      required: false,
    },

    latest: {
      type: 'boolean',
      name: 'latest',
      description: 'force install latest pact version',
      default: false,
    },
  },
  run: async ({ args }) => {
    let { version, latest } = args;
    const config = await resolveConfig();
    version = version ?? config.pactVersion;
    if (!version && latest) {
      logger.info('Pact version not specified, installing latest');
      version = await getLatestReleaseVersion();
    }

    await installPact(version);
  },
});
