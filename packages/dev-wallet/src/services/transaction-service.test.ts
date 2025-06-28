import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransactionService } from './transaction-service';
import { DevWalletStorage } from '../storage';
import { WalletError } from '../types/error-types';
import { 
  setupBrowserMocks, 
  resetMocks, 
  createMockTransaction
} from '../test-utils/setup';

describe.skip('TransactionService', () => {
  let transactionService: TransactionService;
  let storage: DevWalletStorage;

  beforeEach(() => {
    setupBrowserMocks();
    storage = new DevWalletStorage();
    transactionService = new TransactionService(storage);
  });

  afterEach(() => {
    resetMocks();
  });

  describe('addTransaction', () => {
    it('should add a valid transaction', async () => {
      const validTransaction = createMockTransaction({
        cmd: JSON.stringify({
          payload: { exec: { code: 'test-code', data: {} } },
          signers: [{ pubKey: 'mock-public-key' }],
          meta: { chainId: '0', sender: 'test-sender' },
          networkId: 'testnet04',
          nonce: 'test-nonce',
        })
      });

      const result = await transactionService.addTransaction(validTransaction);

      expect(result).toBeDefined();
      expect(result.id).toBe(validTransaction.id);
      expect(result.status).toBe('pending');
    });

    it('should throw error for invalid transaction without chain ID', async () => {
      const invalidTransaction = createMockTransaction({
        cmd: JSON.stringify({
          payload: { exec: { code: 'test-code', data: {} } },
          signers: [{ pubKey: 'mock-public-key' }],
          meta: { sender: 'test-sender' }, // Missing chainId
          networkId: 'testnet04',
          nonce: 'test-nonce',
        })
      });

      await expect(transactionService.addTransaction(invalidTransaction))
        .rejects.toThrow(WalletError);
    });

    it('should prevent duplicate transaction IDs', async () => {
      const transaction = createMockTransaction();
      
      await transactionService.addTransaction(transaction);
      
      await expect(transactionService.addTransaction(transaction))
        .rejects.toThrow(WalletError);
    });
  });

  describe('getTransaction', () => {
    it('should retrieve an existing transaction', async () => {
      const transaction = createMockTransaction();
      await transactionService.addTransaction(transaction);

      const retrieved = await transactionService.getTransaction(transaction.id);
      expect(retrieved).toEqual(transaction);
    });

    it('should return null for non-existent transaction', async () => {
      const result = await transactionService.getTransaction('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status', async () => {
      const transaction = createMockTransaction();
      await transactionService.addTransaction(transaction);

      const updated = await transactionService.updateTransactionStatus(
        transaction.id, 
        'success', 
        'tx-success'
      );

      expect(updated.status).toBe('success');
      expect(updated.result).toBe('tx-success');
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(
        transactionService.updateTransactionStatus('non-existent', 'success')
      ).rejects.toThrow(WalletError);
    });
  });

  describe('getPendingTransactions', () => {
    it('should return only pending transactions', async () => {
      const pending1 = createMockTransaction({ id: 'tx-1', status: 'pending' });
      const pending2 = createMockTransaction({ id: 'tx-2', status: 'pending' });
      const completed = createMockTransaction({ id: 'tx-3', status: 'success' });

      await transactionService.addTransaction(pending1);
      await transactionService.addTransaction(pending2);
      await transactionService.addTransaction(completed);

      const pendingTxs = await transactionService.getPendingTransactions();
      
      expect(pendingTxs).toHaveLength(2);
      expect(pendingTxs.map(tx => tx.id)).toContain('tx-1');
      expect(pendingTxs.map(tx => tx.id)).toContain('tx-2');
    });
  });

  describe('clearHistory', () => {
    it('should clear all transaction history', async () => {
      await transactionService.addTransaction(createMockTransaction({ id: 'tx-1' }));
      await transactionService.addTransaction(createMockTransaction({ id: 'tx-2' }));

      let history = await transactionService.getHistory();
      expect(history).toHaveLength(2);

      await transactionService.clearHistory();

      history = await transactionService.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('getTransactionsByStatus', () => {
    it('should filter transactions by status', async () => {
      await transactionService.addTransaction(
        createMockTransaction({ id: 'tx-1', status: 'pending' })
      );
      await transactionService.addTransaction(
        createMockTransaction({ id: 'tx-2', status: 'success' })
      );
      await transactionService.addTransaction(
        createMockTransaction({ id: 'tx-3', status: 'failed' })
      );

      const successTxs = await transactionService.getTransactionsByStatus('success');
      expect(successTxs).toHaveLength(1);
      expect(successTxs[0].id).toBe('tx-2');

      const failedTxs = await transactionService.getTransactionsByStatus('failed');
      expect(failedTxs).toHaveLength(1);
      expect(failedTxs[0].id).toBe('tx-3');
    });
  });

  describe('exportTransactions', () => {
    it('should export all transactions', async () => {
      const tx1 = createMockTransaction({ id: 'tx-1' });
      const tx2 = createMockTransaction({ id: 'tx-2' });

      await transactionService.addTransaction(tx1);
      await transactionService.addTransaction(tx2);

      const exported = await transactionService.exportTransactions();
      
      expect(exported).toHaveLength(2);
      expect(exported.map(tx => tx.id)).toContain('tx-1');
      expect(exported.map(tx => tx.id)).toContain('tx-2');
    });
  });
});