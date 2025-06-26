import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping, buttonStyles } from "../styles/theme-mapping";
import type { Account } from "../types";

@customElement("pact-toolbox-accounts-screen")
export class PactToolboxAccountsScreen extends LitElement {
  @property({ type: Array }) accounts: Account[] = [];
  @property({ type: Object }) selectedAccount?: Account;
  @state() private showImportDialog = false;
  @state() private showCreateDialog = false;
  @state() private importError = "";
  @state() private isGenerating = false;

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
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--pact-spacing-xl);
      }

      .screen-title {
        font-size: var(--pact-font-size-2xl);
        font-weight: 700;
        color: var(--pact-text-primary);
      }

      .action-buttons {
        display: flex;
        gap: var(--pact-spacing-sm);
      }

      .accounts-list {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-md);
      }

      .account-card {
        background: var(--pact-bg-secondary);
        border: 2px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-lg);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
        position: relative;
      }

      .account-card:hover {
        border-color: var(--pact-brand-primary);
        transform: translateY(-2px);
        box-shadow: var(--pact-shadow-base);
      }

      .account-card.selected {
        border-color: var(--pact-brand-primary);
        background: var(--pact-bg-primary);
      }

      .account-card.selected::after {
        content: '✓';
        position: absolute;
        top: var(--pact-spacing-md);
        right: var(--pact-spacing-md);
        background: var(--pact-brand-primary);
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .account-header {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-md);
        margin-bottom: var(--pact-spacing-sm);
      }

      .connect-indicator,
      .connected-indicator {
        font-size: 18px;
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        transition: all var(--pact-transition-fast);
      }

      .connect-indicator {
        background: var(--pact-bg-tertiary);
        color: var(--pact-text-secondary);
      }

      .connected-indicator {
        background: var(--pact-success);
        color: white;
      }

      .account-card:hover .connect-indicator {
        background: var(--pact-brand-primary);
        color: white;
        transform: scale(1.1);
      }

      .account-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: var(--pact-font-size-xl);
      }

      .account-info {
        flex: 1;
      }

      .account-name {
        font-weight: 600;
        font-size: var(--pact-font-size-lg);
        color: var(--pact-text-primary);
        margin-bottom: 4px;
      }

      .account-address {
        font-family: monospace;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .account-balance {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--pact-spacing-md);
        padding-top: var(--pact-spacing-md);
        border-top: 1px solid var(--pact-border-color);
      }

      .balance-label {
        color: var(--pact-text-secondary);
        font-size: var(--pact-font-size-sm);
      }

      .balance-value {
        font-weight: 600;
        font-size: var(--pact-font-size-lg);
        color: var(--pact-text-primary);
      }

      .empty-state {
        text-align: center;
        padding: var(--pact-spacing-xl) 0;
        color: var(--pact-text-secondary);
      }

      .empty-icon {
        font-size: 64px;
        margin-bottom: var(--pact-spacing-md);
      }

      .dialog-overlay {
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

      .dialog {
        background: var(--pact-bg-primary);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-xl);
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
      }

      .dialog-header {
        margin-bottom: var(--pact-spacing-lg);
      }

      .dialog-title {
        font-size: var(--pact-font-size-xl);
        font-weight: 600;
        color: var(--pact-text-primary);
      }

      .form-group {
        margin-bottom: var(--pact-spacing-lg);
      }

      .form-label {
        display: block;
        margin-bottom: var(--pact-spacing-sm);
        font-weight: 500;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
      }

      .form-input {
        width: 100%;
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        border: 1px solid var(--pact-border-color);
        border-radius: 8px;
        font-family: inherit;
        font-size: var(--pact-font-size-base);
        background: var(--pact-bg-primary);
        color: var(--pact-text-primary);
      }

      .form-input:focus {
        outline: none;
        border-color: var(--pact-brand-primary);
      }

      .form-actions {
        display: flex;
        gap: var(--pact-spacing-sm);
        margin-top: var(--pact-spacing-xl);
      }

      .form-actions button {
        flex: 1;
      }

      .error-message {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid var(--pact-error);
        border-radius: 8px;
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        margin-bottom: var(--pact-spacing-md);
        color: var(--pact-error);
        font-size: var(--pact-font-size-sm);
      }
    `,
  ];

  private formatAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  private getAccountInitial(account: Account): string {
    return account.name.charAt(0).toUpperCase();
  }

  private selectAccount(account: Account) {
    this.dispatchEvent(new CustomEvent('toolbox-account-selected', {
      detail: { account },
      bubbles: true,
      composed: true,
    }));
  }

  private async generateNewAccount() {
    this.isGenerating = true;
    try {
      const { generateExtractableKeyPair, exportBase16Key } = await import("@pact-toolbox/crypto");
      
      const keyPair = await generateExtractableKeyPair();
      const publicKey = await exportBase16Key(keyPair.publicKey);
      const privateKey = await exportBase16Key(keyPair.privateKey);
      
      const newAccount: Account = {
        address: `k:${publicKey}`,
        publicKey,
        privateKey,
        name: `Account ${this.accounts.length + 1}`,
        balance: 0,
        chainId: "0",
      };

      // Save to localStorage
      const updatedAccounts = [...this.accounts, newAccount];
      localStorage.setItem("pact-toolbox-wallet-accounts", JSON.stringify(updatedAccounts));
      
      // Notify parent
      this.dispatchEvent(new CustomEvent('account-created', {
        detail: { account: newAccount },
        bubbles: true,
        composed: true,
      }));

      this.showCreateDialog = false;
    } catch (error) {
      console.error("Failed to generate account:", error);
    } finally {
      this.isGenerating = false;
    }
  }

  private async handleImport(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const privateKey = formData.get("privateKey") as string;

    if (!privateKey) {
      this.importError = "Private key is required";
      return;
    }

    try {
      const { KeyPairSigner } = await import("@pact-toolbox/signers");
      
      const signer = await KeyPairSigner.fromPrivateKeyHex(privateKey.trim(), true);
      const publicKey = signer.address.startsWith('k:') ? signer.address.slice(2) : signer.address;
      
      const newAccount: Account = {
        address: signer.address,
        publicKey,
        privateKey: privateKey.trim(),
        name: name || `Imported ${this.accounts.length + 1}`,
        balance: 0,
        chainId: "0",
      };

      // Save to localStorage
      const updatedAccounts = [...this.accounts, newAccount];
      localStorage.setItem("pact-toolbox-wallet-accounts", JSON.stringify(updatedAccounts));
      
      // Notify parent
      this.dispatchEvent(new CustomEvent('account-imported', {
        detail: { account: newAccount },
        bubbles: true,
        composed: true,
      }));

      this.showImportDialog = false;
      this.importError = "";
      form.reset();
    } catch (error) {
      this.importError = error instanceof Error ? error.message : "Invalid private key";
    }
  }

  override render() {
    return html`
      <div class="screen-header">
        <h2 class="screen-title">Accounts</h2>
        <div class="action-buttons">
          <button class="btn-primary" @click=${() => this.showCreateDialog = true}>
            + Create
          </button>
          <button class="btn-secondary" @click=${() => this.showImportDialog = true}>
            Import
          </button>
        </div>
      </div>

      ${this.accounts.length === 0
        ? html`
            <div class="empty-state">
              <div class="empty-icon">🔐</div>
              <h3>No accounts yet</h3>
              <p>Create or import an account to get started</p>
            </div>
          `
        : html`
            <div class="accounts-list">
              ${this.accounts.map(account => html`
                <div
                  class="account-card ${account.address === this.selectedAccount?.address ? 'selected' : ''}"
                  @click=${() => this.selectAccount(account)}
                >
                  <div class="account-header">
                    <div class="account-avatar">
                      ${this.getAccountInitial(account)}
                    </div>
                    <div class="account-info">
                      <div class="account-name">${account.name}</div>
                      <div class="account-address">${this.formatAddress(account.address)}</div>
                    </div>
                    ${account.address !== this.selectedAccount?.address ? html`
                      <div class="connect-indicator" title="Click to connect this account">
                        🔗
                      </div>
                    ` : html`
                      <div class="connected-indicator" title="Currently connected">
                        ✓
                      </div>
                    `}
                  </div>
                  <div class="account-balance">
                    <span class="balance-label">Balance</span>
                    <span class="balance-value">${account.balance || 0} KDA</span>
                  </div>
                </div>
              `)}
            </div>
          `}

      ${this.showCreateDialog ? html`
        <div class="dialog-overlay" @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.showCreateDialog = false;
        }}>
          <div class="dialog">
            <div class="dialog-header">
              <h3 class="dialog-title">Create New Account</h3>
            </div>
            
            <p>Generate a new account with a random key pair.</p>
            
            <div class="form-actions">
              <button class="btn-secondary" @click=${() => this.showCreateDialog = false}>
                Cancel
              </button>
              <button 
                class="btn-primary" 
                @click=${this.generateNewAccount}
                ?disabled=${this.isGenerating}
              >
                ${this.isGenerating ? html`<span class="spinner"></span>` : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showImportDialog ? html`
        <div class="dialog-overlay" @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.showImportDialog = false;
        }}>
          <div class="dialog">
            <div class="dialog-header">
              <h3 class="dialog-title">Import Account</h3>
            </div>

            ${this.importError ? html`
              <div class="error-message">${this.importError}</div>
            ` : ''}

            <form @submit=${this.handleImport}>
              <div class="form-group">
                <label class="form-label" for="account-name">Account Name</label>
                <input
                  type="text"
                  id="account-name"
                  name="name"
                  class="form-input"
                  placeholder="My Account"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="private-key">Private Key (hex)</label>
                <input
                  type="text"
                  id="private-key"
                  name="privateKey"
                  class="form-input"
                  placeholder="Enter your private key..."
                  required
                />
              </div>

              <div class="form-actions">
                <button type="button" class="btn-secondary" @click=${() => {
                  this.showImportDialog = false;
                  this.importError = "";
                }}>
                  Cancel
                </button>
                <button type="submit" class="btn-primary">Import</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    `;
  }
}