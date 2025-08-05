import { WalletError, type WalletErrorCode, type ErrorRecoveryStrategy, type ErrorContext } from '../types/error-types';

/**
 * Centralized error handling utility for dev wallet
 */
export class ErrorHandler {
  private recoveryStrategies: Map<WalletErrorCode, ErrorRecoveryStrategy> = new Map();
  private errorLog: WalletError[] = [];
  private maxLogSize = 100;

  constructor() {
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Handle an error with automatic recovery if possible
   */
  async handle(error: Error | WalletError, context?: Partial<ErrorContext>): Promise<void> {
    const walletError = this.normalizeError(error, context);
    this.logError(walletError);

    // Try to recover if possible
    if (walletError.recoverable) {
      const strategy = this.recoveryStrategies.get(walletError.code);
      if (strategy && strategy.canRecover(walletError)) {
        try {
          await strategy.recover(walletError);
          console.log(`Successfully recovered from error: ${walletError.code}`);
          return;
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
        }
      }
    }

    // If recovery failed or error is not recoverable, notify user
    this.notifyUser(walletError);
  }

  /**
   * Handle async operations with automatic error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      await this.handle(error as Error, context);
      throw error; // Re-throw after handling
    }
  }

  /**
   * Handle async operations with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          await this.handle(lastError, { ...context, operation: `${context?.operation} (attempt ${attempt})` });
          throw lastError;
        }
        
        console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
        await this.sleep(delay * attempt); // Exponential backoff
      }
    }
    
    throw lastError!;
  }

  /**
   * Register a custom recovery strategy
   */
  registerRecoveryStrategy(code: WalletErrorCode, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(code, strategy);
  }

  /**
   * Get error log for debugging
   */
  getErrorLog(): readonly WalletError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<WalletErrorCode, number> {
    const stats: Record<string, number> = {};
    for (const error of this.errorLog) {
      stats[error.code] = (stats[error.code] || 0) + 1;
    }
    return stats as Record<WalletErrorCode, number>;
  }

  private normalizeError(error: Error | WalletError, context?: Partial<ErrorContext>): WalletError {
    if (error instanceof WalletError) {
      // Add context if provided
      if (context) {
        return new WalletError({
          ...error.toJSON(),
          context: { ...error.context, ...context },
        });
      }
      return error;
    }

    // Convert regular Error to WalletError
    return WalletError.create(
      this.categorizeError(error),
      error.message,
      {
        cause: error,
        context: {
          ...context,
          originalErrorName: error.name,
        },
      }
    );
  }

  private categorizeError(error: Error): WalletErrorCode {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('storage') || message.includes('indexeddb')) {
      return 'STORAGE_ERROR';
    }
    if (message.includes('crypto') || message.includes('key')) {
      return 'CRYPTO_ERROR';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (message.includes('permission') || message.includes('access')) {
      return 'PERMISSION_DENIED';
    }
    if (message.includes('cancel') || message.includes('abort')) {
      return 'USER_CANCELLED';
    }
    
    return 'VALIDATION_ERROR'; // Default fallback
  }

  private logError(error: WalletError): void {
    this.errorLog.push(error);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    // Log to console with appropriate level
    switch (error.severity) {
      case 'critical':
        console.error('Critical wallet error:', error);
        break;
      case 'high':
        console.error('High severity wallet error:', error);
        break;
      case 'medium':
        console.warn('Wallet error:', error);
        break;
      case 'low':
        console.log('Minor wallet error:', error);
        break;
    }
  }

  private notifyUser(error: WalletError): void {
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('wallet-error', {
      detail: error.toJSON(),
      bubbles: true,
      composed: true,
    });
    
    document.dispatchEvent(event);
  }

  private setupDefaultRecoveryStrategies(): void {
    // Storage error recovery
    this.registerRecoveryStrategy('STORAGE_ERROR', {
      canRecover: (error) => error.recoverable,
      recover: async (error) => {
        // Try to clear corrupted data and reinitialize
        if (error.context?.['operation'] === 'load') {
          localStorage.removeItem('pact-toolbox-wallet-keys');
          localStorage.removeItem('pact-toolbox-wallet-transactions');
        }
      },
      maxRetries: 1,
      retryDelay: 0,
    });

    // Network error recovery
    this.registerRecoveryStrategy('NETWORK_ERROR', {
      canRecover: (error) => error.recoverable,
      recover: async (_error) => {
        // Wait and retry network operation
        await this.sleep(2000);
      },
      maxRetries: 3,
      retryDelay: 2000,
    });

    // Connection failure recovery
    this.registerRecoveryStrategy('CONNECTION_FAILED', {
      canRecover: (error) => error.recoverable,
      recover: async (_error) => {
        // Reset connection state
        const event = new CustomEvent('reset-connection-state', {
          bubbles: true,
          composed: true,
        });
        document.dispatchEvent(event);
      },
      maxRetries: 2,
      retryDelay: 1000,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a default error handler instance
 */
export function createErrorHandler(): ErrorHandler {
  return new ErrorHandler();
}

/**
 * Decorator for automatic error handling on class methods
 * Note: Services using this decorator should inject their own ErrorHandler instance
 */
export function handleErrors(context?: Partial<ErrorContext>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        // If the class has an errorHandler property, use it
        if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
          await this.errorHandler.handle(error as Error, {
            ...context,
            operation: `${target.constructor.name}.${propertyKey}`,
            component: target.constructor.name,
          });
        }
        throw error;
      }
    };

    return descriptor;
  };
}