import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping, buttonStyles } from "../styles/theme-mapping";
import type { Account, Network } from "../types";
import type { PartiallySignedTransaction, PactCommand } from "@pact-toolbox/types";

@customElement("pact-toolbox-sign-screen")
export class PactToolboxSignScreen extends LitElement {
  @property({ type: Object }) transaction?: PartiallySignedTransaction;
  @property({ type: Object }) selectedAccount?: Account;
  @property({ type: Object }) network?: Network;
  @state() private isSigningTransaction = false;
  @state() private showRawData = false;
  
  override connectedCallback() {
    super.connectedCallback();
    console.log('Sign screen connected, transaction:', this.transaction);
  }
  
  override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has('transaction')) {
      console.log('Transaction updated:', this.transaction);
    }
  }

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

      .sign-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .sign-header {
        text-align: center;
        margin-bottom: var(--pact-spacing-xl);
      }

      .sign-title {
        font-size: var(--pact-font-size-2xl);
        font-weight: 700;
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-sm);
      }

      .sign-subtitle {
        color: var(--pact-text-secondary);
        font-size: var(--pact-font-size-base);
      }

      .transaction-details {
        flex: 1;
        overflow-y: auto;
        margin-bottom: var(--pact-spacing-xl);
      }

      .detail-section {
        background: var(--pact-bg-secondary);
        border: 1px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-lg);
        margin-bottom: var(--pact-spacing-md);
      }

      .detail-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--pact-spacing-md);
      }

      .section-title {
        font-weight: 600;
        font-size: var(--pact-font-size-base);
        color: var(--pact-text-primary);
      }

      .section-badge {
        padding: 4px 12px;
        background: var(--pact-bg-primary);
        border: 1px solid var(--pact-border-color);
        border-radius: 20px;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: var(--pact-spacing-sm) 0;
        border-bottom: 1px solid var(--pact-border-color);
      }

      .detail-row:last-child {
        border-bottom: none;
      }

      .detail-label {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
        min-width: 100px;
      }

      .detail-value {
        flex: 1;
        text-align: right;
        font-family: monospace;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
        word-break: break-all;
      }

      .capabilities-list {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-sm);
      }

      .capability-item {
        background: var(--pact-bg-primary);
        border: 1px solid var(--pact-border-color);
        border-radius: 8px;
        padding: var(--pact-spacing-md);
      }

      .capability-name {
        font-weight: 500;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
        margin-bottom: var(--pact-spacing-xs);
      }

      .capability-args {
        font-family: monospace;
        font-size: var(--pact-font-size-xs);
        color: var(--pact-text-secondary);
      }

      .warning-box {
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid var(--pact-warning);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        margin-bottom: var(--pact-spacing-md);
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
      }

      .warning-icon {
        font-size: 24px;
        color: var(--pact-warning);
      }

      .warning-text {
        flex: 1;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-warning);
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

      .raw-data {
        background: var(--pact-bg-primary);
        border: 1px solid var(--pact-border-color);
        border-radius: 8px;
        padding: var(--pact-spacing-md);
        font-family: monospace;
        font-size: var(--pact-font-size-xs);
        color: var(--pact-text-secondary);
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
      }

      .toggle-raw {
        background: none;
        border: none;
        color: var(--pact-brand-primary);
        font-size: var(--pact-font-size-sm);
        cursor: pointer;
        text-decoration: underline;
      }

      .from-dapp {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
        padding: var(--pact-spacing-md);
        background: var(--pact-bg-secondary);
        border-radius: var(--pact-border-radius);
        margin-bottom: var(--pact-spacing-lg);
      }

      .dapp-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--pact-bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .dapp-info {
        flex: 1;
      }

      .dapp-name {
        font-weight: 500;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
      }

      .dapp-url {
        font-size: var(--pact-font-size-xs);
        color: var(--pact-text-secondary);
      }
    `,
  ];

  private getParsedCommand(): PactCommand | null {
    if (!this.transaction?.cmd) return null;
    try {
      return JSON.parse(this.transaction.cmd);
    } catch {
      return null;
    }
  }

  private formatCode(code: string): string {
    // Simple formatting - could be enhanced
    return code.trim();
  }

  private handleApprove() {
    this.dispatchEvent(new CustomEvent('sign-approved', {
      detail: { transaction: this.transaction },
      bubbles: true,
      composed: true,
    }));
  }

  private handleReject() {
    this.dispatchEvent(new CustomEvent('sign-rejected', {
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    if (!this.transaction) {
      return html`<div class="sign-container"><p>No transaction to sign</p></div>`;
    }
    
    const cmd = this.getParsedCommand();
    if (!cmd) {
      return html`<div class="sign-container"><p>Invalid transaction data</p></div>`;
    }

    const { payload, signers, meta, networkId } = cmd;
    const isTransfer = payload.exec?.code?.includes('coin.transfer');
    const capabilities = signers?.[0]?.clist || [];

    return html`
      <div class="sign-container">
        <div class="sign-header">
          <h2 class="sign-title">Sign Transaction</h2>
          <p class="sign-subtitle">Review and approve this transaction</p>
        </div>

        <div class="from-dapp">
          <div class="dapp-icon">🌐</div>
          <div class="dapp-info">
            <div class="dapp-name">DApp Request</div>
            <div class="dapp-url">${window.location.hostname}</div>
          </div>
        </div>

        <div class="transaction-details">
          ${isTransfer ? html`
            <div class="warning-box">
              <span class="warning-icon">⚠️</span>
              <span class="warning-text">
                This transaction will transfer funds. Please review carefully.
              </span>
            </div>
          ` : ''}

          <div class="detail-section">
            <div class="detail-section-header">
              <span class="section-title">Transaction Details</span>
              <span class="section-badge">${networkId || 'Unknown Network'}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">From</span>
              <span class="detail-value">${this.selectedAccount?.address || 'Unknown'}</span>
            </div>

            ${meta ? html`
              <div class="detail-row">
                <span class="detail-label">Chain ID</span>
                <span class="detail-value">${meta.chainId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Gas Limit</span>
                <span class="detail-value">${meta.gasLimit}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Gas Price</span>
                <span class="detail-value">${meta.gasPrice}</span>
              </div>
            ` : ''}
          </div>

          ${capabilities.length > 0 ? html`
            <div class="detail-section">
              <div class="detail-section-header">
                <span class="section-title">Capabilities Required</span>
              </div>
              <div class="capabilities-list">
                ${capabilities.map(cap => html`
                  <div class="capability-item">
                    <div class="capability-name">${cap.name}</div>
                    ${cap.args && cap.args.length > 0 ? html`
                      <div class="capability-args">Args: ${JSON.stringify(cap.args)}</div>
                    ` : ''}
                  </div>
                `)}
              </div>
            </div>
          ` : ''}

          <div class="detail-section">
            <div class="detail-section-header">
              <span class="section-title">Code to Execute</span>
              <button class="toggle-raw" @click=${() => this.showRawData = !this.showRawData}>
                ${this.showRawData ? 'Hide' : 'Show'} Raw Data
              </button>
            </div>
            
            ${this.showRawData ? html`
              <div class="raw-data">${JSON.stringify(cmd, null, 2)}</div>
            ` : html`
              <div class="raw-data">${this.formatCode(payload.exec?.code || ('cont' in payload ? (payload as any).cont?.pactId : '') || 'No code')}</div>
            `}
          </div>
        </div>

        <div class="action-buttons">
          <button class="btn-secondary" @click=${this.handleReject}>
            Reject
          </button>
          <button 
            class="btn-primary" 
            @click=${this.handleApprove}
            ?disabled=${this.isSigningTransaction}
          >
            ${this.isSigningTransaction ? html`<span class="spinner"></span>` : 'Sign'}
          </button>
        </div>
      </div>
    `;
  }
}