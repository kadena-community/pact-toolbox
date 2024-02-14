import type { DeployContractParams, PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { join } from 'node:path';
import { resolvePreludes } from './resolvePrelude';
import type { PactDependency } from './types';
import { CommonPreludeOptions } from './types';

export async function deployPactDependency(
  dep: PactDependency,
  runtime: PactToolboxRuntime,
  params: DeployContractParams = {},
) {
  const { group, requires, name } = dep;
  const contractPath = join('prelude', group || 'root', name);
  if (Array.isArray(requires)) {
    for (const req of requires) {
      await deployPactDependency(req, runtime, params);
    }
  }
  await runtime.deployContract(contractPath, params);
}

export async function deployPreludes(config: CommonPreludeOptions) {
  const { preludes: resolvedPreludes } = await resolvePreludes(config);
  for (const p of resolvedPreludes) {
    if (await p.shouldDeploy(config.runtime)) {
      await p.deploy(config.runtime);
      logger.success(`Deployed prelude: ${p.name}`);
    }
  }
}
