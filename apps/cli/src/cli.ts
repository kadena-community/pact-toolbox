#!/usr/bin/env tsx
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "pact-toolbox",
    description: "Pact toolbox",
    version: "0.0.1",
  },
  subCommands: {
    doctor: async () => (await import("./commands/doctor")).doctorCommand,
    init: async () => (await import("./commands/init")).initCommand,
    start: async () => (await import("./commands/start")).startCommand,
    prelude: async () => (await import("./commands/prelude")).preludeCommand,
    run: async () => (await import("./commands/run")).runCommand,
    test: async () => (await import("./commands/test")).testCommand,
    generate: async () => (await import("./commands/generate")).generateCommand,
  },
});

runMain(main);
