import { defineCommand } from 'citty';
import { resolveConfig } from '../../config';
import { startPactLocalServer } from '../../pact';
import { versionCheckMiddleware } from '../../pact/pactInstaller';

export const startCommand = defineCommand({
  meta: {
    name: 'start',
    description: 'Start pact local server `pact -s`',
  },
  run: async () => {
    await versionCheckMiddleware();
    const config = await resolveConfig();
    await startPactLocalServer(config.pact);
  },
});
