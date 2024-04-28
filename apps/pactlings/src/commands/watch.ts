import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const watchCommand = defineCommand({
  meta: {
    name: 'watch',
    description: 'Watch the exercise',
  },
  run: async () => {
    logger.error(`Watch command is not implemented yet.`);
  },
});
