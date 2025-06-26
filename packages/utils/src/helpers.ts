/**
 * Error thrown when an operation exceeds its timeout duration
 * @extends Error
 */
export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Error thrown when an operation is cancelled via AbortSignal
 * @extends Error
 */
export class AbortError extends Error {
  constructor(message = "Operation aborted") {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Create a cancellable delay
 * @param ms - Milliseconds to delay
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise that resolves after the delay
 * @throws {AbortError} If the operation is cancelled
 * @example
 * ```typescript
 * // Simple delay
 * await delay(1000);
 * 
 * // Cancellable delay
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 500);
 * await delay(1000, controller.signal); // Will throw AbortError
 * ```
 */
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
 * @param fn - Function to poll, should return true when condition is met
 * @param options - Polling configuration options
 * @returns Promise that resolves when fn returns true
 * @throws {TimeoutError} If timeout is reached before fn returns true
 * @throws {AbortError} If cancelled via AbortSignal
 * @example
 * ```typescript
 * // Wait for service to be ready
 * await pollFn(
 *   async () => {
 *     const res = await fetch('/health');
 *     return res.ok;
 *   },
 *   { timeout: 30000, interval: 1000 }
 * );
 * ```
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

// Node.js-specific functions have been moved to @pact-toolbox/node-utils
