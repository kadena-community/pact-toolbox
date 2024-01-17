import { defineCommand } from 'citty';
import { join } from 'path';
import { PactToolboxClient } from '../../client';
import { resolveConfig } from '../../config';
import { logger } from '../../logger';
import { downloadPreludes } from '../../pact';

export const preludeCommand = defineCommand({
  meta: {
    name: 'download',
    description: 'Download configured preludes',
  },
  run: async () => {
    const config = await resolveConfig();
    const client = new PactToolboxClient(config);
    await downloadPreludes(config.pact, client);
    logger.box(
      `All preludes downloaded successfully 🎉\nYou can load them in repl from ${join(process.cwd(), config.pact.contractsDir ?? '', 'prelude', 'init.repl')}`,
    );
  },
});
