import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping, buttonStyles } from "../styles/theme-mapping";
import { DevWalletStorage } from "../../storage";
import type { DevWalletSettings } from "../../types";

@customElement("pact-toolbox-settings-screen")
export class PactToolboxSettingsScreen extends LitElement {
  @state() private showExportWarning = false;
  @state() private showClearDataWarning = false;
  @state() private settings: DevWalletSettings = {
    autoLock: false,
    showTestNetworks: true,
  };

  private storage = new DevWalletStorage();

  static override styles = [
    baseStyles,
    themeMapping,
    buttonStyles,
    css`
      :host {
        display: block;
        height: 100%;
        padding: var(--pact-spacing-lg);
      }

      .screen-header {
        margin-bottom: var(--pact-spacing-xl);
      }

      .screen-title {
        font-size: var(--pact-font-size-2xl);
        font-weight: 700;
        color: var(--pact-text-primary);
      }

      .settings-section {
        background: var(--pact-bg-secondary);
        border: 1px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-lg);
        margin-bottom: var(--pact-spacing-md);
      }

      .section-title {
        font-weight: 600;
        font-size: var(--pact-font-size-lg);
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-sm);
      }

      .section-description {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
        margin-bottom: var(--pact-spacing-lg);
      }

      .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--pact-spacing-md) 0;
        border-bottom: 1px solid var(--pact-border-color);
      }

      .setting-item:last-child {
        border-bottom: none;
      }

      .setting-info {
        flex: 1;
      }

      .setting-label {
        font-weight: 500;
        font-size: var(--pact-font-size-base);
        color: var(--pact-text-primary);
        margin-bottom: 4px;
      }

      .setting-sublabel {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .toggle-switch {
        position: relative;
        width: 48px;
        height: 24px;
        background: var(--pact-border-color);
        border-radius: 24px;
        cursor: pointer;
        transition: background var(--pact-transition-fast);
      }

      .toggle-switch.active {
        background: var(--pact-brand-primary);
      }

      .toggle-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform var(--pact-transition-fast);
      }

      .toggle-switch.active::after {
        transform: translateX(24px);
      }

      .danger-section {
        background: rgba(239, 68, 68, 0.05);
        border-color: rgba(239, 68, 68, 0.3);
      }

      .danger-button {
        background: var(--pact-error);
        color: white;
        border: none;
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        border-radius: var(--pact-border-radius);
        font-weight: 500;
        cursor: pointer;
        transition: all var(--pact-transition-fast);
      }

      .danger-button:hover {
        background: #dc2626;
      }

      .about-section {
        text-align: center;
        padding: var(--pact-spacing-xl);
        color: var(--pact-text-secondary);
      }

      .logo {
        font-size: 48px;
        margin-bottom: var(--pact-spacing-md);
      }

      .version {
        font-size: var(--pact-font-size-sm);
        margin-bottom: var(--pact-spacing-sm);
      }

      .links {
        display: flex;
        justify-content: center;
        gap: var(--pact-spacing-lg);
        margin-top: var(--pact-spacing-lg);
      }

      .link {
        color: var(--pact-brand-primary);
        text-decoration: none;
        font-size: var(--pact-font-size-sm);
      }

      .link:hover {
        text-decoration: underline;
      }

      .warning-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--pact-bg-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: var(--pact-z-index-fixed);
        padding: var(--pact-spacing-lg);
      }

      .warning-content {
        background: var(--pact-bg-primary);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-xl);
        max-width: 400px;
        width: 100%;
      }

      .warning-title {
        font-size: var(--pact-font-size-xl);
        font-weight: 600;
        color: var(--pact-error);
        margin-bottom: var(--pact-spacing-md);
      }

      .warning-message {
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-xl);
      }

      .warning-actions {
        display: flex;
        gap: var(--pact-spacing-sm);
      }

      .warning-actions button {
        flex: 1;
      }
    `,
  ];

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadSettings();
  }

  private async loadSettings() {
    try {
      this.settings = await this.storage.getSettings();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  private async updateSetting(key: keyof DevWalletSettings, value: boolean) {
    const newSettings = { ...this.settings, [key]: value };
    
    try {
      await this.storage.saveSettings(newSettings);
      this.settings = newSettings;
      
      // Dispatch event to notify parent of settings change
      this.dispatchEvent(new CustomEvent('settings-changed', {
        detail: { settings: newSettings },
        bubbles: true,
        composed: true,
      }));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  private async handleToggleAutoLock() {
    await this.updateSetting('autoLock', !this.settings.autoLock);
  }

  private async handleToggleShowTestNetworks() {
    await this.updateSetting('showTestNetworks', !this.settings.showTestNetworks);
  }

  private async handleExportKeys() {
    // Notify parent to handle export
    this.dispatchEvent(new CustomEvent('wallet-export-requested', {
      bubbles: true,
      composed: true,
    }));

    this.showExportWarning = false;
  }

  private async handleClearData() {
    // Notify parent to clear all data through storage service
    this.dispatchEvent(new CustomEvent('wallet-data-cleared', {
      bubbles: true,
      composed: true,
    }));

    this.showClearDataWarning = false;
  }

  override render() {
    return html`
      <div class="screen-header">
        <h2 class="screen-title">Settings</h2>
      </div>

      <div class="settings-section">
        <h3 class="section-title">General</h3>
        <p class="section-description">Manage your wallet preferences</p>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">Auto-lock</div>
            <div class="setting-sublabel">Lock wallet after 5 minutes of inactivity</div>
          </div>
          <div 
            class="toggle-switch ${this.settings.autoLock ? 'active' : ''}" 
            @click=${this.handleToggleAutoLock}
          ></div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">Show test networks</div>
            <div class="setting-sublabel">Display testnet and local networks</div>
          </div>
          <div 
            class="toggle-switch ${this.settings.showTestNetworks ? 'active' : ''}" 
            @click=${this.handleToggleShowTestNetworks}
          ></div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="section-title">Security & Privacy</h3>
        <p class="section-description">Manage your keys and data</p>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">Export account data</div>
            <div class="setting-sublabel">Download a backup of your accounts</div>
          </div>
          <button class="btn-secondary" @click=${() => this.showExportWarning = true}>
            Export
          </button>
        </div>
      </div>

      <div class="settings-section danger-section">
        <h3 class="section-title">Danger Zone</h3>
        <p class="section-description">Irreversible actions</p>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">Clear all data</div>
            <div class="setting-sublabel">Remove all accounts and transaction history</div>
          </div>
          <button class="danger-button" @click=${() => this.showClearDataWarning = true}>
            Clear Data
          </button>
        </div>
      </div>

      <div class="about-section">
        <div class="logo">🧰</div>
        <h3>Pact Toolbox Wallet</h3>
        <div class="version">Version 1.0.0</div>
        <p>A development wallet for Kadena blockchain</p>
        
        <div class="links">
          <a href="https://github.com/kadena-io/pact-toolbox" target="_blank" class="link">GitHub</a>
          <a href="https://docs.kadena.io" target="_blank" class="link">Documentation</a>
        </div>
      </div>

      ${this.showExportWarning ? html`
        <div class="warning-dialog">
          <div class="warning-content">
            <h3 class="warning-title">⚠️ Export Account Data</h3>
            <p class="warning-message">
              This will download a file containing all your account information, including private keys. 
              Keep this file secure and never share it with anyone.
            </p>
            <div class="warning-actions">
              <button class="btn-secondary" @click=${() => this.showExportWarning = false}>
                Cancel
              </button>
              <button class="btn-primary" @click=${this.handleExportKeys}>
                I Understand, Export
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showClearDataWarning ? html`
        <div class="warning-dialog">
          <div class="warning-content">
            <h3 class="warning-title">⚠️ Clear All Data</h3>
            <p class="warning-message">
              This will permanently delete all your accounts, transaction history, and settings. 
              This action cannot be undone. Make sure you have backed up any important data.
            </p>
            <div class="warning-actions">
              <button class="btn-secondary" @click=${() => this.showClearDataWarning = false}>
                Cancel
              </button>
              <button class="danger-button" @click=${this.handleClearData}>
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}