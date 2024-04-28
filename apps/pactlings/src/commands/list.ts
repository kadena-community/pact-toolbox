import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';

export const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List all exercises',
  },
  args: {},
  run: async () => {
    logger.error(`List command is not implemented yet.`);
  },
});
