import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../styles/theme-mapping";
import type { Network } from "../types";

@customElement("pact-toolbox-networks-screen")
export class PactToolboxNetworksScreen extends LitElement {
  @property({ type: Array }) networks: Network[] = [];
  @property({ type: Object }) activeNetwork?: Network;

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

      .networks-list {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-md);
      }

      .network-card {
        background: var(--pact-bg-secondary);
        border: 2px solid var(--pact-border-color);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-lg);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
        position: relative;
      }

      .network-card:hover {
        border-color: var(--pact-brand-primary);
        transform: translateY(-2px);
        box-shadow: var(--pact-shadow-base);
      }

      .network-card.active {
        border-color: var(--pact-success);
        background: var(--pact-bg-primary);
      }

      .network-card.active::before {
        content: '';
        position: absolute;
        top: var(--pact-spacing-md);
        right: var(--pact-spacing-md);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--pact-success);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
      }

      .network-header {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-md);
        margin-bottom: var(--pact-spacing-md);
      }

      .network-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
      }

      .network-info {
        flex: 1;
      }

      .network-name {
        font-weight: 600;
        font-size: var(--pact-font-size-lg);
        color: var(--pact-text-primary);
        margin-bottom: 4px;
      }

      .network-type {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .network-details {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-sm);
        padding-top: var(--pact-spacing-md);
        border-top: 1px solid var(--pact-border-color);
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .detail-label {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-secondary);
      }

      .detail-value {
        font-family: monospace;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-text-primary);
      }

      .add-network-card {
        background: transparent;
        border: 2px dashed var(--pact-border-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--pact-spacing-sm);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
      }

      .add-network-card:hover {
        border-color: var(--pact-brand-primary);
        background: var(--pact-bg-secondary);
      }

      .add-icon {
        font-size: 32px;
        color: var(--pact-text-secondary);
      }

      .add-text {
        color: var(--pact-text-secondary);
        font-weight: 500;
      }

      .info-box {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid var(--pact-info);
        border-radius: var(--pact-border-radius);
        padding: var(--pact-spacing-md);
        margin-top: var(--pact-spacing-xl);
        font-size: var(--pact-font-size-sm);
        color: var(--pact-info);
      }
    `,
  ];

  private selectNetwork(network: Network) {
    this.dispatchEvent(new CustomEvent('toolbox-network-changed', {
      detail: { network },
      bubbles: true,
      composed: true,
    }));
  }

  private getNetworkIcon(network: Network): string {
    const icons: Record<string, string> = {
      'mainnet': '🌐',
      'testnet': '🧪',
      'development': '🛠️',
      'local': '💻',
    };
    return icons[network.id] || '📡';
  }

  private getNetworkType(network: Network): string {
    if (!network.id) return 'Unknown Network';
    if (network.id.includes('mainnet')) return 'Mainnet';
    if (network.id.includes('testnet')) return 'Testnet';
    if (network.id.includes('development') || network.id.includes('local')) return 'Local Network';
    return 'Custom Network';
  }

  override render() {
    return html`
      <div class="screen-header">
        <h2 class="screen-title">Networks</h2>
      </div>

      <div class="networks-list">
        ${this.networks.map(network => html`
          <div
            class="network-card ${network.id === this.activeNetwork?.id ? 'active' : ''}"
            @click=${() => this.selectNetwork(network)}
          >
            <div class="network-header">
              <div class="network-icon">
                ${this.getNetworkIcon(network)}
              </div>
              <div class="network-info">
                <div class="network-name">${network.name}</div>
                <div class="network-type">${this.getNetworkType(network)}</div>
              </div>
            </div>
            
            <div class="network-details">
              <div class="detail-row">
                <span class="detail-label">Chain ID</span>
                <span class="detail-value">${network.chainId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">RPC URL</span>
                <span class="detail-value">${network.rpcUrl}</span>
              </div>
              ${network.explorerUrl ? html`
                <div class="detail-row">
                  <span class="detail-label">Explorer</span>
                  <span class="detail-value">${network.explorerUrl}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `)}

        <div class="network-card add-network-card">
          <span class="add-icon">+</span>
          <span class="add-text">Add Custom Network</span>
        </div>
      </div>

      <div class="info-box">
        <strong>Network Configuration</strong><br>
        Networks are managed by your development environment. The active network determines where transactions are sent.
      </div>
    `;
  }
}