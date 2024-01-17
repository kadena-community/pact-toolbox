import { exec } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createPrincipalNamespace } from './ns';
import { defineCommand } from 'citty';

const execAsync = promisify(exec);
const NAMESPACE_PLACEHOLDER = '{{NAMESPACE}}';

export async function embedNamespace(file: string, namespace: string) {
  const code = await readFile(file, 'utf8');
  const newCode = code.replaceAll(NAMESPACE_PLACEHOLDER, namespace);
  const tmpPath = file.replace('.pact', '.tmp.pact');
  await writeFile(tmpPath, newCode);
  return tmpPath;
}

export async function generateTypes(path: string, namespace?: string) {
  const ns = namespace ?? (await createPrincipalNamespace());
  console.log('Using namespace:', ns);
  const tmpPath = await embedNamespace(path, ns);
  await execAsync(`npx pactjs contract-generate --file ${tmpPath}`);
  // cleanup
  await rm(tmpPath);
}

export async function generateContractTypes(contract: string) {
  await execAsync(
    `npx pactjs contract-generate --contract=${contract} --api=${getApiHost({
      chainId: env.APP_CHAIN_ID,
      networkId: env.APP_NETWORK_ID,
    })}`,
  );
}

export const generateTypesCommand = defineCommand({
  meta: {
    name: 'generate-types',
    description: 'Generate types for contract',
  },
  args: {
    file: {
      type: 'positional',
      name: 'file',
      required: false,
      description: 'Contract file',
    },
    contract: {
      type: 'string',
      name: 'contract',
      alias: 'c',
      description: 'Deployed contract name',
    },
    namespace: {
      type: 'string',
      name: 'namespace',
      alias: 'n',
      required: false,
      description: 'Namespace',
    },
  },
  run: async ({ args }) => {
    const { file = [], namespace, contract = [] } = args;
    const contracts = Array.isArray(contract) ? contract : contract?.split(',') ?? [];
    const files = Array.isArray(file) ? file : file.split(',') ?? [];
    console.log('contracts', contracts);
    if (contract.length > 0) {
      console.log('Generating types for contract...', contracts.join(', '));
      await Promise.all(contracts.map((c) => generateContractTypes(c)));
    }

    if (files.length > 0) {
      console.log('Generating types for ...', files.join(', '));
      await Promise.all(files.map((f) => generateTypes(f, namespace)));
    }
  },
});
