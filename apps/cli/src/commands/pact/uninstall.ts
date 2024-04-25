import { removePactVersion } from '@pact-toolbox/installer';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const uninstallCommand = defineCommand({
  meta: {
    name: 'uninstall',
    description: 'Uninstall a pact version',
  },
  args: {
    version: {
      type: 'positional',
      name: 'version',
      description: 'Pact version to switch to',
      required: true,
    },
  },
  run: async ({ args }) => {
    await removePactVersion(args.version);
    logger.success(`Uninstalled pact version ${args.version}`);
  },
});
