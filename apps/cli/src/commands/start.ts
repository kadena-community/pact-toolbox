import { resolveConfig } from '@pact-toolbox/config';
import { startLocalNetwork } from '@pact-toolbox/network';
import { defineCommand } from 'citty';
import { versionCheckMiddleware } from '../../../../packages/installer/src/pactInstaller';

export const startCommand = defineCommand({
  meta: {
    name: 'start',
    description: 'Start pact local server `pact -s`',
  },
  args: {
    network: {
      type: 'positional',
      name: 'version',
      description: 'Pact version to install, e.g. 4.10.0 if not specified will use `config.pact.version` or latest',
      required: false,
      default: 'local',
    },
    silent: {
      type: 'boolean',
      name: 'silent',
      alias: 's',
      description: 'Silence logs',
      required: false,
      default: false,
    },
  },
  run: async ({ args }) => {
    await versionCheckMiddleware();
    const config = await resolveConfig();
    const { network, silent } = args;
    config.defaultNetwork = network || config.defaultNetwork;
    const _process = await startLocalNetwork(config, {
      silent,
      logAccounts: true,
    });
  },
});