import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';
import { runScript } from '..';

export const runCommand = defineCommand({
  meta: {
    name: 'run',
    description: 'Run a script with the toolbox runtime',
  },
  args: {
    script: {
      type: 'positional',
      name: 'script',
      description: 'Script to run',
      required: true,
    },
    network: {
      type: 'string',
      name: 'network',
      alias: 'n',
      description: 'Network to use',
      required: false,
      default: 'local',
    },
  },
  run: async ({ args }) => {
    const { script, network, ...rest } = args;
    logger.start(`Running script ${script} on network ${network}`);
    await runScript(script, { network, args: rest });
  },
});
