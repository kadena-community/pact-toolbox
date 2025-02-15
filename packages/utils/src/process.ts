import { exec, spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";

import { cleanupOnExit } from "./cleanup";
import { logger } from "./logger";

export interface RunBinOptions {
  silent?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  resolveOnStart?: boolean;
  resolveIf?: (data: string) => boolean;
}

export function runBin(
  bin: string,
  args: string[],
  options: RunBinOptions = {},
): Promise<ChildProcessWithoutNullStreams> {
  const { cwd = process.cwd(), silent = false, env = process.env, resolveOnStart = true, resolveIf } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env });

    let resolved = false;

    const handleStdout = (data: Buffer) => {
      const output = data.toString();
      if (!silent) {
        console.log(output);
      }
      if (resolveIf && !resolved && resolveIf(output)) {
        resolved = true;
        resolve(child);
      }
    };

    const handleStderr = (data: Buffer) => {
      const errorOutput = data.toString();
      logger.error(errorOutput);
    };

    const handleError = (err: Error) => {
      // Always log errors, regardless of the 'silent' flag
      logger.error("Child process error:", err);
      if (!resolved) {
        reject(err);
      }
    };

    const handleExit = (_code: number | null, _signal: NodeJS.Signals | null) => {
      if (!resolved) {
        resolved = true;
        resolve(child);
      }
    };

    child.stdout.on("data", handleStdout);
    child.stderr.on("data", handleStderr);
    child.on("error", handleError);
    child.on("exit", handleExit);

    // Register cleanup function for this child process
    cleanupOnExit(() => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    });

    if (resolveOnStart && !resolved) {
      resolved = true;
      resolve(child);
    }
  });
}

export async function killProcess(name: string): Promise<void> {
  switch (process.platform) {
    case "win32":
      exec("taskkill /F /IM " + name + ".exe /T");
      break;
    default: //Linux + Darwin
      exec("pkill -f " + name);
      break;
  }
}
