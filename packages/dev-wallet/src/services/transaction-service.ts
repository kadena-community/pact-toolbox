import type { DevWalletTransaction, TransactionResult } from '../types';
import type { TransactionStatus } from '../types/enhanced-types';
import { WalletError } from '../types/error-types';
import { handleErrors } from '../utils/error-handler';
import { DevWalletStorage } from '../storage';
import { transactionLogger } from '../utils/logger';

/**
 * Service for managing wallet transactions
 */
export class TransactionService {
  private storage: DevWalletStorage;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly defaultPollInterval = 5000; // 5 seconds
  private readonly maxPollDuration = 300000; // 5 minutes

  constructor(storage?: DevWalletStorage) {
    this.storage = storage || new DevWalletStorage();
  }

  /**
   * Add a new transaction to storage and start polling
   */
  @handleErrors({ component: 'TransactionService' })
  async addTransaction(transaction: Omit<DevWalletTransaction, 'id' | 'timestamp'>): Promise<DevWalletTransaction> {
    try {
      // Validate transaction data
      this.validateTransactionData(transaction);

      // Create transaction with ID and timestamp
      const newTransaction: DevWalletTransaction = {
        ...transaction,
        id: this.generateTransactionId(),
        timestamp: Date.now(),
        status: transaction.status || 'pending',
      };

      // Save to storage
      await this.storage.saveTransaction(newTransaction);

      transactionLogger.operation('Add transaction', 'success', { id: newTransaction.id });

      // Start polling if transaction is pending
      if (newTransaction.status === 'pending' && newTransaction.hash) {
        this.startPolling(newTransaction.hash, newTransaction.id);
      }

      // Dispatch transaction added event
      this.dispatchTransactionEvent('toolbox-transaction-added', { transaction: newTransaction });

      return newTransaction;
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'TRANSACTION_FAILED',
        'Failed to add transaction',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'addTransaction', from: transaction.from },
        }
      );
    }
  }

  /**
   * Update transaction status
   */
  @handleErrors({ component: 'TransactionService' })
  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    result?: TransactionResult
  ): Promise<DevWalletTransaction | null> {
    try {
      const transactions = await this.storage.getTransactions();
      const transactionIndex = transactions.findIndex(tx => tx.id === id);

      if (transactionIndex === -1) {
        throw WalletError.create(
          'TRANSACTION_FAILED',
          `Transaction not found: ${id}`,
          { severity: 'low', recoverable: true }
        );
      }

      const transaction = transactions[transactionIndex];
      if (!transaction) {
        throw WalletError.create(
          'TRANSACTION_FAILED',
          `Transaction with ID ${id} not found`,
          { severity: 'medium' }
        );
      }
      const updatedTransaction: DevWalletTransaction = {
        ...transaction,
        id: transaction.id!, // Assert that id exists
        from: transaction.from || '', // Ensure from is not undefined
        status: status as any, // Convert to original type
        result,
        updatedAt: Date.now(),
      };

      // Update in storage
      transactions[transactionIndex] = updatedTransaction;
      await this.storage.saveTransactions(transactions);

      transactionLogger.info(`Transaction ${id} status updated to: ${status}`);

      // Stop polling if transaction is completed
      if (this.isTransactionComplete(status)) {
        this.stopPolling(id);
      }

      // Dispatch transaction updated event
      this.dispatchTransactionEvent('toolbox-transaction-updated', {
        transactionId: id,
        status,
        result,
      });

      return updatedTransaction;
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'TRANSACTION_FAILED',
        'Failed to update transaction status',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'updateTransactionStatus', id, status },
        }
      );
    }
  }

  /**
   * Get transaction history with optional filtering
   */
  @handleErrors({ component: 'TransactionService' })
  async getTransactionHistory(options: {
    limit?: number;
    account?: string;
    status?: TransactionStatus;
    sortBy?: 'timestamp' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<DevWalletTransaction[]> {
    try {
      let transactions = await this.storage.getTransactions();

      // Filter by account if specified
      if (options.account) {
        transactions = transactions.filter(tx => 
          tx.from === options.account || tx.to === options.account
        );
      }

      // Filter by status if specified
      if (options.status) {
        transactions = transactions.filter(tx => tx.status === options.status);
      }

      // Sort transactions
      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';
      
      transactions.sort((a, b) => {
        const aValue = a[sortBy] || 0;
        const bValue = b[sortBy] || 0;
        
        if (sortOrder === 'desc') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });

      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        transactions = transactions.slice(0, options.limit);
      }

      transactionLogger.debug(`Retrieved ${transactions.length} transactions from history`);
      return transactions;
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to retrieve transaction history',
        {
          severity: 'medium',
          recoverable: true,
          cause: error as Error,
          context: { operation: 'getTransactionHistory', options },
        }
      );
    }
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(id: string): Promise<DevWalletTransaction | null> {
    try {
      const transactions = await this.storage.getTransactions();
      return transactions.find(tx => tx.id === id) || null;
    } catch (error) {
      transactionLogger.error('Failed to get transaction', { error });
      return null;
    }
  }

  /**
   * Remove a transaction from storage
   */
  @handleErrors({ component: 'TransactionService' })
  async removeTransaction(id: string): Promise<boolean> {
    try {
      const transactions = await this.storage.getTransactions();
      const filteredTransactions = transactions.filter(tx => tx.id !== id);

      if (filteredTransactions.length === transactions.length) {
        transactionLogger.warn(`Transaction ${id} not found for removal`);
        return false;
      }

      await this.storage.saveTransactions(filteredTransactions);
      
      // Stop polling if active
      this.stopPolling(id);

      transactionLogger.operation('Remove transaction', 'success', { id });
      return true;
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to remove transaction',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'removeTransaction', id },
        }
      );
    }
  }

  /**
   * Start polling for transaction updates
   */
  startPolling(hash: string, transactionId: string, interval?: number): void {
    // Stop existing polling for this transaction
    this.stopPolling(transactionId);

    const pollInterval = interval || this.defaultPollInterval;
    const startTime = Date.now();

    transactionLogger.operation('Transaction polling', 'start', { transactionId, hash });

    const intervalId = setInterval(async () => {
      try {
        // Check if polling has exceeded max duration
        if (Date.now() - startTime > this.maxPollDuration) {
          transactionLogger.warn(`Polling timeout for transaction ${transactionId}`);
          await this.updateTransactionStatus(transactionId, 'expired');
          this.stopPolling(transactionId);
          return;
        }

        // Poll transaction status (placeholder implementation)
        const result = await this.pollTransactionResult(hash);
        
        if (result) {
          // Convert result.data to TransactionResult if needed
          const transactionResult: TransactionResult | undefined = result.data ? {
            requestKey: transactionId,
            status: result.status as 'success' | 'failure',
            data: result.data,
          } : undefined;
          await this.updateTransactionStatus(transactionId, result.status, transactionResult);
          
          // Stop polling if transaction is complete
          if (this.isTransactionComplete(result.status)) {
            this.stopPolling(transactionId);
          }
        }
      } catch (error) {
        transactionLogger.error(`Polling error for transaction ${transactionId}`, { error });
        
        // Don't stop polling on temporary errors, but log them
        if (error instanceof WalletError && error.severity === 'critical') {
          await this.updateTransactionStatus(transactionId, 'failure');
          this.stopPolling(transactionId);
        }
      }
    }, pollInterval);

    this.pollingIntervals.set(transactionId, intervalId);
  }

  /**
   * Stop polling for a specific transaction
   */
  stopPolling(transactionId: string): void {
    const intervalId = this.pollingIntervals.get(transactionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(transactionId);
      transactionLogger.debug(`Stopped polling for transaction ${transactionId}`);
    }
  }

  /**
   * Stop all active polling
   */
  stopAllPolling(): void {
    for (const [transactionId, intervalId] of this.pollingIntervals) {
      clearInterval(intervalId);
      transactionLogger.debug(`Stopped polling for transaction ${transactionId}`);
    }
    this.pollingIntervals.clear();
  }

  /**
   * Get active polling count
   */
  getActivePollingCount(): number {
    return this.pollingIntervals.size;
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(): Promise<{
    total: number;
    pending: number;
    success: number;
    failure: number;
    byStatus: Record<string, number>;
  }> {
    const transactions = await this.getTransactionHistory();
    
    const stats = {
      total: transactions.length,
      pending: 0,
      success: 0,
      failure: 0,
      byStatus: {} as Record<string, number>,
    };

    for (const tx of transactions) {
      stats.byStatus[tx.status] = (stats.byStatus[tx.status] || 0) + 1;
      
      if (tx.status === 'pending') stats.pending++;
      else if (tx.status === 'success') stats.success++;
      else if (tx.status === 'failure') stats.failure++;
    }

    return stats;
  }

  private validateTransactionData(transaction: Partial<DevWalletTransaction>): void {
    const errors: string[] = [];

    if (!transaction.from) {
      errors.push('Transaction must have a from address');
    }

    if (!transaction.chainId) {
      errors.push('Transaction must have a chain ID');
    }

    if (transaction.amount !== undefined && Number(transaction.amount) < 0) {
      errors.push('Transaction amount cannot be negative');
    }

    if (errors.length > 0) {
      throw WalletError.create(
        'VALIDATION_ERROR',
        `Invalid transaction data: ${errors.join(', ')}`,
        { severity: 'medium', recoverable: true }
      );
    }
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isTransactionComplete(status: TransactionStatus): boolean {
    return ['success', 'failure', 'rejected', 'expired'].includes(status);
  }

  private async pollTransactionResult(hash: string): Promise<{ status: TransactionStatus; data?: Record<string, unknown> } | null> {
    // TODO: Implement actual transaction polling logic
    // This would typically call the blockchain RPC to check transaction status
    transactionLogger.debug(`Polling transaction status for hash: ${hash}`);
    
    // Placeholder implementation
    return null;
  }

  private dispatchTransactionEvent(eventType: string, detail: Record<string, unknown>): void {
    const event = new CustomEvent(eventType, {
      detail,
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }
}