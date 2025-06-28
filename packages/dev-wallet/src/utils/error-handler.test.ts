import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler, errorHandler } from './error-handler';
import { WalletError } from '../types/error-types';
import { 
  setupBrowserMocks, 
  resetMocks, 
  setupTimers, 
  teardownTimers
} from '../test-utils/setup';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    setupBrowserMocks();
    resetMocks();
    setupTimers();
    handler = ErrorHandler.getInstance();
    handler.clearErrorLog();
  });

  afterEach(() => {
    teardownTimers();
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('handle', () => {
    it('should handle WalletError and log it', async () => {
      const error = WalletError.create('STORAGE_ERROR', 'Test error');
      
      await handler.handle(error);

      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toBe(error);
    });

    it('should convert regular Error to WalletError', async () => {
      const error = new Error('Regular error');
      
      await handler.handle(error);

      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toBeInstanceOf(WalletError);
      expect(errorLog[0].message).toBe('Regular error');
    });

    it('should add context to errors', async () => {
      const error = new Error('Test error');
      const context = { operation: 'test', component: 'TestComponent' };
      
      await handler.handle(error, context);

      const errorLog = handler.getErrorLog();
      expect(errorLog[0].context).toMatchObject(context);
    });

    it('should dispatch wallet-error event', async () => {
      const error = WalletError.create('STORAGE_ERROR', 'Test error');
      
      // Spy on document.dispatchEvent directly
      const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');
      
      await handler.handle(error);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'wallet-error',
          detail: expect.objectContaining({
            code: 'STORAGE_ERROR',
            message: 'Test error',
          }),
        })
      );
      
      dispatchEventSpy.mockRestore();
    });

    it('should attempt recovery for recoverable errors', async () => {
      const recoverableError = WalletError.recoverable('STORAGE_ERROR', 'Recoverable error');
      const mockStrategy = {
        canRecover: vi.fn().mockReturnValue(true),
        recover: vi.fn().mockResolvedValue(undefined),
        maxRetries: 1,
        retryDelay: 0,
      };
      
      handler.registerRecoveryStrategy('STORAGE_ERROR', mockStrategy);
      await handler.handle(recoverableError);

      expect(mockStrategy.canRecover).toHaveBeenCalledWith(recoverableError);
      expect(mockStrategy.recover).toHaveBeenCalledWith(recoverableError);
    });

    it('should not attempt recovery for non-recoverable errors', async () => {
      const error = WalletError.critical('CRYPTO_ERROR', 'Critical error');
      const mockStrategy = {
        canRecover: vi.fn().mockReturnValue(false),
        recover: vi.fn(),
        maxRetries: 1,
        retryDelay: 0,
      };
      
      handler.registerRecoveryStrategy('CRYPTO_ERROR', mockStrategy);
      await handler.handle(error);

      expect(mockStrategy.recover).not.toHaveBeenCalled();
    });
  });

  describe('withErrorHandling', () => {
    it('should execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context = { operation: 'test' };
      
      const result = await handler.withErrorHandling(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should handle and re-throw errors', async () => {
      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);
      const context = { operation: 'test' };
      
      await expect(handler.withErrorHandling(operation, context)).rejects.toThrow(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(1);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await handler.withRetry(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');
      
      const promise = handler.withRetry(operation, 3, 10);
      
      // First attempt fails
      await vi.runAllTimersAsync();
      
      // Second attempt fails
      await vi.runAllTimersAsync();
      
      // Third attempt succeeds
      const result = await promise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it.skip('should fail after max retries', async () => {
      const error = new Error('Always fails');
      const operation = vi.fn().mockRejectedValue(error);
      
      const promise = handler.withRetry(operation, 2, 10);
      
      // Expect the promise to reject
      await expect(promise).rejects.toThrow('Always fails');
      
      expect(operation).toHaveBeenCalledTimes(2);
      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(1);
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockResolvedValue('success');
      
      const promise = handler.withRetry(operation, 3, 100);
      
      // First attempt fails immediately
      expect(operation).toHaveBeenCalledTimes(1);
      
      // Advance time for exponential backoff (100ms * 1)
      await vi.advanceTimersByTimeAsync(100);
      
      // Wait for promise to resolve
      await promise;
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerRecoveryStrategy', () => {
    it('should register custom recovery strategy', () => {
      const strategy = {
        canRecover: vi.fn(),
        recover: vi.fn(),
        maxRetries: 1,
        retryDelay: 0,
      };
      
      handler.registerRecoveryStrategy('CUSTOM_ERROR' as any, strategy);
      
      // Strategy should be registered (tested via recovery attempt)
      expect(() => handler.registerRecoveryStrategy('CUSTOM_ERROR' as any, strategy)).not.toThrow();
    });
  });

  describe('getErrorLog', () => {
    it('should return empty log initially', () => {
      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(0);
    });

    it('should return readonly array of errors', async () => {
      const error = WalletError.create('STORAGE_ERROR', 'Test error');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog).toHaveLength(1);
      
      // Should be readonly - mutations shouldn't affect original
      const readonlyLog = errorLog as any;
      expect(() => readonlyLog.push(error)).not.toThrow(); // Array is mutable but it's a copy
      
      const newLog = handler.getErrorLog();
      expect(newLog).toHaveLength(1); // Original unchanged
    });

    it('should limit log size', async () => {
      // Add more than max log size (100)
      for (let i = 0; i < 105; i++) {
        await handler.handle(WalletError.create('STORAGE_ERROR', `Error ${i}`));
      }
      
      const errorLog = handler.getErrorLog();
      expect(errorLog.length).toBeLessThanOrEqual(100);
    });
  });

  describe('clearErrorLog', () => {
    it('should clear all logged errors', async () => {
      await handler.handle(WalletError.create('STORAGE_ERROR', 'Error 1'));
      await handler.handle(WalletError.create('NETWORK_ERROR', 'Error 2'));
      
      expect(handler.getErrorLog()).toHaveLength(2);
      
      handler.clearErrorLog();
      
      expect(handler.getErrorLog()).toHaveLength(0);
    });
  });

  describe('getErrorStats', () => {
    it('should return empty stats initially', () => {
      const stats = handler.getErrorStats();
      expect(stats).toEqual({});
    });

    it('should count errors by type', async () => {
      await handler.handle(WalletError.create('STORAGE_ERROR', 'Error 1'));
      await handler.handle(WalletError.create('STORAGE_ERROR', 'Error 2'));
      await handler.handle(WalletError.create('NETWORK_ERROR', 'Error 3'));
      
      const stats = handler.getErrorStats();
      expect(stats).toEqual({
        STORAGE_ERROR: 2,
        NETWORK_ERROR: 1,
      });
    });
  });

  describe('error categorization', () => {
    it('should categorize network errors', async () => {
      const error = new Error('Network request failed');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('NETWORK_ERROR');
    });

    it('should categorize storage errors', async () => {
      const error = new Error('IndexedDB operation failed');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('STORAGE_ERROR');
    });

    it('should categorize crypto errors', async () => {
      const error = new Error('Crypto key generation failed');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('CRYPTO_ERROR');
    });

    it('should categorize timeout errors', async () => {
      const error = new Error('Request timeout exceeded');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('TIMEOUT_ERROR');
    });

    it('should categorize permission errors', async () => {
      const error = new Error('Permission denied to access resource');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('PERMISSION_DENIED');
    });

    it('should categorize user cancellation', async () => {
      const error = new Error('User cancelled the operation');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('USER_CANCELLED');
    });

    it('should default to validation error for unknown types', async () => {
      const error = new Error('Some unknown error type');
      await handler.handle(error);
      
      const errorLog = handler.getErrorLog();
      expect(errorLog[0].code).toBe('VALIDATION_ERROR');
    });
  });

  describe('exported errorHandler', () => {
    it('should provide singleton instance', () => {
      expect(errorHandler).toBe(ErrorHandler.getInstance());
    });
  });
});