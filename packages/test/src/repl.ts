import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { join } from "pathe";
import readdir from "tiny-readdir-glob";
import chalk from "chalk";
import ora from "ora";
import { cpus } from "node:os";
import { resolveConfig } from "@pact-toolbox/config";
import { execAsync } from "@pact-toolbox/utils";

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

export async function runReplTests(config?: Required<PactToolboxConfigObj>): Promise<void> {
  const startTime = Date.now();
  if (!config) {
    config = await resolveConfig();
  }

  const spinner = ora("Finding REPL tests").start();

  const cwd = join(process.cwd(), config.contractsDir);
  const aborter = new AbortController();
  const result = await readdir(`**/*.repl`, {
    cwd,
    depth: 20,
    limit: 1_000_000,
    followSymlinks: true,
    ignore: ["prelude/**"],
    signal: aborter.signal,
  });

  const testFiles = result.files;

  if (testFiles.length === 0) {
    spinner.succeed("No REPL tests found.");
    return;
  }

  spinner.info(`${testFiles.length} tests found.`);
  spinner.start(`Running REPL tests...`);

  let completed = 0;

  const runTest = async (file: string): Promise<TestResult> => {
    const testStartTime = Date.now();
    const cleanedFile = file.replace(cwd, "").substring(1);
    try {
      await execAsync(`pact -t ${file}`);
      const duration = Date.now() - testStartTime;
      completed++;
      spinner.text = `[${completed}/${testFiles.length}] Running REPL tests... (${cleanedFile})`;
      return { filePath: cleanedFile, status: "passed", duration };
    } catch (error) {
      completed++;
      spinner.text = `[${completed}/${testFiles.length}] Running REPL tests... (${cleanedFile})`;
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

  spinner.stop();
  const totalDuration = Date.now() - startTime;

  const passedTests = allResults.filter((r) => r.status === "passed");
  const failedTests = allResults.filter((r) => r.status === "failed");

  console.log("\n");

  for (const result of allResults) {
    if (result.status === "passed") {
      console.log(`${chalk.green.bold("PASS")} ${result.filePath} ${chalk.gray(`(${result.duration}ms)`)}`);
    } else {
      console.log(`${chalk.red.bold("FAIL")} ${result.filePath} ${chalk.gray(`(${result.duration}ms)`)}`);
    }
  }

  if (failedTests.length > 0) {
    console.log(`\n${chalk.red.bold("Failed Tests:")}`);
    for (const test of failedTests) {
      console.log(`\n${chalk.red.bold("●")} ${test.filePath}`);
      const errorMessage = test.error?.message ?? "Unknown error";
      const cleanedError = errorMessage.includes("Command failed:")
        ? (errorMessage.split("Command failed:")[1]?.trim() ?? "")
        : errorMessage;
      console.log(`${chalk.red(cleanedError)}`);
    }
  }

  console.log("\n");
  console.log(chalk.bold("REPL Test-runner Summary"));
  console.log(
    `  ${chalk.bold("Test Suites:")} ${
      failedTests.length > 0 ? `${chalk.red.bold(`${failedTests.length} failed`)}, ` : ""
    }${chalk.green.bold(`${passedTests.length} passed`)}, ${allResults.length} total`,
  );
  console.log(`  ${chalk.bold("Time:")}        ${(totalDuration / 1000).toFixed(2)}s`);
  console.log("\n");

  if (failedTests.length > 0) {
    process.exit(1);
  }
}
