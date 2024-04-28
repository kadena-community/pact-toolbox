import { upgradePact } from '@pact-toolbox/installer';
import { defineCommand } from 'citty';

export const upgradeCommand = defineCommand({
  meta: {
    name: 'upgrade',
    description: 'Upgrade Pact',
  },
  args: {
    nightly: {
      type: 'boolean',
      name: 'nightly',
      description: 'Upgrade to the nightly version',
      required: false,
    },
  },
  run: async ({ args }) => {
    await upgradePact(args.nightly);
  },
});
