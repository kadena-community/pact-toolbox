import { defineCommand } from 'citty';
import { upgradePact } from '../../pact/pactInstaller';

export const upgradeCommand = defineCommand({
  meta: {
    name: 'upgrade',
    description: 'Upgrade Pact',
  },
  run: upgradePact,
});
