import type { PactToolboxConfigObj } from '@pact-toolbox/config';
import { resolveConfig } from '@pact-toolbox/config';
import { execAsync, logger } from '@pact-toolbox/utils';
import { join } from 'pathe';
import readdir from 'tiny-readdir-glob';

export async function runReplTests(config?: Required<PactToolboxConfigObj>) {
  if (!config) {
    config = await resolveConfig();
  }
  logger.start(`Running REPL tests`);
  const contractsDir = join(process.cwd(), config.contractsDir);
  const aborter = new AbortController();
  console.log(contractsDir);
  const result = await readdir(`${config.contractsDir}/**/*.repl`, {
    depth: 20,
    limit: 1_000_000,
    followSymlinks: true,
    ignore: ['prelude/**'],
    signal: aborter.signal,
  });
  for (const file of result.files) {
    logger.start(`Running REPL test for ${file}`);
    await execAsync(`pact ${file}`);
    logger.success(`REPL test for ${file} completed`);
  }
  logger.success(`REPL tests completed`);
}
