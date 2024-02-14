import { resolveConfig } from '@pact-toolbox/config';
import { downloadPreludes } from '@pact-toolbox/prelude';
import { PactToolboxRuntime } from '@pact-toolbox/runtime';
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
    const runtime = new PactToolboxRuntime(config);
    await downloadPreludes({
      runtime,
      contractsDir: config.contractsDir ?? 'contracts',
      preludes: config.preludes ?? [],
    });
    logger.box(
      `All preludes downloaded successfully 🎉\nYou can load them in repl from ${join(process.cwd(), config.contractsDir ?? '', 'prelude', 'init.repl')}`,
    );
  },
});
