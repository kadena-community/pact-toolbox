import { defineCommand } from 'citty';

export const pactCommand = defineCommand({
  meta: {
    name: 'pact',
    description: `Commands to install, upgrade and start pact local server`,
  },
  subCommands: {
    install: async () => (await import('./install')).installCommand,
    start: async () => (await import('./start')).startCommand,
    upgrade: async () => (await import('./upgrade')).upgradeCommand,
    prelude: async () => (await import('./prelude')).preludeCommand,
  },
});
