import type { DevWalletSettings } from '../types';
import { WalletError } from '../types/error-types';
import { handleErrors } from '../utils/error-handler';
import { DevWalletStorage } from '../storage';

/**
 * Service for managing wallet settings
 */
export class SettingsService {
  private storage: DevWalletStorage;
  private currentSettings: DevWalletSettings | null = null;
  private readonly defaultSettings: DevWalletSettings = {
    autoLock: false,
    showTestNetworks: true,
  };

  constructor(storage?: DevWalletStorage) {
    this.storage = storage || new DevWalletStorage();
  }

  /**
   * Load settings from storage with caching
   */
  @handleErrors({ component: 'SettingsService' })
  async loadSettings(): Promise<DevWalletSettings> {
    try {
      // Return cached settings if available
      if (this.currentSettings) {
        return this.currentSettings;
      }

      const settings = await this.storage.getSettings();
      this.currentSettings = { ...this.defaultSettings, ...settings };
      
      console.log('Settings loaded successfully:', this.currentSettings);
      return this.currentSettings;
    } catch (error) {
      console.error('Failed to load settings, using defaults:', error);
      
      // Use default settings on error but still throw for error handling
      this.currentSettings = { ...this.defaultSettings };
      
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to load settings from storage',
        {
          severity: 'low',
          recoverable: true,
          cause: error as Error,
          context: { operation: 'loadSettings' },
        }
      );
    }
  }

  /**
   * Update a single setting
   */
  @handleErrors({ component: 'SettingsService' })
  async updateSetting<K extends keyof DevWalletSettings>(
    key: K,
    value: DevWalletSettings[K]
  ): Promise<DevWalletSettings> {
    try {
      // Ensure settings are loaded
      const currentSettings = this.currentSettings || await this.loadSettings();
      
      // Validate the setting update
      this.validateSettingUpdate(key, value);
      
      // Create new settings object
      const newSettings: DevWalletSettings = {
        ...currentSettings,
        [key]: value,
      };

      // Save to storage
      await this.storage.saveSettings(newSettings);
      
      // Update cache
      this.currentSettings = newSettings;
      
      console.log(`Setting ${key} updated to:`, value);
      
      // Dispatch settings change event
      this.dispatchSettingsChangedEvent(newSettings);
      
      return newSettings;
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'STORAGE_ERROR',
        `Failed to update setting ${key}`,
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'updateSetting', key, value },
        }
      );
    }
  }

  /**
   * Update multiple settings at once
   */
  @handleErrors({ component: 'SettingsService' })
  async updateSettings(updates: Partial<DevWalletSettings>): Promise<DevWalletSettings> {
    try {
      // Ensure settings are loaded
      const currentSettings = this.currentSettings || await this.loadSettings();
      
      // Validate all updates
      for (const [key, value] of Object.entries(updates)) {
        this.validateSettingUpdate(key as keyof DevWalletSettings, value);
      }
      
      // Create new settings object
      const newSettings: DevWalletSettings = {
        ...currentSettings,
        ...updates,
      };

      // Save to storage
      await this.storage.saveSettings(newSettings);
      
      // Update cache
      this.currentSettings = newSettings;
      
      console.log('Settings updated successfully:', updates);
      
      // Dispatch settings change event
      this.dispatchSettingsChangedEvent(newSettings);
      
      return newSettings;
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to update settings',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'updateSettings', updates },
        }
      );
    }
  }

  /**
   * Reset settings to defaults
   */
  @handleErrors({ component: 'SettingsService' })
  async resetToDefaults(): Promise<DevWalletSettings> {
    try {
      const defaultSettings = { ...this.defaultSettings };
      
      await this.storage.saveSettings(defaultSettings);
      this.currentSettings = defaultSettings;
      
      console.log('Settings reset to defaults');
      
      // Dispatch settings change event
      this.dispatchSettingsChangedEvent(defaultSettings);
      
      return defaultSettings;
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to reset settings to defaults',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'resetToDefaults' },
        }
      );
    }
  }

  /**
   * Export wallet data including settings
   */
  @handleErrors({ component: 'SettingsService' })
  async exportWalletData(): Promise<Blob> {
    try {
      // Get all data from storage
      const [accounts, transactions, settings] = await Promise.all([
        this.storage.getKeys(),
        this.storage.getTransactions(),
        this.storage.getSettings(),
      ]);

      if (accounts.length === 0) {
        throw WalletError.create(
          'VALIDATION_ERROR',
          'No accounts found to export',
          { severity: 'low', recoverable: true }
        );
      }

      // Create export data
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings,
        accounts: accounts.map(account => ({
          address: account.address,
          publicKey: account.publicKey,
          privateKey: account.privateKey,
          name: account.name,
          createdAt: account.createdAt,
        })),
        transactions: transactions.slice(0, 100), // Limit to last 100 transactions
        metadata: {
          exportedBy: 'pact-toolbox-dev-wallet',
          userAgent: navigator.userAgent,
          exportCount: accounts.length,
        },
      };

      // Create blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      console.log('Wallet data exported successfully');
      return blob;
    } catch (error) {
      if (error instanceof WalletError) {
        throw error;
      }
      throw WalletError.create(
        'EXPORT_FAILED',
        'Failed to export wallet data',
        {
          severity: 'medium',
          cause: error as Error,
          context: { operation: 'exportWalletData' },
        }
      );
    }
  }

  /**
   * Clear all wallet data
   */
  @handleErrors({ component: 'SettingsService' })
  async clearAllData(): Promise<void> {
    try {
      await this.storage.clearAllData();
      
      // Reset cached settings
      this.currentSettings = { ...this.defaultSettings };
      
      console.log('All wallet data cleared successfully');
      
      // Dispatch data cleared event
      this.dispatchDataClearedEvent();
    } catch (error) {
      throw WalletError.create(
        'STORAGE_ERROR',
        'Failed to clear wallet data',
        {
          severity: 'high',
          cause: error as Error,
          context: { operation: 'clearAllData' },
        }
      );
    }
  }

  /**
   * Get current settings (cached or load from storage)
   */
  async getCurrentSettings(): Promise<DevWalletSettings> {
    if (this.currentSettings) {
      return this.currentSettings;
    }
    return this.loadSettings();
  }

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(feature: keyof DevWalletSettings): Promise<boolean> {
    const settings = await this.getCurrentSettings();
    return Boolean(settings[feature]);
  }

  /**
   * Get settings validation status
   */
  validateSettings(settings: DevWalletSettings): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate autoLock
    if (typeof settings.autoLock !== 'boolean') {
      errors.push('autoLock must be a boolean value');
    }

    // Validate showTestNetworks
    if (typeof settings.showTestNetworks !== 'boolean') {
      errors.push('showTestNetworks must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear settings cache (useful for testing)
   */
  clearCache(): void {
    this.currentSettings = null;
  }

  private validateSettingUpdate<K extends keyof DevWalletSettings>(
    key: K,
    value: DevWalletSettings[K]
  ): void {
    switch (key) {
      case 'autoLock':
        if (typeof value !== 'boolean') {
          throw WalletError.create(
            'VALIDATION_ERROR',
            'autoLock setting must be a boolean value',
            { severity: 'low', recoverable: true }
          );
        }
        break;
      
      case 'showTestNetworks':
        if (typeof value !== 'boolean') {
          throw WalletError.create(
            'VALIDATION_ERROR',
            'showTestNetworks setting must be a boolean value',
            { severity: 'low', recoverable: true }
          );
        }
        break;
      
      default:
        console.warn(`Unknown setting key: ${key}`);
    }
  }

  private dispatchSettingsChangedEvent(settings: DevWalletSettings): void {
    const event = new CustomEvent('settings-changed', {
      detail: { settings },
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }

  private dispatchDataClearedEvent(): void {
    const event = new CustomEvent('wallet-data-cleared', {
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }
}