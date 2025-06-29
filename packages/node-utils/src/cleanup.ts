import { logger } from "./logger";

/**
 * A function that performs cleanup operations.
 * Can be synchronous or asynchronous.
 */
type CleanupFunction = () => void | Promise<void>;

class CleanupHandler {
  private cleanupFunctions: Set<CleanupFunction> = new Set();
  private cleanupRegistered = false;
  private isCleaningUp = false;

  registerCleanupFunction(cleanupFn: CleanupFunction) {
    this.cleanupFunctions.add(cleanupFn);
    this.registerSignalHandlers();
  }

  private registerSignalHandlers() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    const cleanup = async (signal: NodeJS.Signals | "exit" | "uncaughtException" | "unhandledRejection") => {
      if (this.isCleaningUp) return; // Prevent re-entry
      this.isCleaningUp = true;

      logger.info(`Received ${signal}, running cleanup functions...`);

      for (const cleanupFn of this.cleanupFunctions) {
        try {
          await cleanupFn();
        } catch (err) {
          logger.error("Error during cleanup:", err);
        }
      }

      process.exit(signal === "uncaughtException" || signal === "unhandledRejection" ? 1 : 0);
    };

    const signals: (NodeJS.Signals | "exit" | "uncaughtException" | "unhandledRejection")[] = [
      "SIGINT",
      "SIGTERM",
      "SIGQUIT",
      "SIGHUP",
      "exit",
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
}

const cleanupHandler = new CleanupHandler();

/**
 * Registers a cleanup function to be executed when the process exits.
 *
 * The cleanup function will be called on:
 * - SIGINT (Ctrl+C)
 * - SIGTERM (termination signal)
 * - SIGQUIT
 * - SIGHUP
 * - Normal process exit
 * - Uncaught exceptions
 * - Unhandled promise rejections
 *
 * Multiple cleanup functions can be registered and will be executed in the order
 * they were registered. If a cleanup function throws an error, it will be logged
 * but won't prevent other cleanup functions from running.
 *
 * @param cleanupFn - The cleanup function to register
 *
 * @example
 * ```typescript
 * import { cleanupOnExit } from '@pact-toolbox/node-utils';
 *
 * const server = createServer();
 *
 * cleanupOnExit(async () => {
 *   await server.close();
 *   console.log('Server closed gracefully');
 * });
 * ```
 */
export function cleanupOnExit(cleanupFn: CleanupFunction): void {
  cleanupHandler.registerCleanupFunction(cleanupFn);
}
