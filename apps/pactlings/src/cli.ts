#!/usr/bin/env tsx
import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'pact-toolbox',
    description: 'Pact toolbox',
    version: '0.0.1',
  },
  subCommands: {
    watch: async () => (await import('./commands/watch')).watchCommand,
  },
});

runMain(main);
