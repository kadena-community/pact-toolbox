import { defineCommand } from "citty";

import { initToolbox } from "@pact-toolbox/init";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Init kadena toolbox in your current project",
  },
  args: {
    cwd: {
      type: "string",
      description: "path to cwd",
      default: process.cwd(),
    },
    contractsDir: {
      type: "string",
      description: "path to contract folder",
      default: "pact",
    },
  },
  run: async ({ args }) => initToolbox(args),
});
