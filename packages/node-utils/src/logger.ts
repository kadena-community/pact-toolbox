import { createConsola, type ConsolaInstance } from "consola";

/**
 * Determines the log level from environment variables.
 * Supports DEBUG and LOG_LEVEL environment variables.
 *
 * @returns The numeric log level (0-5)
 */
function getLogLevel(): number {
  // Check for DEBUG environment variable - supports various patterns
  const debug = process.env["DEBUG"];
  if (debug && debug !== "0" && debug.toLowerCase() !== "false") {
    // Support common DEBUG patterns:
    // DEBUG=* (enable all debug), DEBUG=pact-* (namespaced), DEBUG=1, DEBUG=true, etc.
    return 4; // debug level
  }

  // Check for LOG_LEVEL environment variable
  if (process.env["LOG_LEVEL"]) {
    const level = process.env["LOG_LEVEL"].toLowerCase();
    switch (level) {
      case "silent":
        return -1; // Below all levels to ensure silence
      case "fatal":
        return 0;
      case "error":
        return 1;
      case "warn":
        return 2;
      case "log":
        return 3;
      case "info":
        return 3;
      case "debug":
        return 4;
      case "trace":
        return 5;
      default:
        return 3; // default to info
    }
  }

  // Default to info level (3) - show important status updates by default
  return 3;
}

/**
 * Main logger instance configured with environment-based log level.
 *
 * Log levels:
 * - -1: silent (no output)
 * - 0: fatal
 * - 1: error
 * - 2: warn
 * - 3: info/log (default)
 * - 4: debug
 * - 5: trace
 *
 * Set log level via environment variables:
 * - DEBUG=1 (or any truthy value except "0"/"false") for debug level
 * - LOG_LEVEL=debug/info/warn/error/silent for specific levels
 *
 * @example
 * ```typescript
 * import { logger } from '@pact-toolbox/node-utils';
 *
 * logger.info('Application started');
 * logger.error('An error occurred', error);
 * logger.debug('Debug information', { data });
 * ```
 */
export const logger: ConsolaInstance = createConsola({
  level: getLogLevel(),
  formatOptions: {
    columns: 80,
    colors: true,
    compact: false,
    date: false,
  },
});

/**
 * Type alias for logger instances.
 */
export type Logger = ConsolaInstance;

export { LogLevels } from "consola";

// Convenience functions for common logging patterns

/** Log informational messages */
export const info: typeof logger.info = logger.info.bind(logger);

/** Log warning messages */
export const warn: typeof logger.warn = logger.warn.bind(logger);

/** Log error messages */
export const error: typeof logger.error = logger.error.bind(logger);

/** Log debug messages (only shown when debug level is enabled) */
export const debug: typeof logger.debug = logger.debug.bind(logger);

/** Log success messages with green styling */
export const success: typeof logger.success = logger.success.bind(logger);

/** Log failure messages with red styling */
export const fail: typeof logger.fail = logger.fail.bind(logger);

/** Log ready messages (typically for server/service startup) */
export const ready: typeof logger.ready = logger.ready.bind(logger);

/** Log start messages (typically for process/task initiation) */
export const start: typeof logger.start = logger.start.bind(logger);

/** Log general messages */
export const log: typeof logger.log = logger.log.bind(logger);

/** Display a message in a box for emphasis */
export const box: typeof logger.box = logger.box.bind(logger);

/**
 * Creates a tagged logger for a specific package or component.
 * Tagged loggers prefix all messages with the tag for easier identification.
 *
 * @param tag - The tag to prefix messages with
 * @returns A new logger instance with the specified tag
 *
 * @example
 * ```typescript
 * const networkLogger = createLogger('network');
 * networkLogger.info('Connection established'); // [network] Connection established
 *
 * const dbLogger = createLogger('database');
 * dbLogger.error('Query failed'); // [database] Query failed
 * ```
 */
export function createLogger(tag: string): ConsolaInstance {
  return logger.withTag(tag);
}

/**
 * Logs performance metrics for operations.
 * Only visible when debug level is enabled.
 *
 * @param operation - The name of the operation
 * @param duration - The duration in milliseconds
 * @param data - Optional additional data to log
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * await performOperation();
 * const duration = Date.now() - startTime;
 *
 * logPerformance('database.query', duration, { query: 'SELECT * FROM users' });
 * // [PERF] database.query completed in 123ms { query: 'SELECT * FROM users' }
 * ```
 */
export function logPerformance(operation: string, duration: number, data?: any): void {
  logger.debug(`[PERF] ${operation} completed in ${duration}ms`, data);
}

/**
 * Logs a message with explicit context/category and level.
 * Useful for dynamic logging where the level is determined at runtime.
 *
 * @param level - The log level to use
 * @param context - The context/category tag
 * @param message - The message to log
 * @param data - Optional additional data to log
 *
 * @example
 * ```typescript
 * function handleRequest(severity: string) {
 *   const level = severity === 'critical' ? 'error' : 'warn';
 *   logWithContext(level, 'api', 'Request failed', {
 *     endpoint: '/users',
 *     status: 500
 *   });
 * }
 * ```
 */
export function logWithContext(
  level: "info" | "warn" | "error" | "debug",
  context: string,
  message: string,
  data?: any,
): void {
  const contextualLogger = logger.withTag(context);

  switch (level) {
    case "info":
      contextualLogger.info(message, data);
      break;
    case "warn":
      contextualLogger.warn(message, data);
      break;
    case "error":
      contextualLogger.error(message, data);
      break;
    case "debug":
      contextualLogger.debug(message, data);
      break;
  }
}

// Re-export color utilities for consistent styling across the package
export { colors, getColor, stripAnsi, colorize } from "consola/utils";
