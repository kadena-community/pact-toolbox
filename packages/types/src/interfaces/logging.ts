/**
 * Logger interface for application logging
 */
export interface ILogger {
  /**
   * Log an info message
   * @param message - The message to log
   * @param args - Additional arguments
   */
  info(message: string, ...args: any[]): void;
  
  /**
   * Log a warning message
   * @param message - The message to log
   * @param args - Additional arguments
   */
  warn(message: string, ...args: any[]): void;
  
  /**
   * Log an error message
   * @param message - The message to log
   * @param args - Additional arguments
   */
  error(message: string, ...args: any[]): void;
  
  /**
   * Log a debug message
   * @param message - The message to log
   * @param args - Additional arguments
   */
  debug(message: string, ...args: any[]): void;
}