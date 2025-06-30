import { logger } from "./logger";

/**
 * A function that performs cleanup operations.
 * Can be synchronous or asynchronous.
 */
type CleanupFunction = () => void | Promise<void>;

/**
 * Cleanup function with metadata for better tracking and prioritization
 */
interface CleanupEntry {
  fn: CleanupFunction;
  name?: string;
  priority: number; // Higher number = higher priority (runs first)
  timeout?: number; // Individual timeout in ms
}

class CleanupHandler {
  private cleanupEntries: Map<CleanupFunction, CleanupEntry> = new Map();
  private cleanupRegistered = false;
  private isCleaningUp = false;
  private readonly GLOBAL_TIMEOUT = 30000; // 30 second global timeout
  private readonly DEFAULT_FUNCTION_TIMEOUT = 10000; // 10 second per-function timeout

  registerCleanupFunction(
    cleanupFn: CleanupFunction,
    options: { name?: string; priority?: number; timeout?: number } = {},
  ) {
    const entry: CleanupEntry = {
      fn: cleanupFn,
      name: options.name || "anonymous",
      priority: options.priority || 0,
      timeout: options.timeout || this.DEFAULT_FUNCTION_TIMEOUT,
    };

    this.cleanupEntries.set(cleanupFn, entry);
    this.registerSignalHandlers();
  }

  unregisterCleanupFunction(cleanupFn: CleanupFunction) {
    this.cleanupEntries.delete(cleanupFn);
  }

  private registerSignalHandlers() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    const cleanup = async (signal: NodeJS.Signals | "exit" | "uncaughtException" | "unhandledRejection") => {
      if (this.isCleaningUp) return; // Prevent re-entry
      this.isCleaningUp = true;

      const isExitEvent = signal === "exit";
      const exitCode = signal === "uncaughtException" || signal === "unhandledRejection" ? 1 : 0;

      // For synchronous exit event, run cleanup synchronously with shorter timeout
      if (isExitEvent) {
        this.runSynchronousCleanup();
        process.exit(exitCode);
        // No return needed after process.exit
      }

      logger.info(`Received ${signal}, running cleanup functions...`);

      // Global timeout to prevent hanging
      const globalTimeout = setTimeout(() => {
        logger.warn(`Cleanup timed out after ${this.GLOBAL_TIMEOUT}ms, forcing exit`);
        process.exit(exitCode);
      }, this.GLOBAL_TIMEOUT);

      try {
        await this.runAsyncCleanup();
        clearTimeout(globalTimeout);
      } catch (error) {
        logger.error("Critical error during cleanup:", error);
        clearTimeout(globalTimeout);
      }

      process.exit(exitCode);
    };

    const signals: (NodeJS.Signals | "exit" | "uncaughtException" | "unhandledRejection")[] = [
      "SIGINT", // Ctrl+C
      "SIGTERM", // Termination signal
      "SIGQUIT", // Quit signal
      "SIGHUP", // Hangup signal
      "SIGUSR1", // User signal 1 (often used for graceful restart)
      "SIGUSR2", // User signal 2
      "exit", // Process exit
      "uncaughtException",
      "unhandledRejection",
    ];

    signals.forEach((signal) => {
      process.on(signal as any, async (reasonOrExitCode) => {
        if (signal === "exit") {
          await cleanup(signal);
        } else if (signal === "uncaughtException" || signal === "unhandledRejection") {
          logger.error(`${signal}:`, reasonOrExitCode);
          await cleanup(signal);
        } else {
          await cleanup(signal);
        }
      });
    });
  }

  private runSynchronousCleanup(): void {
    const entries = Array.from(this.cleanupEntries.values()).sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const entry of entries) {
      try {
        const result = entry.fn();
        // If it returns a promise, we can't wait for it in sync cleanup
        if (result instanceof Promise) {
          logger.warn(`Cleanup function '${entry.name}' returned promise during synchronous exit, skipping`);
        }
      } catch (err) {
        logger.error(`Error in cleanup function '${entry.name}':`, err);
      }
    }
  }

  private async runAsyncCleanup(): Promise<void> {
    const entries = Array.from(this.cleanupEntries.values()).sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const entry of entries) {
      try {
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${entry.timeout}ms`)), entry.timeout);
        });

        const cleanupPromise = Promise.resolve(entry.fn());

        await Promise.race([cleanupPromise, timeoutPromise]);
        logger.debug(`Cleanup function '${entry.name}' completed successfully`);
      } catch (err) {
        logger.error(`Error in cleanup function '${entry.name}':`, err);
        // Continue with other cleanup functions
      }
    }
  }
}

const cleanupHandler = new CleanupHandler();

/**
 * Registers a cleanup function to be executed when the process exits.
 *
 * The cleanup function will be called on:
 * - SIGINT (Ctrl+C)
 * - SIGTERM (termination signal)
 * - SIGQUIT, SIGHUP, SIGUSR1, SIGUSR2
 * - Normal process exit
 * - Uncaught exceptions
 * - Unhandled promise rejections
 *
 * Multiple cleanup functions can be registered and will be executed in priority order
 * (higher priority first). If a cleanup function throws an error, it will be logged
 * but won't prevent other cleanup functions from running.
 *
 * @param cleanupFn - The cleanup function to register
 * @param options - Configuration options
 * @param options.name - Name for the cleanup function (for better error logging)
 * @param options.priority - Priority level (higher = runs first, default: 0)
 * @param options.timeout - Individual timeout in ms (default: 10000)
 *
 * @example
 * ```typescript
 * import { cleanupOnExit } from '@pact-toolbox/node-utils';
 *
 * const server = createServer();
 *
 * // High priority network cleanup
 * cleanupOnExit(async () => {
 *   await network.stop();
 * }, { name: 'network', priority: 10, timeout: 5000 });
 *
 * // Lower priority server cleanup
 * cleanupOnExit(async () => {
 *   await server.close();
 * }, { name: 'server', priority: 5 });
 * ```
 */
export function cleanupOnExit(
  cleanupFn: CleanupFunction,
  options?: { name?: string; priority?: number; timeout?: number },
): void {
  cleanupHandler.registerCleanupFunction(cleanupFn, options);
}

/**
 * Unregisters a previously registered cleanup function.
 *
 * @param cleanupFn - The cleanup function to unregister
 */
export function unregisterCleanup(cleanupFn: CleanupFunction): void {
  cleanupHandler.unregisterCleanupFunction(cleanupFn);
}
