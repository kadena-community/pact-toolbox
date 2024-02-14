import { resolveConfig } from '@pact-toolbox/config';
import { PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

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
      description: 'Network to use',
      required: false,
      default: 'local',
    },
  },
  run: async ({ args }) => {
    const { script, network, ...rest } = args;
    logger.start(`Running script ${script} on network ${network}`);
    const config = await resolveConfig();
    const client = new PactToolboxRuntime(config);
    await client.runScript(script, rest);
  },
});
