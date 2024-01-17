import { join } from 'node:path';
import { DeployContractParams, PactToolboxClient } from '../client';
import { PactConfig, PactDependency } from '../config';
import { resolvePreludes } from './resolvePrelude';

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

export async function deployPreludes(config: PactConfig, client: PactToolboxClient) {
  const { preludes } = await resolvePreludes(config);
  return Promise.all(
    preludes.map(async (p) => {
      if (await p.shouldDeploy(client)) {
        await p.deploy(client);
      }
    }),
  );
}
