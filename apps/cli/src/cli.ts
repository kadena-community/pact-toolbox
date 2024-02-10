#!/usr/bin/env tsx
import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'pact-toolbox',
    description: 'Pact toolbox',
    version: '0.0.1',
  },
  subCommands: {
    doctor: async () => (await import('./commands/doctor')).doctorCommand,
    init: async () => (await import('./commands/init')).initCommand,
    install: async () => (await import('./commands/install')).installCommand,
    start: async () => (await import('./commands/start')).startCommand,
    upgrade: async () => (await import('./commands/upgrade')).upgradeCommand,
    prelude: async () => (await import('./commands/prelude')).preludeCommand,
    types: async () => (await import('./commands/types')).generateTypesCommand,
  },
});

runMain(main);
