import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../styles/theme-mapping";
import type { Account, Transaction } from "../types";

@customElement("pact-toolbox-transactions-screen")
export class PactToolboxTransactionsScreen extends LitElement {
  @property({ type: Array }) transactions: Transaction[] = [];
  @property({ type: Object }) selectedAccount?: Account;
  @property({ type: String }) expandedTransactionId?: string;

  static override styles = [
    baseStyles,
    themeMapping,
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

      .transactions-list {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-sm);
      }

      .transaction-card {
        background: var(--pact-bg-secondary);
        border: 1px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        display: flex;
        align-items: flex-start;
        gap: var(--pact-spacing-md);
        transition: all var(--pact-transition-fast);
        cursor: pointer;
      }

      .transaction-card:hover {
        background: var(--pact-bg-primary);
        box-shadow: var(--pact-shadow-sm);
      }

      .transaction-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .transaction-icon.send {
        background: rgba(239, 68, 68, 0.1);
        color: var(--pact-error);
      }

      .transaction-icon.receive {
        background: rgba(16, 185, 129, 0.1);
        color: var(--pact-success);
      }

      .transaction-icon.contract {
        background: rgba(59, 130, 246, 0.1);
        color: var(--pact-info);
      }

      .transaction-info {
        flex: 1;
        min-width: 0;
      }

      .transaction-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 4px;
      }

      .transaction-type {
        font-weight: 600;
        font-size: var(--pact-font-size-base);
        color: var(--pact-text-primary);
      }

      .transaction-amount {
        font-weight: 600;
        font-size: var(--pact-font-size-base);
      }

      .transaction-amount.positive {
        color: var(--pact-success);
      }

      .transaction-amount.negative {
        color: var(--pact-error);
      }

      .transaction-details {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-md);
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .transaction-address {
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .transaction-time {
        flex-shrink: 0;
      }

      .transaction-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: var(--pact-font-size-xs);
        font-weight: 500;
      }

      .transaction-status.pending {
        background: rgba(251, 191, 36, 0.1);
        color: var(--pact-warning);
      }

      .transaction-status.success {
        background: rgba(16, 185, 129, 0.1);
        color: var(--pact-success);
      }

      .transaction-status.failure {
        background: rgba(239, 68, 68, 0.1);
        color: var(--pact-error);
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

      .filter-tabs {
        display: flex;
        gap: var(--pact-spacing-sm);
        margin-bottom: var(--pact-spacing-lg);
        border-bottom: 1px solid var(--pact-border-color);
        padding-bottom: var(--pact-spacing-sm);
      }

      .filter-tab {
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        background: none;
        border: none;
        color: var(--pact-text-secondary);
        font-weight: 500;
        cursor: pointer;
        transition: all var(--pact-transition-fast);
        position: relative;
      }

      .filter-tab:hover {
        color: var(--pact-text-primary);
      }

      .filter-tab.active {
        color: var(--pact-brand-primary);
      }

      .filter-tab.active::after {
        content: '';
        position: absolute;
        bottom: -9px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--pact-brand-primary);
      }

      .transaction-card.expanded {
        background: var(--pact-bg-primary);
        box-shadow: var(--pact-shadow-md);
      }

      .transaction-expanded-details {
        margin-top: var(--pact-spacing-lg);
        padding-top: var(--pact-spacing-md);
        border-top: 1px solid var(--pact-border-color);
        display: none;
        background: var(--pact-bg-primary);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        margin-left: calc(-1 * var(--pact-spacing-md));
        margin-right: calc(-1 * var(--pact-spacing-md));
        margin-bottom: calc(-1 * var(--pact-spacing-md));
      }

      .transaction-card.expanded .transaction-expanded-details {
        display: block;
        animation: expandDetails 0.2s ease-out;
      }

      @keyframes expandDetails {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .transaction-detail-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--pact-spacing-md);
        font-size: var(--pact-font-size-sm);
        padding: var(--pact-spacing-xs) 0;
      }

      .transaction-detail-row:last-child {
        margin-bottom: 0;
      }

      .transaction-detail-row:not(:last-child) {
        border-bottom: 1px solid var(--pact-border-color);
        padding-bottom: var(--pact-spacing-sm);
      }

      .transaction-detail-label {
        font-weight: 600;
        color: var(--pact-text-secondary);
        min-width: 100px;
        flex-shrink: 0;
        font-size: var(--pact-font-size-sm);
      }

      .transaction-detail-value {
        color: var(--pact-text-primary);
        word-break: break-all;
        text-align: right;
        font-family: monospace;
        font-size: var(--pact-font-size-xs);
        flex: 1;
        margin-left: var(--pact-spacing-md);
      }

      .transaction-detail-value.normal-font {
        font-family: inherit;
        font-size: var(--pact-font-size-sm);
      }

      .transaction-detail-json {
        background: var(--pact-bg-secondary);
        border: 1px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        margin-top: var(--pact-spacing-sm);
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: var(--pact-font-size-xs);
        color: var(--pact-text-primary);
        max-height: 300px;
        overflow-y: auto;
        white-space: pre-wrap;
        line-height: 1.4;
        border-left: 3px solid var(--pact-brand-primary);
      }

      .transaction-detail-json::-webkit-scrollbar {
        width: 6px;
      }

      .transaction-detail-json::-webkit-scrollbar-track {
        background: var(--pact-bg-primary);
        border-radius: 3px;
      }

      .transaction-detail-json::-webkit-scrollbar-thumb {
        background: var(--pact-border-color);
        border-radius: 3px;
      }

      .transaction-detail-json::-webkit-scrollbar-thumb:hover {
        background: var(--pact-text-secondary);
      }

      .transaction-expand-icon {
        margin-left: auto;
        font-size: 14px;
        color: var(--pact-text-secondary);
        transition: transform var(--pact-transition-fast);
        align-self: flex-start;
        margin-top: 1px;
        padding: 2px;
        border-radius: 4px;
        background: transparent;
        border: none;
        cursor: pointer;
      }

      .transaction-expand-icon:hover {
        background: var(--pact-bg-secondary);
        color: var(--pact-text-primary);
      }

      .transaction-card.expanded .transaction-expand-icon {
        transform: rotate(180deg);
      }

      .copy-button {
        background: none;
        border: 1px solid var(--pact-border-color);
        border-radius: 4px;
        padding: 4px 8px;
        margin-left: var(--pact-spacing-sm);
        font-size: var(--pact-font-size-xs);
        color: var(--pact-text-secondary);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
      }

      .copy-button:hover {
        background: var(--pact-bg-secondary);
        color: var(--pact-text-primary);
        border-color: var(--pact-brand-primary);
      }

      .hash-container {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex: 1;
      }
    `,
  ];

  private getTransactionIcon(tx: Transaction): string {
    if (tx.capability?.includes('transfer')) {
      return tx.from === this.selectedAccount?.address ? '↑' : '↓';
    }
    return '📄';
  }

  private getTransactionType(tx: Transaction): string {
    if (tx.capability?.includes('transfer')) {
      return tx.from === this.selectedAccount?.address ? 'Send' : 'Receive';
    }
    return 'Contract Call';
  }

  private getTransactionClass(tx: Transaction): string {
    if (tx.capability?.includes('transfer')) {
      return tx.from === this.selectedAccount?.address ? 'send' : 'receive';
    }
    return 'contract';
  }

  private formatAmount(tx: Transaction): string {
    if (!tx.amount) return '';
    const sign = tx.from === this.selectedAccount?.address ? '-' : '+';
    return `${sign}${tx.amount} KDA`;
  }

  private getAmountClass(tx: Transaction): string {
    if (!tx.amount) return '';
    return tx.from === this.selectedAccount?.address ? 'negative' : 'positive';
  }

  private formatAddress(address?: string): string {
    if (!address) return 'Contract';
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than a week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    
    // Default to date
    return date.toLocaleDateString();
  }

  private handleTransactionClick(tx: Transaction) {
    // Toggle expansion for the clicked transaction
    if (this.expandedTransactionId === tx.id) {
      this.expandedTransactionId = undefined;
    } else {
      this.expandedTransactionId = tx.id;
    }
  }

  private formatHash(hash?: string): string {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
  }

  private formatFullAddress(address?: string): string {
    if (!address) return 'N/A';
    return address;
  }

  private formatJsonData(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  private async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast notification here
      console.log(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  override render() {
    // Filter transactions for selected account
    const accountTransactions = this.selectedAccount
      ? this.transactions.filter(tx => 
          tx.from === this.selectedAccount!.address || 
          tx.to === this.selectedAccount!.address
        )
      : this.transactions;

    return html`
      <div class="screen-header">
        <h2 class="screen-title">Activity</h2>
      </div>

      ${accountTransactions.length === 0
        ? html`
            <div class="empty-state">
              <div class="empty-icon">📜</div>
              <h3>No transactions yet</h3>
              <p>Your transaction history will appear here</p>
            </div>
          `
        : html`
            <div class="transactions-list">
              ${accountTransactions.map(tx => {
                const isExpanded = this.expandedTransactionId === tx.id;
                return html`
                  <div class="transaction-card ${isExpanded ? 'expanded' : ''}" @click=${() => this.handleTransactionClick(tx)}>
                    <div class="transaction-icon ${this.getTransactionClass(tx)}">
                      ${this.getTransactionIcon(tx)}
                    </div>
                    <div class="transaction-info">
                      <div class="transaction-header">
                        <span class="transaction-type">${this.getTransactionType(tx)}</span>
                        ${tx.amount ? html`
                          <span class="transaction-amount ${this.getAmountClass(tx)}">
                            ${this.formatAmount(tx)}
                          </span>
                        ` : ''}
                        <button class="transaction-expand-icon" type="button" aria-label="Toggle transaction details">
                          ${isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                      <div class="transaction-details">
                        <span class="transaction-address">
                          ${this.getTransactionType(tx) === 'Send' 
                            ? `To: ${this.formatAddress(tx.to)}`
                            : this.getTransactionType(tx) === 'Receive'
                            ? `From: ${this.formatAddress(tx.from)}`
                            : tx.capability || 'Contract interaction'
                          }
                        </span>
                        <span class="transaction-status ${tx.status}">
                          ${tx.status}
                        </span>
                        <span class="transaction-time">
                          ${this.formatTime(tx.timestamp)}
                        </span>
                      </div>
                      
                      <!-- Expanded Details -->
                      <div class="transaction-expanded-details">
                        <div class="transaction-detail-row">
                          <span class="transaction-detail-label">Hash:</span>
                          <div class="hash-container">
                            <span class="transaction-detail-value">${this.formatHash(tx.hash)}</span>
                            ${tx.hash ? html`
                              <button 
                                class="copy-button" 
                                type="button"
                                @click=${(e: Event) => {
                                  e.stopPropagation();
                                  this.copyToClipboard(tx.hash!, 'Transaction hash');
                                }}
                                aria-label="Copy full hash"
                              >
                                📋
                              </button>
                            ` : ''}
                          </div>
                        </div>
                        
                        <div class="transaction-detail-row">
                          <span class="transaction-detail-label">Chain ID:</span>
                          <span class="transaction-detail-value normal-font">${tx.chainId || 'N/A'}</span>
                        </div>
                        
                        <div class="transaction-detail-row">
                          <span class="transaction-detail-label">From:</span>
                          <div class="hash-container">
                            <span class="transaction-detail-value">${this.formatFullAddress(tx.from)}</span>
                            <button 
                              class="copy-button" 
                              type="button"
                              @click=${(e: Event) => {
                                e.stopPropagation();
                                this.copyToClipboard(tx.from, 'From address');
                              }}
                              aria-label="Copy from address"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                        
                        ${tx.to ? html`
                          <div class="transaction-detail-row">
                            <span class="transaction-detail-label">To:</span>
                            <div class="hash-container">
                              <span class="transaction-detail-value">${this.formatFullAddress(tx.to)}</span>
                              <button 
                                class="copy-button" 
                                type="button"
                                @click=${(e: Event) => {
                                  e.stopPropagation();
                                  this.copyToClipboard(tx.to!, 'To address');
                                }}
                                aria-label="Copy to address"
                              >
                                📋
                              </button>
                            </div>
                          </div>
                        ` : ''}
                        
                        ${tx.gas ? html`
                          <div class="transaction-detail-row">
                            <span class="transaction-detail-label">Gas Limit:</span>
                            <span class="transaction-detail-value normal-font">${tx.gas.toLocaleString()}</span>
                          </div>
                        ` : ''}
                        
                        ${tx.capability ? html`
                          <div class="transaction-detail-row">
                            <span class="transaction-detail-label">Capability:</span>
                            <span class="transaction-detail-value normal-font">${tx.capability}</span>
                          </div>
                        ` : ''}
                        
                        <div class="transaction-detail-row">
                          <span class="transaction-detail-label">Created:</span>
                          <span class="transaction-detail-value normal-font">${new Date(tx.timestamp).toLocaleString()}</span>
                        </div>
                        
                        ${tx.result ? html`
                          <div class="transaction-detail-row">
                            <span class="transaction-detail-label">Result:</span>
                            <span class="transaction-detail-value normal-font">View below</span>
                          </div>
                          <div class="transaction-detail-json">${this.formatJsonData(tx.result)}</div>
                        ` : ''}
                        
                        ${tx.data ? html`
                          <div class="transaction-detail-row">
                            <span class="transaction-detail-label">Payload:</span>
                            <span class="transaction-detail-value normal-font">View below</span>
                          </div>
                          <div class="transaction-detail-json">${this.formatJsonData(tx.data)}</div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              })}
            </div>
          `}
    `;
  }
}