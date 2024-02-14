import { resolveConfig } from '@pact-toolbox/config';
import { runReplTests } from '@pact-toolbox/test';
import { defineCommand } from 'citty';
import { startVitest } from 'vitest/node';

export interface RunVitestOptions {
  mode?: 'test' | 'benchmark';
  watch?: boolean;
  filters?: string[];
}
export async function runVitest({ mode = 'test', watch = false, filters = [] }: RunVitestOptions = {}) {
  const vitest = await startVitest(mode, filters, {
    watch,
    run: !watch,
    testTimeout: 10000,
  });
  if (!watch) {
    vitest?.exit();
  }
}

export const testCommand = defineCommand({
  meta: {
    name: 'test',
    description: 'Run tests using the configured test runner and network',
  },
  args: {
    watch: {
      type: 'boolean',
      name: 'watch',
      alias: 'w',
      description: 'Watch for changes and re-run tests',
      required: false,
      default: false,
    },
    repl: {
      type: 'boolean',
      name: 'repl',
      alias: 'r',
      description: 'Run  REPL tests only',
      required: false,
      default: false,
    },
  },
  run: async ({ args }) => {
    const { repl, watch } = args;
    const config = await resolveConfig();
    await runReplTests(config);
    if (repl) {
      return;
    }
    await runVitest({ watch });
  },
});
