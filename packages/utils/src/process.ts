import { spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import find from "find-process";

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

export interface ProcessQuery {
  name?: string;
  port?: number | string;
  pid?: number;
}

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
}
export async function findProcess(query: ProcessQuery): Promise<ProcessInfo[]> {
  const { name, port, pid } = query;
  if (name) {
    return find("name", name) ?? [];
  }
  if (port) {
    return find("port", port) ?? [];
  }
  if (pid) {
    return find("pid", pid) ?? [];
  }
  return [];
}

export async function killProcess(query: ProcessQuery): Promise<void> {
  const procs = await findProcess(query);
  if (procs.length > 0) {
    const proc = procs.find((p) => p.name === query.name) ?? procs[0]!;
    process.kill(proc.pid);
  }
}

export async function isProcessRunning(query: ProcessQuery): Promise<boolean> {
  const procs = await findProcess(query);
  return procs.length > 0;
}
