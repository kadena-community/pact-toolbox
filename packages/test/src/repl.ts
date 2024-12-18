import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { join } from "pathe";
import readdir from "tiny-readdir-glob";

import { resolveConfig } from "@pact-toolbox/config";
import { execAsync, logger } from "@pact-toolbox/utils";

export async function runReplTests(config?: Required<PactToolboxConfigObj>): Promise<void> {
  if (!config) {
    config = await resolveConfig();
  }
  logger.start(`Running REPL tests`);
  const cwd = join(process.cwd(), config.contractsDir);
  const aborter = new AbortController();
  const result = await readdir(`${config.contractsDir}/**/*.repl`, {
    cwd,
    depth: 20,
    limit: 1_000_000,
    followSymlinks: true,
    ignore: ["prelude/**"],
    signal: aborter.signal,
  });
  for (const file of result.files) {
    logger.start(`Running REPL test for ${file}`);
    await execAsync(`pact ${file}`);
    logger.success(`REPL test for ${file} completed`);
  }
  logger.success(`REPL tests completed`);
}
