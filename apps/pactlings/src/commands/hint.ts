import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const hintCommand = defineCommand({
  meta: {
    name: 'hint',
    description: 'Give a hint about an exercise',
  },
  args: {},
  run: async () => {
    logger.error(`Hint command is not implemented yet.`);
  },
});
