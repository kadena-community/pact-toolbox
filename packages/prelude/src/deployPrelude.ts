import type { DeployContractParams, PactToolboxClient } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { join } from 'pathe';
import { downloadPrelude, isPreludeDownloaded } from './downloadPrelude';
import { resolvePreludes } from './resolvePrelude';
import type { CommonPreludeOptions, PactDependency } from './types';
import { sortPreludes } from './utils';

export async function deployPactDependency(
  dep: PactDependency,
  preludeDir: string,
  client: PactToolboxClient,
  params: DeployContractParams = {},
) {
  const { group, requires, name } = dep;
  const contractPath = join(preludeDir, group || 'root', name);
  if (Array.isArray(requires)) {
    for (const req of requires) {
      await deployPactDependency(req, preludeDir, client, params);
    }
  }
  await client.deployContract(contractPath, params);
}

export async function deployPreludes(config: CommonPreludeOptions, downloadIfMissing = true) {
  const { preludes: resolvedPreludes, preludesDir } = await resolvePreludes(config);
  const sorted = sortPreludes(resolvedPreludes);
  for (const p of sorted) {
    if (!isPreludeDownloaded(p, preludesDir)) {
      if (downloadIfMissing) {
        await downloadPrelude(p, preludesDir, config.client, sorted);
      } else {
        throw new Error(`Prelude ${p.name} not found, make sure to download it first`);
      }
    }
    if (await p.shouldDeploy(config.client)) {
      await p.deploy(config.client);
      logger.success(`Deployed prelude: ${p.name}`);
    }
  }
}
