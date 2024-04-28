import { activatePactVersion, isActivePactVersion, isNightlyPactVersion } from '@pact-toolbox/installer';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const useCommand = defineCommand({
  meta: {
    name: 'use',
    description: 'Switch between installed pact versions',
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
    const isNightly = isNightlyPactVersion(args.version);
    const isActive = await isActivePactVersion(args.version);
    if (isActive && !isNightly) {
      logger.info(`Already using pact version ${args.version}`);
      return;
    }
    await activatePactVersion(args.version);
  },
});
