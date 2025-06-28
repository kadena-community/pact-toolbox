import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { join } from "pathe";
import { cpus } from "node:os";
import { resolveConfig } from "@pact-toolbox/config";
import { execAsync, glob, startSpinner, updateSpinner, stopSpinner, boxMessage, table } from "@pact-toolbox/node-utils";
import { error as errorUI, info as infoUI } from "@pact-toolbox/node-utils";

interface TestResult {
  filePath: string;
  status: "passed" | "failed";
  error?: Error;
  duration: number;
}

async function runWithConcurrency<T, R>(
  items: T[],
  iteratorFn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  const running: Promise<void>[] = [];
  let index = 0;

  async function run() {
    if (index >= items.length) {
      return;
    }
    const i = index++;
    const item = items[i];
    if (!item) return;

    const promise = iteratorFn(item).then((result) => {
      results[i] = result;
    });

    running.push(promise);

    if (running.length >= concurrency) {
      await Promise.race(running);
    }

    await promise.finally(() => {
      const promiseIndex = running.indexOf(promise);
      if (promiseIndex > -1) {
        running.splice(promiseIndex, 1);
      }
    });

    await run();
  }

  const initialRuns = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(initialRuns);
  await Promise.all(running);

  return results;
}

interface RunReplTestsOptions {
  watch?: boolean;
}
export async function runReplTests(
  config?: Required<PactToolboxConfigObj>,
  _options?: RunReplTestsOptions,
): Promise<void> {
  const startTime = Date.now();
  if (!config) {
    config = await resolveConfig();
  }

  startSpinner("Finding REPL tests");

  const cwd = join(process.cwd(), config.contractsDir);
  const aborter = new AbortController();
  const result = await glob(`**/*.repl`, {
    cwd,
    depth: 20,
    limit: 1_000_000,
    followSymlinks: true,
    ignore: ["prelude/**"],
    signal: aborter.signal,
  });

  const testFiles = result.files;

  if (testFiles.length === 0) {
    stopSpinner(true, "No REPL tests found.");
    return;
  }

  stopSpinner(true, `Found ${testFiles.length} REPL test file${testFiles.length > 1 ? 's' : ''}`);

  infoUI("repl-test", `${testFiles.length} tests found.`);
  updateSpinner(`Running REPL tests...`);

  let completed = 0;

  const runTest = async (file: string): Promise<TestResult> => {
    const testStartTime = Date.now();
    const cleanedFile = file.replace(cwd, "").substring(1);
    try {
      await execAsync(`pact -t ${file}`);
      const duration = Date.now() - testStartTime;
      completed++;
      updateSpinner(`[${completed}/${testFiles.length}] Running REPL tests... (${cleanedFile})`);
      return { filePath: cleanedFile, status: "passed", duration };
    } catch (error) {
      completed++;
      updateSpinner(`[${completed}/${testFiles.length}] Running REPL tests... (${cleanedFile})`);
      const duration = Date.now() - testStartTime;
      return {
        filePath: cleanedFile,
        status: "failed",
        error: error as Error,
        duration,
      };
    }
  };

  const concurrency = Math.max(1, cpus().length - 1);
  const allResults = await runWithConcurrency(testFiles, runTest, concurrency);

  stopSpinner();
  const totalDuration = Date.now() - startTime;

  const passedTests = allResults.filter((r) => r.status === "passed");
  const failedTests = allResults.filter((r) => r.status === "failed");

  infoUI("repl-test", "");

  // Create results table
  const tableHeaders = ["Status", "File", "Duration"];
  const tableRows = allResults.map(result => [
    result.status === "passed" ? "PASS" : "FAIL",
    result.filePath,
    `${result.duration}ms`
  ]);

  table(tableHeaders, tableRows);

  if (failedTests.length > 0) {
    infoUI("repl-test", "\nFailed Tests:");
    for (const test of failedTests) {
      errorUI("repl-test", test.filePath);
      const errorMessage = test.error?.message ?? "Unknown error";
      const cleanedError = errorMessage.includes("Command failed:")
        ? (errorMessage.split("Command failed:")[1]?.trim() ?? "")
        : errorMessage;
      infoUI("repl-test", `  ${cleanedError}`);
    }
  }

  infoUI("repl-test", "");
  boxMessage("REPL Test-runner Summary", [
    `Test Suites: ${failedTests.length > 0 ? `${failedTests.length} failed, ` : ""}${passedTests.length} passed, ${allResults.length} total`,
    `Time: ${(totalDuration / 1000).toFixed(2)}s`
  ]);
  infoUI("repl-test", "");

  if (failedTests.length > 0) {
    process.exit(1);
  }
}
