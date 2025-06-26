import { exec, spawn } from "child_process";
import type { ChildProcess, ChildProcessWithoutNullStreams } from "child_process";

import { cleanupOnExit } from "./cleanup";
import { logger } from "./logger";
import { execAsync } from "./helpers";

/**
 * Options for running a binary/executable.
 */
export interface RunBinOptions {
  /** Whether to suppress stdout output (default: false) */
  silent?: boolean;
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables for the process */
  env?: NodeJS.ProcessEnv;
  /** Whether to resolve the promise immediately when process starts (default: true) */
  resolveOnStart?: boolean;
  /** Custom condition to resolve the promise based on stdout output */
  resolveIf?: (data: string) => boolean;
}

/**
 * Runs a binary/executable with advanced control over process lifecycle.
 * Automatically registers cleanup handlers to ensure child processes are terminated on exit.
 * 
 * @param bin - The binary/executable to run
 * @param args - Arguments to pass to the binary
 * @param options - Configuration options
 * @returns Promise resolving to the child process
 * 
 * @example
 * ```typescript
 * // Run a simple command
 * const child = await runBin('node', ['--version']);
 * 
 * // Run with custom resolution condition
 * const server = await runBin('node', ['server.js'], {
 *   resolveIf: (output) => output.includes('Server started on port'),
 *   silent: true
 * });
 * ```
 */
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

/**
 * Kills all processes matching the given name.
 * Cross-platform implementation using taskkill on Windows and pkill on Unix-like systems.
 * 
 * @param name - The process name to kill (without .exe extension on Windows)
 * 
 * @example
 * ```typescript
 * await killProcess('node');
 * await killProcess('my-server');
 * ```
 */
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

/**
 * Information about a running process.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Command name or executable path */
  command: string;
  /** Process status */
  status: "running" | "stopped";
}

/**
 * Options for spawning a simple process.
 */
export interface SimpleProcessOptions {
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables for the process */
  env?: NodeJS.ProcessEnv;
  /** How to handle stdio streams (default: 'pipe') */
  stdio?: "pipe" | "inherit" | "ignore";
  /** Whether to run the process detached from the parent (default: false) */
  detached?: boolean;
  /** Timeout in milliseconds (not currently implemented) */
  timeout?: number;
}

/**
 * Spawns a long-running process with simple monitoring.
 * Automatically registers cleanup handlers to ensure child processes are terminated on exit.
 * 
 * @param command - The command to execute
 * @param args - Arguments to pass to the command
 * @param options - Configuration options
 * @returns The spawned child process
 * 
 * @example
 * ```typescript
 * // Spawn a simple process
 * const child = spawnProcess('npm', ['run', 'dev']);
 * 
 * // Spawn with custom options
 * const server = spawnProcess('node', ['server.js'], {
 *   cwd: '/path/to/project',
 *   env: { ...process.env, PORT: '3000' }
 * });
 * 
 * // Handle process output
 * child.stdout?.on('data', (data) => {
 *   console.log(`Output: ${data}`);
 * });
 * ```
 */
export function spawnProcess(command: string, args: string[] = [], options: SimpleProcessOptions = {}): ChildProcess {
  const { cwd = process.cwd(), env = process.env, stdio = "pipe", detached = false } = options;

  const child = spawn(command, args, {
    cwd,
    env,
    stdio,
    detached,
    shell: true,
  });

  // Register cleanup
  cleanupOnExit(() => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  });

  return child;
}

/**
 * Checks if a process is running by PID.
 * Uses signal 0 to test process existence without actually sending a signal.
 * 
 * @param pid - The process ID to check
 * @returns true if the process is running, false otherwise
 * 
 * @example
 * ```typescript
 * if (isProcessRunning(12345)) {
 *   console.log('Process 12345 is still running');
 * }
 * ```
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets basic process information by PID.
 * Cross-platform implementation using tasklist on Windows and ps on Unix-like systems.
 * 
 * @param pid - The process ID to get information for
 * @returns Process information or null if process not found
 * 
 * @example
 * ```typescript
 * const info = await getProcessInfo(process.pid);
 * if (info) {
 *   console.log(`Process ${info.pid}: ${info.command} (${info.status})`);
 * }
 * ```
 */
export async function getProcessInfo(pid: number): Promise<ProcessInfo | null> {
  if (!isProcessRunning(pid)) {
    return null;
  }

  try {
    const command = process.platform === "win32" ? `tasklist /fi "pid eq ${pid}" /fo csv /nh` : `ps -p ${pid} -o comm=`;

    const result = await execAsync(command);
    const output = typeof result === "string" ? result : result.stdout.toString();
    const commandName =
      process.platform === "win32" ? output.split(",")[0]?.replace(/"/g, "") || "unknown" : output.trim();

    return {
      pid,
      command: commandName,
      status: "running",
    };
  } catch {
    return null;
  }
}
