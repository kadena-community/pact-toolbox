/**
 * Simple logging utility for dev-wallet package
 * Provides conditional debug logging and consistent message formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DevWalletLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  
  // Specialized methods for common patterns
  operation(name: string, status: 'start' | 'success' | 'error', data?: any): void;
  connection(message: string, data?: any): void;
  transaction(message: string, data?: any): void;
  ui(message: string, data?: any): void;
}

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return !!(process.env['DEBUG'] || process.env['DEV_WALLET_DEBUG']);
  }
  
  // Browser environment
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('dev-wallet-debug') === 'true';
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    return process.env['NODE_ENV'] === 'development';
  }
  return true; // Default to development in browser
}

/**
 * Create a tagged logger for a specific component
 */
export function createLogger(tag: string): DevWalletLogger {
  const prefix = `[dev-wallet:${tag}]`;
  const debugEnabled = isDebugEnabled();
  const devMode = isDevelopment();
  
  // In production, only show warnings and errors unless debug is explicitly enabled
  const shouldLog = (level: LogLevel): boolean => {
    if (level === 'error' || level === 'warn') return true;
    if (debugEnabled) return true;
    if (devMode && level === 'info') return true;
    return false;
  };

  return {
    debug(message: string, data?: any): void {
      if (shouldLog('debug')) {
        if (data !== undefined) {
          console.log(prefix, message, data);
        } else {
          console.log(prefix, message);
        }
      }
    },

    info(message: string, data?: any): void {
      if (shouldLog('info')) {
        if (data !== undefined) {
          console.log(prefix, message, data);
        } else {
          console.log(prefix, message);
        }
      }
    },

    warn(message: string, data?: any): void {
      if (shouldLog('warn')) {
        if (data !== undefined) {
          console.warn(prefix, message, data);
        } else {
          console.warn(prefix, message);
        }
      }
    },

    error(message: string, data?: any): void {
      if (shouldLog('error')) {
        if (data !== undefined) {
          console.error(prefix, message, data);
        } else {
          console.error(prefix, message);
        }
      }
    },

    // Specialized logging methods
    operation(name: string, status: 'start' | 'success' | 'error', data?: any): void {
      const message = `Operation ${name} ${status}`;
      switch (status) {
        case 'start':
          this.debug(message, data);
          break;
        case 'success':
          this.info(message, data);
          break;
        case 'error':
          this.error(message, data);
          break;
      }
    },

    connection(message: string, data?: any): void {
      this.info(`Connection: ${message}`, data);
    },

    transaction(message: string, data?: any): void {
      this.info(`Transaction: ${message}`, data);
    },

    ui(message: string, data?: any): void {
      this.debug(`UI: ${message}`, data);
    },
  };
}

// Common logger instances for different components
export const walletLogger = createLogger('wallet');
export const accountLogger = createLogger('account');
export const transactionLogger = createLogger('transaction');
export const storageLogger = createLogger('storage');
export const uiLogger = createLogger('ui');
export const stateLogger = createLogger('state');

/**
 * Enable debug logging in browser
 * Usage: enableDebug() in browser console
 */
export function enableDebug(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('dev-wallet-debug', 'true');
    console.log('[dev-wallet] Debug logging enabled. Reload to see debug messages.');
  }
}

/**
 * Disable debug logging in browser
 */
export function disableDebug(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('dev-wallet-debug');
    console.log('[dev-wallet] Debug logging disabled.');
  }
}

// Export utility functions to global scope in development
if (isDevelopment() && typeof globalThis !== 'undefined') {
  (globalThis as any).devWalletEnableDebug = enableDebug;
  (globalThis as any).devWalletDisableDebug = disableDebug;
}