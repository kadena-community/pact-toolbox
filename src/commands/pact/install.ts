import { defineCommand } from 'citty';
import { resolveConfig } from '../../config';
import { logger } from '../../logger';
import { getLatestReleaseVersion, installPact } from '../../pact/pactInstaller';

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
    version = version ?? config.pact.version;
    if (!version && latest) {
      logger.info('Pact version not specified, installing latest');
      version = await getLatestReleaseVersion();
    }

    await installPact(version);
  },
});
