import { describe, it, expect } from 'vitest';
import { WalletError, type WalletErrorCode, type WalletErrorDetails } from './error-types';

describe('WalletError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const details: WalletErrorDetails = {
        code: 'STORAGE_ERROR',
        message: 'Storage operation failed',
        severity: 'high',
        recoverable: true,
        timestamp: 1234567890,
        context: { operation: 'save' },
        cause: new Error('Original error'),
      };

      const error = new WalletError(details);

      expect(error.name).toBe('WalletError');
      expect(error.message).toBe(details.message);
      expect(error.code).toBe(details.code);
      expect(error.severity).toBe(details.severity);
      expect(error.recoverable).toBe(details.recoverable);
      expect(error.timestamp).toBe(details.timestamp);
      expect(error.context).toBe(details.context);
      expect(error.cause).toBe(details.cause);
    });

    it('should inherit from Error', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WalletError);
    });
  });

  describe('create', () => {
    it('should create error with minimal parameters', () => {
      const error = WalletError.create('NETWORK_ERROR', 'Network failed');

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Network failed');
      expect(error.severity).toBe('medium'); // default
      expect(error.recoverable).toBe(false); // default
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('should create error with custom options', () => {
      const cause = new Error('Original');
      const context = { operation: 'test' };
      
      const error = WalletError.create('CRYPTO_ERROR', 'Crypto failed', {
        severity: 'critical',
        recoverable: true,
        context,
        cause,
      });

      expect(error.severity).toBe('critical');
      expect(error.recoverable).toBe(true);
      expect(error.context).toBe(context);
      expect(error.cause).toBe(cause);
    });
  });

  describe('recoverable', () => {
    it('should create recoverable error with low severity', () => {
      const error = WalletError.recoverable('VALIDATION_ERROR', 'Invalid input');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.severity).toBe('low');
      expect(error.recoverable).toBe(true);
    });

    it('should include context if provided', () => {
      const context = { field: 'email' };
      const error = WalletError.recoverable('VALIDATION_ERROR', 'Invalid input', context);

      expect(error.context).toBe(context);
    });
  });

  describe('critical', () => {
    it('should create critical error', () => {
      const cause = new Error('System failure');
      const error = WalletError.critical('CRYPTO_ERROR', 'Critical failure', cause);

      expect(error.code).toBe('CRYPTO_ERROR');
      expect(error.message).toBe('Critical failure');
      expect(error.severity).toBe('critical');
      expect(error.recoverable).toBe(false);
      expect(error.cause).toBe(cause);
    });

    it('should include context if provided', () => {
      const context = { system: 'crypto' };
      const error = WalletError.critical('CRYPTO_ERROR', 'Critical failure', undefined, context);

      expect(error.context).toBe(context);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to plain object', () => {
      const cause = new Error('Original');
      const context = { operation: 'test' };
      
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed', {
        severity: 'high',
        recoverable: true,
        context,
        cause,
      });

      const json = error.toJSON();

      expect(json).toEqual({
        code: 'STORAGE_ERROR',
        message: 'Storage failed',
        severity: 'high',
        recoverable: true,
        timestamp: error.timestamp,
        context,
        cause,
        stack: error.stack,
      });
    });

    it('should handle undefined optional properties', () => {
      const error = WalletError.create('NETWORK_ERROR', 'Network failed');
      const json = error.toJSON();

      expect(json.cause).toBeUndefined();
      expect(json.context).toBeUndefined();
    });
  });

  describe('is', () => {
    it('should return true for matching error code', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed');
      
      expect(error.is('STORAGE_ERROR')).toBe(true);
    });

    it('should return false for non-matching error code', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed');
      
      expect(error.is('NETWORK_ERROR')).toBe(false);
    });
  });

  describe('isAnyOf', () => {
    it('should return true if error code matches any in array', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed');
      
      expect(error.isAnyOf(['NETWORK_ERROR', 'STORAGE_ERROR', 'CRYPTO_ERROR'])).toBe(true);
    });

    it('should return false if error code matches none in array', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed');
      
      expect(error.isAnyOf(['NETWORK_ERROR', 'CRYPTO_ERROR'])).toBe(false);
    });

    it('should return false for empty array', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Storage failed');
      
      expect(error.isAnyOf([])).toBe(false);
    });
  });

  describe('error codes', () => {
    const errorCodes: WalletErrorCode[] = [
      'CONNECTION_FAILED',
      'SIGNING_REJECTED',
      'NETWORK_ERROR',
      'STORAGE_ERROR',
      'VALIDATION_ERROR',
      'CRYPTO_ERROR',
      'TIMEOUT_ERROR',
      'PERMISSION_DENIED',
      'ACCOUNT_NOT_FOUND',
      'TRANSACTION_FAILED',
      'NETWORK_UNAVAILABLE',
      'INSUFFICIENT_FUNDS',
      'INVALID_TRANSACTION',
      'USER_CANCELLED',
      'AUTO_LOCK_TRIGGERED',
      'IMPORT_FAILED',
      'EXPORT_FAILED',
      'MIGRATION_FAILED',
    ];

    it('should accept all defined error codes', () => {
      errorCodes.forEach(code => {
        expect(() => WalletError.create(code, 'Test message')).not.toThrow();
      });
    });
  });

  describe('error severity', () => {
    it('should accept all severity levels', () => {
      const severities = ['low', 'medium', 'high', 'critical'] as const;
      
      severities.forEach(severity => {
        const error = WalletError.create('STORAGE_ERROR', 'Test', { severity });
        expect(error.severity).toBe(severity);
      });
    });
  });

  describe('timestamp', () => {
    it('should set timestamp to current time', () => {
      const before = Date.now();
      const error = WalletError.create('STORAGE_ERROR', 'Test');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('stack trace', () => {
    it('should preserve stack trace', () => {
      const error = WalletError.create('STORAGE_ERROR', 'Test');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('WalletError');
    });

    it('should use provided stack if given', () => {
      const customStack = 'Custom stack trace';
      const error = new WalletError({
        code: 'STORAGE_ERROR',
        message: 'Test',
        severity: 'medium',
        recoverable: false,
        timestamp: Date.now(),
        stack: customStack,
      });

      expect(error.stack).toBe(customStack);
    });
  });
});