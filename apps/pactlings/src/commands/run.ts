import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const runCommand = defineCommand({
  meta: {
    name: 'run',
    description: 'Run the exercise',
  },
  args: {},
  run: async ({}) => {
    logger.error(`Run command is not implemented yet.`);
  },
});
