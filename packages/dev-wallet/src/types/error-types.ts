/**
 * Wallet error codes for categorizing different types of errors
 */
export type WalletErrorCode = 
  | 'CONNECTION_FAILED'
  | 'SIGNING_REJECTED' 
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR'
  | 'CRYPTO_ERROR'
  | 'TIMEOUT_ERROR'
  | 'PERMISSION_DENIED'
  | 'ACCOUNT_NOT_FOUND'
  | 'TRANSACTION_FAILED'
  | 'NETWORK_UNAVAILABLE'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_TRANSACTION'
  | 'USER_CANCELLED'
  | 'AUTO_LOCK_TRIGGERED'
  | 'IMPORT_FAILED'
  | 'EXPORT_FAILED'
  | 'MIGRATION_FAILED';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error details interface
 */
export interface WalletErrorDetails {
  code: WalletErrorCode;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: number;
  context?: Record<string, unknown>;
  cause?: Error;
  stack?: string;
}

/**
 * Enhanced wallet error class with better categorization and context
 */
export class WalletError extends Error {
  public readonly code: WalletErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly recoverable: boolean;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(details: WalletErrorDetails) {
    super(details.message);
    this.name = 'WalletError';
    this.code = details.code;
    this.severity = details.severity;
    this.recoverable = details.recoverable;
    this.timestamp = details.timestamp;
    this.context = details.context;
    this.cause = details.cause;
    
    if (details.stack) {
      this.stack = details.stack;
    }
  }

  /**
   * Create a wallet error with minimal required information
   */
  static create(
    code: WalletErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      recoverable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ): WalletError {
    return new WalletError({
      code,
      message,
      severity: options.severity ?? 'medium',
      recoverable: options.recoverable ?? false,
      timestamp: Date.now(),
      context: options.context,
      cause: options.cause,
    });
  }

  /**
   * Create a recoverable error
   */
  static recoverable(
    code: WalletErrorCode,
    message: string,
    context?: Record<string, unknown>
  ): WalletError {
    return WalletError.create(code, message, {
      severity: 'low',
      recoverable: true,
      context,
    });
  }

  /**
   * Create a critical error
   */
  static critical(
    code: WalletErrorCode,
    message: string,
    cause?: Error,
    context?: Record<string, unknown>
  ): WalletError {
    return WalletError.create(code, message, {
      severity: 'critical',
      recoverable: false,
      cause,
      context,
    });
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): WalletErrorDetails {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause,
      stack: this.stack,
    };
  }

  /**
   * Check if the error is of a specific type
   */
  is(code: WalletErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if the error is in a category of codes
   */
  isAnyOf(codes: WalletErrorCode[]): boolean {
    return codes.includes(this.code);
  }
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  canRecover(error: WalletError): boolean;
  recover(error: WalletError): Promise<void>;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  operation: string;
  component: string;
  userAgent?: string;
  networkId?: string;
  accountAddress?: string;
  timestamp: number;
  sessionId?: string;
}