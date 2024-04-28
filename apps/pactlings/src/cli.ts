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
    run: async () => (await import('./commands/run')).runCommand,
    list: async () => (await import('./commands/list')).listCommand,
    reset: async () => (await import('./commands/reset')).resetCommand,
    hint: async () => (await import('./commands/hint')).hintCommand,
  },
});

runMain(main);
