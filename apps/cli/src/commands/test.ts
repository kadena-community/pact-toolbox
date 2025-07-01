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
    trace: {
      type: "boolean",
      name: "trace",
      alias: "t",
      description: "Enable trace output for REPL tests",
      required: false,
      default: false,
    },
    coverage: {
      type: "boolean",
      name: "coverage",
      alias: "c",
      description: "Enable coverage reporting for REPL tests",
      required: false,
      default: false,
    },
    verbose: {
      type: "boolean",
      name: "verbose",
      alias: "v",
      description: "Enable verbose output",
      required: false,
      default: false,
    },
    bail: {
      type: "boolean",
      name: "bail",
      alias: "b",
      description: "Stop on first test failure",
      required: false,
      default: false,
    },
    silent: {
      type: "boolean",
      name: "silent",
      alias: "s",
      description: "Silent mode - suppress output",
      required: false,
      default: false,
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();

    if (args.repl) {
      await runReplTests(config, {
        watch: args.watch,
        trace: args.trace,
        coverage: args.coverage,
        verbose: args.verbose,
        bail: args.bail,
        silent: args.silent,
      });
    }

    if (args.js) {
      await runVitest({ watch: args.watch });
    }
  },
});
