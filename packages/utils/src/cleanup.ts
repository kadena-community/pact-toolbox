import { logger } from "./logger";

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

export function cleanupOnExit(cleanupFn: CleanupFunction): void {
  cleanupHandler.registerCleanupFunction(cleanupFn);
}
