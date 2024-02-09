import { resolveConfig } from '@pact-toolbox/config';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { defineCommand } from 'citty';

export const deployCommand = defineCommand({
  meta: {
    name: 'deploy',
    description: 'Deploy contract',
  },
  args: {
    contract: {
      type: 'positional',
      name: 'contract',
      description: 'Pact contract from the configured contracts directory',
      required: true,
    },
    config: {
      type: 'string',
      name: 'data',
      description: 'Config file for contract',
      required: true,
    },
    preflight: {
      type: 'boolean',
      name: 'preflight',
      description: 'Preflight deployment',
      defaultValue: false,
    },
  },
  run: async ({ args }) => {
    console.log(args);
    const { contract, preflight } = args;
    console.log('Deploying contract...', contract);
    const config = await resolveConfig();
    const client = new PactToolboxClient(config);
    await client.deployContract(contract, {});
  },
});
