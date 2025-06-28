import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModalManager } from './modal-manager';

// Mock the wallet service
vi.mock('@pact-toolbox/wallet-adapters', () => ({
  walletService: {
    getAvailableWallets: vi.fn().mockResolvedValue([
      { id: 'test-wallet', name: 'Test Wallet', icon: 'icon.png', type: 'browser-extension' },
      { id: 'another-wallet', name: 'Another Wallet', icon: 'icon2.png', type: 'built-in' },
    ]),
    connect: vi.fn().mockResolvedValue({
      isInstalled: () => true,
      connect: vi.fn(),
      getAccount: vi.fn().mockResolvedValue({ address: 'k:test', publicKey: 'test' }),
    }),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock the components
vi.mock('./components/wallet-modal', () => ({
  PactWalletModal: class extends HTMLElement {
    open = false;
    showModal() { this.open = true; }
    close() { this.open = false; }
  },
}));

vi.mock('./components/wallet-selector', () => ({
  PactWalletSelector: class extends HTMLElement {
    requestUpdate() {}
  },
}));

describe('ModalManager', () => {
  let modalManager: ModalManager;

  beforeEach(() => {
    // Clear singleton instance
    (ModalManager as any).instance = null;
    modalManager = ModalManager.getInstance();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    // Reset singleton
    (ModalManager as any).instance = null;
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = ModalManager.getInstance();
      const instance2 = ModalManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => modalManager.initialize()).not.toThrow();
    });

    it('should initialize with options', () => {
      const modalManagerWithOptions = ModalManager.getInstance({
        theme: 'dark',
      });
      expect(() => modalManagerWithOptions.initialize()).not.toThrow();
    });

    it('should create container element', () => {
      modalManager.initialize();
      const container = document.getElementById('pact-wallet-ui-root');
      expect(container).toBeTruthy();
    });
  });

  describe('theme management', () => {
    beforeEach(() => {
      modalManager.initialize();
    });

    it('should set theme to dark', () => {
      modalManager.setTheme('dark');
      const container = document.getElementById('pact-wallet-ui-root');
      const themeProvider = container?.querySelector('pact-theme-provider') as any;
      expect(themeProvider?.theme).toBe('dark');
    });

    it('should set theme to light', () => {
      modalManager.setTheme('light');
      const container = document.getElementById('pact-wallet-ui-root');
      const themeProvider = container?.querySelector('pact-theme-provider') as any;
      expect(themeProvider?.theme).toBe('light');
    });

    it('should handle auto theme', () => {
      // Auto theme is handled internally during initialization
      const modalManagerWithAuto = ModalManager.getInstance({ theme: 'auto' });
      modalManagerWithAuto.initialize();
      const container = document.getElementById('pact-wallet-ui-root');
      const themeProvider = container?.querySelector('pact-theme-provider') as any;
      // Auto theme gets resolved to either 'light' or 'dark' based on system preference
      expect(['light', 'dark']).toContain(themeProvider?.theme);
    });
  });

  describe('wallet connection', () => {
    it('should connect to wallet', async () => {
      const { walletService } = await import('@pact-toolbox/wallet-adapters');
      const mockWallet = {
        isInstalled: () => true,
        connect: vi.fn(),
        getAccount: vi.fn().mockResolvedValue({ address: 'k:test', publicKey: 'test' }),
      };
      (walletService.connect as any).mockResolvedValueOnce(mockWallet);
      
      const result = await modalManager.connectWallet('test-wallet');
      expect(result).toBe(true);
      expect(walletService.connect).toHaveBeenCalledWith('test-wallet');
    });

    it('should handle connection errors', async () => {
      const { walletService } = await import('@pact-toolbox/wallet-adapters');
      (walletService.connect as any).mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await modalManager.connectWallet('test-wallet');
      expect(result).toBe(false);
    });
  });

  // Note: ModalManager doesn't have a destroy method currently
});