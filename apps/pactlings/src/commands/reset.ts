import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const resetCommand = defineCommand({
  meta: {
    name: 'reset',
    description: 'Reset the an exercise',
  },
  args: {},
  run: async () => {
    logger.error(`Reset command is not implemented yet.`);
  },
});
