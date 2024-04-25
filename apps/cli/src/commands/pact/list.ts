import { listInstalledPactVersions, listRemotePactVersions } from '@pact-toolbox/installer';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List all available pact versions',
  },
  args: {
    remote: {
      type: 'boolean',
      name: 'remote',
      description: 'List all available pact versions from remote',
      default: false,
    },
  },
  run: async ({ args }) => {
    if (args.remote) {
      const remoteVersions = await listRemotePactVersions();
      if (Object.keys(remoteVersions).length === 0) {
        logger.info('No versions found');
        return;
      }
      for (const [repo, versions] of Object.entries(remoteVersions)) {
        logger.info('Available versions for', repo);
        for (const { prerelease, publishedAt, version } of versions) {
          logger.info(`- ${version} ${prerelease ? '(prerelease)' : ''} published at ${publishedAt}`);
        }
      }
    } else {
      const versions = await listInstalledPactVersions();
      if (versions.length >= 1) {
        logger.info(`Found managed versions`);
        for (const { version, path, isActive } of versions) {
          logger.info(`- ${version} installed at ${path} ${isActive ? '(active)' : ''}`);
        }
      } else {
        logger.info(`No managed versions found`);
      }
    }
  },
});
