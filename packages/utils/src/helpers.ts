import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExecOptions } from "node:child_process";

export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class AbortError extends Error {
  constructor(message = "Operation aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new AbortError());
      } else {
        signal.addEventListener("abort", onAbort);
      }
    }
  });
}

export interface PollOptions {
  /**
   * Total timeout in milliseconds
   * @default 30000
   * */
  timeout: number;
  /**
   * Polling interval in milliseconds
   * @default 100
   * */
  interval?: number;
  /**
   * Optional AbortSignal for cancellation
   */
  signal?: AbortSignal;
  /**
   * Whether to stop polling if fn throws an error
   * @default false
   */
  stopOnError?: boolean;
}

/**
 * Polls a function until it returns true or the timeout is reached
 */
export async function pollFn(fn: () => Promise<boolean>, options: PollOptions): Promise<void> {
  const { timeout = 3000, interval = 100, signal, stopOnError = false } = options;
  const start = performance.now();

  while (performance.now() - start < timeout) {
    if (signal?.aborted) {
      throw new AbortError();
    }
    try {
      const result = await fn();
      if (result) {
        return;
      }
    } catch (err) {
      if (stopOnError) {
        throw err;
      }
    }
    await delay(interval, signal);
  }
  throw new TimeoutError();
}

export const execAsync: typeof exec.__promisify__ = promisify(exec);

interface ExecuteCommandResult {
  stdout: string | Buffer;
  stderr: string | Buffer;
}
export async function executeCommand(command: string, options?: ExecOptions): Promise<ExecuteCommandResult> {
  return execAsync(command, options);
}
