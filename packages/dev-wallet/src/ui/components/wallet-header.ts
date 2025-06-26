import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../styles/theme-mapping";
import "@pact-toolbox/ui-shared";
import type { Account, Network } from "../types";

@customElement("pact-toolbox-wallet-header")
export class PactToolboxWalletHeader extends LitElement {
  @property({ type: Object }) selectedAccount?: Account;
  @property({ type: Object }) activeNetwork?: Network;

  static override styles = [
    baseStyles,
    themeMapping,
    css`
      :host {
        display: block;
        background: var(--pact-bg-secondary);
        border-bottom: 1px solid var(--pact-border-color);
        padding: var(--pact-spacing-md) var(--pact-spacing-lg);
        height: 48px;
        display: flex;
        align-items: center;
      }

      .header-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--pact-spacing-md);
        width: 100%;
      }

      .account-info {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
        flex: 1;
        min-width: 0;
      }


      .account-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .account-name {
        font-weight: 600;
        font-size: var(--pact-font-size-base);
        color: var(--pact-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .account-address {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
        font-family: monospace;
      }


      .network-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--pact-success);
        display: inline-block;
        margin-right: var(--pact-spacing-xs);
      }
      
      .network-badge {
        display: inline-flex;
        align-items: center;
        background: var(--pact-bg-tertiary);
        color: var(--pact-text-primary);
        padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        border-radius: var(--pact-border-radius-full);
        font-size: var(--pact-font-size-sm);
        font-weight: 500;
        cursor: pointer;
        transition: all var(--pact-transition-fast);
      }
      
      .network-badge:hover {
        background: var(--pact-bg-secondary);
      }

      .no-account {
        color: var(--pact-text-secondary);
        font-style: italic;
      }

      .close-button {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: var(--pact-text-secondary);
        cursor: pointer;
        border-radius: var(--pact-border-radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all var(--pact-transition-fast);
        flex-shrink: 0;
      }

      .close-button:hover {
        background: var(--pact-bg-tertiary);
        color: var(--pact-text-primary);
      }

      .close-button:active {
        transform: scale(0.95);
      }
    `,
  ];

  private formatAddress(address: string): string {
    if (address.length <= 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private getAccountInitial(account: Account): string {
    return account.name.charAt(0).toUpperCase();
  }

  private handleNetworkClick() {
    this.dispatchEvent(new CustomEvent('toolbox-navigate', {
      detail: { screen: 'networks' },
      bubbles: true,
      composed: true,
    }));
  }

  private handleCloseClick() {
    this.dispatchEvent(new CustomEvent('toolbox-close-wallet', {
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    return html`
      <div class="header-container">
        <div class="account-info">
          ${this.selectedAccount
            ? html`
                <pact-avatar
                  .name=${this.selectedAccount.name}
                  size="md"
                ></pact-avatar>
                <div class="account-details">
                  <div class="account-name">${this.selectedAccount.name}</div>
                  <div class="account-address">
                    ${this.formatAddress(this.selectedAccount.address)}
                  </div>
                </div>
              `
            : html`
                <div class="no-account">No account selected</div>
              `}
        </div>

        ${this.activeNetwork
          ? html`
              <div class="network-badge" @click=${this.handleNetworkClick}>
                <span class="network-indicator"></span>
                ${this.activeNetwork.name}
              </div>
            `
          : null}

        <button class="close-button" @click=${this.handleCloseClick} title="Close wallet">
          ✕
        </button>
      </div>
    `;
  }
}