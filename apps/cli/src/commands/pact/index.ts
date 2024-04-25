import { defineCommand } from 'citty';

export const pactCommand = defineCommand({
  meta: {
    name: 'pact',
    description: 'Manage Pact installation',
  },
  subCommands: {
    install: async () => (await import('./install')).installCommand,
    list: async () => (await import('./list')).listCommand,
    upgrade: async () => (await import('./upgrade')).upgradeCommand,
    use: async () => (await import('./use')).useCommand,
    uninstall: async () => (await import('./uninstall')).uninstallCommand,
  },
});
