import { describe, it, expect, beforeEach } from 'vitest';
import { KeypairWalletProvider } from './provider';

describe('KeypairWalletProvider', () => {
  let provider: KeypairWalletProvider;

  beforeEach(() => {
    provider = new KeypairWalletProvider();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(provider.metadata.id).toBe('keypair');
      expect(provider.metadata.type).toBe('built-in');
      expect(provider.metadata.icon).toBeDefined();
    });
  });

  describe('availability', () => {
    it('should always be available', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });
  });

  describe('wallet creation', () => {
    it('should create wallet instance', async () => {
      const wallet = await provider.createWallet();
      expect(wallet).toBeDefined();
      expect(wallet.isInstalled()).toBe(true);
    });
  });
});