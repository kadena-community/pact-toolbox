import { resolveConfig } from '@pact-toolbox/config';
import { installPact } from '@pact-toolbox/installer';
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
    nightly: {
      type: 'boolean',
      name: 'nightly',
      description: 'install latest nightly pact version',
      default: false,
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();
    args.version = args.version ?? config.pactVersion;
    if (!args.version) {
      if (args.nightly) {
        logger.info('Checking latest nightly pact version');
      } else {
        logger.info('Pact version not specified, checking latest');
      }
    } else {
      logger.info(`Checking pact version ${args.version}`);
    }
    await installPact(args.version && !args.latest ? args.version : undefined, args.nightly);
  },
});
