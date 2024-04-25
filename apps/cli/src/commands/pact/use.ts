import { switchPactVersion } from '@pact-toolbox/installer';
import { getInstalledPactVersion, logger, normalizeVersion } from '@pact-toolbox/utils';
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
    let currentVersion = await getInstalledPactVersion();
    const isNightly =
      currentVersion?.includes('5.0') || currentVersion?.includes('nightly') || currentVersion?.includes('dev');
    if (currentVersion && normalizeVersion(currentVersion) === normalizeVersion(args.version) && !isNightly) {
      logger.info(`Already using pact version ${args.version}`);
      return;
    }
    await switchPactVersion(args.version);
  },
});
