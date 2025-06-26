import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping, buttonStyles } from "../styles/theme-mapping";
import type { Account } from "../types";
import type { DevWalletKey } from "../../types";

@customElement("pact-toolbox-connect-screen")
export class PactToolboxConnectScreen extends LitElement {
  @property({ type: Array }) accounts: Account[] = [];
  @property({ type: Object }) selectedAccount?: Account;
  @state() private selectedForConnection?: Account;

  static override styles = [
    baseStyles,
    themeMapping,
    buttonStyles,
    css`
      :host {
        display: block;
        height: 100%;
        padding: var(--pact-spacing-md);
      }

      .connect-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .connect-header {
        text-align: center;
        margin-bottom: var(--pact-spacing-xl);
      }

      .connect-title {
        font-size: var(--pact-font-size-2xl);
        font-weight: 700;
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-sm);
      }

      .connect-subtitle {
        color: var(--pact-text-secondary);
        font-size: var(--pact-font-size-base);
      }

      .dapp-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--pact-spacing-md);
        padding: var(--pact-spacing-xl);
        background: var(--pact-bg-secondary);
        border-radius: var(--pact-border-radius);
        margin-bottom: var(--pact-spacing-xl);
      }

      .dapp-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: var(--pact-bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        box-shadow: var(--pact-shadow-base);
      }

      .dapp-details {
        text-align: center;
      }

      .dapp-name {
        font-weight: 600;
        font-size: var(--pact-font-size-lg);
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-xs);
      }

      .dapp-url {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .permission-request {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid var(--pact-info);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        margin-bottom: var(--pact-spacing-xl);
      }

      .permission-title {
        font-weight: 600;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-info);
        margin-bottom: var(--pact-spacing-sm);
      }

      .permission-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .permission-item {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
        padding: var(--pact-spacing-xs) 0;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
      }

      .permission-icon {
        color: var(--pact-info);
      }

      .accounts-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        margin-bottom: var(--pact-spacing-lg);
      }

      .section-label {
        font-weight: 600;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
        margin-bottom: var(--pact-spacing-md);
      }

      .accounts-list {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-sm);
        overflow-y: auto;
        max-height: 250px;
        padding-right: var(--pact-spacing-sm);
      }
      
      /* Custom scrollbar */
      .accounts-list::-webkit-scrollbar {
        width: 6px;
      }
      
      .accounts-list::-webkit-scrollbar-track {
        background: var(--pact-bg-secondary);
        border-radius: 3px;
      }
      
      .accounts-list::-webkit-scrollbar-thumb {
        background: var(--pact-border-color);
        border-radius: 3px;
      }
      
      .accounts-list::-webkit-scrollbar-thumb:hover {
        background: var(--pact-text-secondary);
      }

      .account-option {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-md);
        padding: var(--pact-spacing-md);
        background: var(--pact-bg-secondary);
        border: 2px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
      }

      .account-option:hover {
        border-color: var(--pact-brand-primary);
        transform: translateY(-1px);
      }

      .account-option.selected {
        border-color: var(--pact-brand-primary);
        background: var(--pact-bg-primary);
      }

      .account-radio {
        width: 20px;
        height: 20px;
        border: 2px solid var(--pact-border-color);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--pact-transition-fast);
      }

      .account-option.selected .account-radio {
        border-color: var(--pact-brand-primary);
        background: var(--pact-brand-primary);
      }

      .account-option.selected .account-radio::after {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: white;
      }

      .account-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--pact-brand-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--pact-bg-primary);
        font-weight: 600;
        font-size: var(--pact-font-size-base);
      }

      .account-details {
        flex: 1;
        min-width: 0;
      }

      .account-name {
        font-weight: 600;
        font-size: var(--pact-font-size-base);
        color: var(--pact-text-primary);
        margin-bottom: 4px;
      }

      .account-address {
        font-family: monospace;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .action-buttons {
        display: flex;
        gap: var(--pact-spacing-md);
        padding-top: var(--pact-spacing-lg);
        border-top: 1px solid var(--pact-border-color);
      }

      .action-buttons button {
        flex: 1;
        padding: var(--pact-spacing-md);
        font-size: var(--pact-font-size-base);
        font-weight: 600;
      }

      .no-accounts {
        text-align: center;
        padding: var(--pact-spacing-xl);
        color: var(--pact-text-secondary);
      }

      .create-account-link {
        color: var(--pact-brand-primary);
        text-decoration: underline;
        cursor: pointer;
        background: none;
        border: none;
        font-size: inherit;
      }
    `,
  ];

  private getAccountInitial(account: Account): string {
    return account.name.charAt(0).toUpperCase();
  }

  private formatAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  private selectAccount(account: Account) {
    this.selectedForConnection = account;
  }

  private handleConnect() {
    if (!this.selectedForConnection) return;

    // Convert Account to DevWalletKey format
    const devWalletKey: DevWalletKey = {
      address: this.selectedForConnection.address,
      publicKey: this.selectedForConnection.publicKey,
      privateKey: this.selectedForConnection.privateKey || '',
      name: this.selectedForConnection.name,
      createdAt: Date.now(),
    };

    // Save selected account to localStorage
    localStorage.setItem("pact-toolbox-selected-account", JSON.stringify(devWalletKey));

    // Dispatch the event with the DevWalletKey
    this.dispatchEvent(new CustomEvent('connect-approved', {
      detail: { account: devWalletKey },
      bubbles: true,
      composed: true,
    }));
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent('connect-cancelled', {
      bubbles: true,
      composed: true,
    }));
  }

  private navigateToAccounts() {
    this.dispatchEvent(new CustomEvent('toolbox-navigate', {
      detail: { screen: 'accounts' },
      bubbles: true,
      composed: true,
    }));
  }

  override connectedCallback() {
    super.connectedCallback();
    // Auto-select the active account if available
    if (this.selectedAccount && !this.selectedForConnection) {
      this.selectedForConnection = this.selectedAccount;
    }
  }

  override render() {
    return html`
      <div class="connect-container">
        <div class="connect-header">
          <h2 class="connect-title">Connect Account</h2>
          <p class="connect-subtitle">Select an account to connect to this DApp</p>
        </div>

        <div class="dapp-info">
          <div class="dapp-icon">🌐</div>
          <div class="dapp-details">
            <div class="dapp-name">DApp Connection Request</div>
            <div class="dapp-url">${window.location.hostname}</div>
          </div>
        </div>

        <div class="permission-request">
          <div class="permission-title">This app would like to:</div>
          <ul class="permission-list">
            <li class="permission-item">
              <span class="permission-icon">✓</span>
              <span>View your account address</span>
            </li>
            <li class="permission-item">
              <span class="permission-icon">✓</span>
              <span>Request transaction signatures</span>
            </li>
            <li class="permission-item">
              <span class="permission-icon">✓</span>
              <span>View your account balance</span>
            </li>
          </ul>
        </div>

        <div class="accounts-section">
          <div class="section-label">Choose Account</div>
          
          ${this.accounts.length === 0
            ? html`
                <div class="no-accounts">
                  <p>No accounts found</p>
                  <button class="create-account-link" @click=${this.navigateToAccounts}>
                    Create an account first
                  </button>
                </div>
              `
            : html`
                <div class="accounts-list">
                  ${this.accounts.map(account => html`
                    <div
                      class="account-option ${account.address === this.selectedForConnection?.address ? 'selected' : ''}"
                      @click=${() => this.selectAccount(account)}
                    >
                      <div class="account-radio"></div>
                      <div class="account-avatar">
                        ${this.getAccountInitial(account)}
                      </div>
                      <div class="account-details">
                        <div class="account-name">${account.name}</div>
                        <div class="account-address">${this.formatAddress(account.address)}</div>
                      </div>
                    </div>
                  `)}
                </div>
              `}
        </div>

        <div class="action-buttons">
          <button class="btn-secondary" @click=${this.handleCancel}>
            Cancel
          </button>
          <button 
            class="btn-primary" 
            @click=${this.handleConnect}
            ?disabled=${!this.selectedForConnection}
          >
            Connect
          </button>
        </div>
      </div>
    `;
  }
}