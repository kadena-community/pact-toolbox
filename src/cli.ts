import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'pact-toolbox',
    description: 'Pact toolbox',
    version: '0.0.1',
  },
  subCommands: {
    pact: async () => (await import('./commands/pact')).pactCommand,
  },
});

runMain(main);
