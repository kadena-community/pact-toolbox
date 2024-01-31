import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'pact-toolbox',
    description: 'Pact toolbox',
    version: '0.0.1',
  },
  subCommands: {
    install: async () => (await import('./commands/pact/install')).installCommand,
    start: async () => (await import('./commands/pact/start')).startCommand,
    upgrade: async () => (await import('./commands/pact/upgrade')).upgradeCommand,
    prelude: async () => (await import('./commands/pact/prelude')).preludeCommand,
    types: async () => (await import('./commands/types')).generateTypesCommand,
  },
});

runMain(main);
