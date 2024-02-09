import { resolveConfig } from '@pact-toolbox/config';
import { execAsync, logger } from '@pact-toolbox/utils';
import { defineCommand } from 'citty';
import { readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const NAMESPACE_PLACEHOLDER = '{{NAMESPACE}}';

export async function embedNamespace(file: string, namespace: string) {
  const code = await readFile(file, 'utf8');
  const newCode = code.replaceAll(NAMESPACE_PLACEHOLDER, namespace);
  const tmpPath = file.replace('.pact', '.tmp.pact');
  await writeFile(tmpPath, newCode);
  return tmpPath;
}

export async function generateTypes(path: string, namespace?: string) {
  // const ns = namespace ?? (await createPrincipalNamespace());
  // const tmpPath = await embedNamespace(path, ns);
  await execAsync(`npx pactjs contract-generate --file ${path}`);
  // // cleanup
  // await rm(tmpPath);
}

export async function generateContractTypes(contract: string) {
  await execAsync(
    `npx pactjs contract-generate --contract=${contract} --api=https://api.testnet.chainweb.com/chainweb/0.0/testnet04/chain/0/pact`,
  );
}

export const generateTypesCommand = defineCommand({
  meta: {
    name: 'generate-types',
    description: 'Generate types for contract',
  },
  args: {
    contract: {
      type: 'string',
      name: 'contract',
      alias: 'c',
      description: 'Deployed contract name',
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();
    const { contract = ['coin'] } = args;
    const contracts = Array.isArray(contract) ? contract : contract?.split(',');
    if (contract.length > 0) {
      logger.info('Generating types for contract...', contracts.join(', '));
      await Promise.all(contracts.map((c) => generateContractTypes(c)));
    }
    const contractsDir = config.pact.contractsDir ?? join(process.cwd(), 'contracts');
    const files = readdirSync(contractsDir).filter((f) => f.endsWith('.pact'));
    if (files.length > 0) {
      logger.info('Generating types for ...', files.join(', '));
      await Promise.all(files.map((f) => generateTypes(join(contractsDir, f))));
    }
    logger.info('Done!');
  },
});
