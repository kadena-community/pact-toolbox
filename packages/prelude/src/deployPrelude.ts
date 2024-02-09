import type { DeployContractParams, PactToolboxClient } from '@pact-toolbox/runtime';
import { join } from 'node:path';
import { resolvePreludes } from './resolvePrelude';
import type { PactDependency } from './types';
import { CommonPreludeOptions } from './types';

export async function deployPactDependency(
  dep: PactDependency,
  client: PactToolboxClient,
  params: DeployContractParams = {},
) {
  const { group, requires, name } = dep;
  const contractPath = join('prelude', group || 'root', name);
  if (Array.isArray(requires)) {
    for (const req of requires) {
      await deployPactDependency(req, client, params);
    }
  }
  await client.deployContract(contractPath, params);
}

export async function deployPreludes(config: CommonPreludeOptions) {
  const { preludes: resolvedPreludes } = await resolvePreludes(config);
  await Promise.all(
    resolvedPreludes.map(async (p) => {
      if (await p.shouldDeploy(config.client)) {
        await p.deploy(config.client);
      }
    }),
  );
}
