import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from './settings-service';
import { DevWalletStorage } from '../storage';
import { WalletError } from '../types/error-types';
import { 
  setupBrowserMocks, 
  resetMocks, 
  createMockSettings,
  createMockDevWalletKey,
  mockDocument 
} from '../test-utils/setup';

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockStorage: DevWalletStorage;

  beforeEach(() => {
    setupBrowserMocks();
    resetMocks();
    
    mockStorage = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
      clearAllData: vi.fn(),
      getKeys: vi.fn(),
      getTransactions: vi.fn(),
    } as any;

    settingsService = new SettingsService(mockStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
    settingsService.clearCache();
  });

  describe('loadSettings', () => {
    it('should load settings from storage', async () => {
      const mockSettings = createMockSettings({ autoLock: true });
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      const settings = await settingsService.loadSettings();

      expect(settings).toEqual(mockSettings);
      expect(mockStorage.getSettings).toHaveBeenCalledOnce();
    });

    it('should merge with defaults when partial settings loaded', async () => {
      const partialSettings = { autoLock: true }; // missing showTestNetworks
      mockStorage.getSettings = vi.fn().mockResolvedValue(partialSettings);

      const settings = await settingsService.loadSettings();

      expect(settings).toEqual({
        autoLock: true,
        showTestNetworks: true, // default value
      });
    });

    it('should use defaults on storage error', async () => {
      mockStorage.getSettings = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(settingsService.loadSettings()).rejects.toThrow(WalletError);
    });

    it('should return cached settings on subsequent calls', async () => {
      const mockSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      // First call
      await settingsService.loadSettings();
      // Second call
      const settings = await settingsService.loadSettings();

      expect(settings).toEqual(mockSettings);
      expect(mockStorage.getSettings).toHaveBeenCalledOnce(); // Only called once due to caching
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting', async () => {
      const initialSettings = createMockSettings({ autoLock: false });
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      const updatedSettings = await settingsService.updateSetting('autoLock', true);

      expect(updatedSettings.autoLock).toBe(true);
      expect(mockStorage.saveSettings).toHaveBeenCalledWith({
        autoLock: true,
        showTestNetworks: true,
      });
    });

    it('should dispatch settings changed event', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      await settingsService.updateSetting('autoLock', true);

      expect(mockDocument.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settings-changed',
          detail: expect.objectContaining({
            settings: expect.objectContaining({ autoLock: true }),
          }),
        })
      );
    });

    it('should validate setting values', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);

      await expect(
        settingsService.updateSetting('autoLock', 'invalid' as any)
      ).rejects.toThrow(WalletError);
    });

    it('should handle storage errors', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);
      mockStorage.saveSettings = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(
        settingsService.updateSetting('autoLock', true)
      ).rejects.toThrow(WalletError);
    });
  });

  describe('updateSettings', () => {
    it('should update multiple settings at once', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      const updates = { autoLock: true, showTestNetworks: false };
      const updatedSettings = await settingsService.updateSettings(updates);

      expect(updatedSettings).toEqual(updates);
      expect(mockStorage.saveSettings).toHaveBeenCalledWith(updates);
    });

    it('should validate all updates', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);

      const invalidUpdates = { autoLock: 'invalid' as any };

      await expect(
        settingsService.updateSettings(invalidUpdates)
      ).rejects.toThrow(WalletError);
    });

    it('should dispatch settings changed event', async () => {
      const initialSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(initialSettings);
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      const updates = { autoLock: true };
      await settingsService.updateSettings(updates);

      expect(mockDocument.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settings-changed',
        })
      );
    });
  });

  describe('resetToDefaults', () => {
    it('should reset settings to default values', async () => {
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      const settings = await settingsService.resetToDefaults();

      expect(settings).toEqual({
        autoLock: false,
        showTestNetworks: true,
      });
      expect(mockStorage.saveSettings).toHaveBeenCalledWith({
        autoLock: false,
        showTestNetworks: true,
      });
    });

    it('should dispatch settings changed event', async () => {
      mockStorage.saveSettings = vi.fn().mockResolvedValue(undefined);

      await settingsService.resetToDefaults();

      expect(mockDocument.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settings-changed',
        })
      );
    });

    it('should handle storage errors', async () => {
      mockStorage.saveSettings = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(settingsService.resetToDefaults()).rejects.toThrow(WalletError);
    });
  });

  describe('exportWalletData', () => {
    it('should export wallet data as blob', async () => {
      const mockKeys = [createMockDevWalletKey()];
      const mockTransactions = [{ id: 'tx1', status: 'success' }];
      const mockSettings = createMockSettings();

      mockStorage.getKeys = vi.fn().mockResolvedValue(mockKeys);
      mockStorage.getTransactions = vi.fn().mockResolvedValue(mockTransactions);
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      const blob = await settingsService.exportWalletData();

      expect(blob).toBeInstanceOf(globalThis.Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should throw error when no accounts to export', async () => {
      mockStorage.getKeys = vi.fn().mockResolvedValue([]);
      mockStorage.getTransactions = vi.fn().mockResolvedValue([]);
      mockStorage.getSettings = vi.fn().mockResolvedValue(createMockSettings());

      await expect(settingsService.exportWalletData()).rejects.toThrow(WalletError);
      await expect(settingsService.exportWalletData()).rejects.toThrow('No accounts found to export');
    });

    it('should handle storage errors', async () => {
      mockStorage.getKeys = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(settingsService.exportWalletData()).rejects.toThrow(WalletError);
    });

    it('should limit transactions in export', async () => {
      const mockKeys = [createMockDevWalletKey()];
      const mockTransactions = Array.from({ length: 150 }, (_, i) => ({ id: `tx${i}` }));
      const mockSettings = createMockSettings();

      mockStorage.getKeys = vi.fn().mockResolvedValue(mockKeys);
      mockStorage.getTransactions = vi.fn().mockResolvedValue(mockTransactions);
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      await settingsService.exportWalletData();

      // Should limit to 100 transactions
      expect(mockStorage.getTransactions).toHaveBeenCalled();
    });
  });

  describe('clearAllData', () => {
    it('should clear all data and reset cache', async () => {
      mockStorage.clearAllData = vi.fn().mockResolvedValue(undefined);

      await settingsService.clearAllData();

      expect(mockStorage.clearAllData).toHaveBeenCalledOnce();
    });

    it('should dispatch data cleared event', async () => {
      mockStorage.clearAllData = vi.fn().mockResolvedValue(undefined);

      await settingsService.clearAllData();

      expect(mockDocument.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'wallet-data-cleared',
        })
      );
    });

    it('should handle storage errors', async () => {
      mockStorage.clearAllData = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(settingsService.clearAllData()).rejects.toThrow(WalletError);
    });
  });

  describe('getCurrentSettings', () => {
    it('should return cached settings if available', async () => {
      const mockSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      // Load settings to cache them
      await settingsService.loadSettings();
      
      // Get current settings
      const settings = await settingsService.getCurrentSettings();

      expect(settings).toEqual(mockSettings);
      expect(mockStorage.getSettings).toHaveBeenCalledOnce(); // Only called during initial load
    });

    it('should load settings if not cached', async () => {
      const mockSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      const settings = await settingsService.getCurrentSettings();

      expect(settings).toEqual(mockSettings);
      expect(mockStorage.getSettings).toHaveBeenCalledOnce();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', async () => {
      const mockSettings = createMockSettings({ autoLock: true });
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      const isEnabled = await settingsService.isFeatureEnabled('autoLock');

      expect(isEnabled).toBe(true);
    });

    it('should return false for disabled features', async () => {
      const mockSettings = createMockSettings({ autoLock: false });
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      const isEnabled = await settingsService.isFeatureEnabled('autoLock');

      expect(isEnabled).toBe(false);
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const settings = createMockSettings();
      const result = settingsService.validateSettings(settings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid autoLock type', () => {
      const settings = createMockSettings({ autoLock: 'invalid' as any });
      const result = settingsService.validateSettings(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('autoLock must be a boolean value');
    });

    it('should reject invalid showTestNetworks type', () => {
      const settings = createMockSettings({ showTestNetworks: 'invalid' as any });
      const result = settingsService.validateSettings(settings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('showTestNetworks must be a boolean value');
    });
  });

  describe('clearCache', () => {
    it('should clear cached settings', async () => {
      const mockSettings = createMockSettings();
      mockStorage.getSettings = vi.fn().mockResolvedValue(mockSettings);

      // Load settings to cache them
      await settingsService.loadSettings();
      
      // Clear cache
      settingsService.clearCache();
      
      // Load again - should call storage again
      await settingsService.getCurrentSettings();

      expect(mockStorage.getSettings).toHaveBeenCalledTimes(2);
    });
  });
});