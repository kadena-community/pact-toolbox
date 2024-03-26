import { upgradePact } from '@pact-toolbox/installer';
import { defineCommand } from 'citty';

export const upgradeCommand = defineCommand({
  meta: {
    name: 'upgrade',
    description: 'Upgrade Pact',
  },
  run: upgradePact,
});
