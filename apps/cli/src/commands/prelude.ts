import { resolveConfig } from '@pact-toolbox/config';
import { downloadPreludes } from '@pact-toolbox/prelude';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';
import { join } from 'path';

export const preludeCommand = defineCommand({
  meta: {
    name: 'download',
    description: 'Download configured preludes',
  },
  run: async () => {
    const config = await resolveConfig();
    const client = new PactToolboxClient(config);
    await downloadPreludes({
      client,
      contractsDir: config.pact.contractsDir ?? 'contracts',
      preludes: config.pact.preludes ?? [],
    });
    logger.box(
      `All preludes downloaded successfully 🎉\nYou can load them in repl from ${join(process.cwd(), config.pact.contractsDir ?? '', 'prelude', 'init.repl')}`,
    );
  },
});
