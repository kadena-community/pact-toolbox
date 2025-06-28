import { defineCommand } from "citty";
import { startVitest } from "vitest/node";

import { resolveConfig } from "@pact-toolbox/config";
import { runReplTests } from "@pact-toolbox/test";

export interface RunVitestOptions {
  mode?: "test" | "benchmark";
  watch?: boolean;
  filters?: string[];
}
export async function runVitest({ mode = "test", watch = false, filters = [] }: RunVitestOptions = {}) {
  const vitest = await startVitest(mode, filters, {
    watch,
    run: !watch,
    testTimeout: 10000,
  });
  if (!watch) {
    await vitest?.exit();
  }
}

export const testCommand = defineCommand({
  meta: {
    name: "test",
    description: "Run tests using the configured test runner and network",
  },
  args: {
    watch: {
      type: "boolean",
      name: "watch",
      alias: "w",
      description: "Watch for changes and re-run tests",
      required: false,
      default: false,
    },
    repl: {
      type: "boolean",
      name: "repl",
      alias: "r",
      description: "Run REPL tests",
      required: false,
      default: true,
    },
    js: {
      type: "boolean",
      name: "js",
      alias: "j",
      description: "Run JS tests",
      required: false,
      default: true,
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();

    if (args.repl) {
      await runReplTests(config, { watch: args.watch });
    }

    if (args.js) {
      await runVitest({ watch: args.watch });
    }
  },
});
