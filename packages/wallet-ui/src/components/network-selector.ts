import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import type { WalletNetwork } from "@pact-toolbox/wallet-core";
import { KadenaNetworks } from "@pact-toolbox/wallet-core";
import "@pact-toolbox/ui-shared";

@customElement("pact-network-selector")
export class PactNetworkSelector extends LitElement {
  @property({ type: Object }) currentNetwork: WalletNetwork | null = null;
  @property({ type: Array }) supportedNetworks: string[] = [];
  @property({ type: Boolean }) canSwitch: boolean = false;
  @property({ type: Boolean }) loading: boolean = false;
  @property({ type: String }) error: string = "";

  @state() private isOpen: boolean = false;

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
        position: relative;
      }

      .network-button {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-xs);
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        background: var(--pact-color-bg-secondary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-base);
        cursor: pointer;
        transition: all var(--pact-transition-fast);
        font-family: inherit;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-color-text-primary);
      }

      .network-button:hover:not(:disabled) {
        border-color: var(--pact-color-primary);
        background: var(--pact-color-bg-tertiary);
      }

      .network-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .network-icon {
        width: 16px;
        height: 16px;
        border-radius: var(--pact-border-radius-full);
        background: var(--pact-color-primary);
      }

      .network-name {
        font-weight: var(--pact-font-weight-medium);
      }

      .chevron {
        margin-left: var(--pact-spacing-xs);
        transition: transform var(--pact-transition-fast);
      }

      .chevron.open {
        transform: rotate(180deg);
      }

      .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: var(--pact-spacing-xs);
        background: var(--pact-color-bg-primary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-base);
        box-shadow: var(--pact-shadow-lg);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all var(--pact-transition-fast);
        z-index: 10;
        min-width: 200px;
      }

      .dropdown.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .network-option {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        cursor: pointer;
        transition: background var(--pact-transition-fast);
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        font-family: inherit;
        font-size: var(--pact-font-size-sm);
        color: var(--pact-color-text-primary);
      }

      .network-option:hover {
        background: var(--pact-color-bg-secondary);
      }

      .network-option.active {
        background: var(--pact-color-primary-light);
        color: var(--pact-color-primary);
      }

      .network-badge {
        width: 8px;
        height: 8px;
        border-radius: var(--pact-border-radius-full);
        background: var(--pact-color-success);
      }

      .network-label {
        flex: 1;
      }

      .error-message {
        margin-top: var(--pact-spacing-xs);
        padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        background: var(--pact-color-error-light);
        border: var(--pact-border-width) solid var(--pact-color-error);
        border-radius: var(--pact-border-radius-sm);
        color: var(--pact-color-error);
        font-size: var(--pact-font-size-xs);
      }
    `,
  ];

  private handleToggle() {
    if (this.canSwitch && !this.loading) {
      this.isOpen = !this.isOpen;
    }
  }

  private handleNetworkSelect(networkId: string) {
    if (networkId !== this.currentNetwork?.networkId) {
      this.dispatchEvent(
        new CustomEvent("network-switch", {
          detail: { networkId },
          bubbles: true,
          composed: true,
        })
      );
    }
    this.isOpen = false;
  }

  private handleClickOutside = (event: MouseEvent) => {
    if (!this.contains(event.target as Node)) {
      this.isOpen = false;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this.handleClickOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleClickOutside);
  }

  override render() {
    const availableNetworks = this.supportedNetworks
      .map(id => KadenaNetworks[id])
      .filter(Boolean);

    return html`
      <div>
        <button
          class="network-button"
          @click=${this.handleToggle}
          ?disabled=${!this.canSwitch || this.loading}
        >
          <div class="network-icon"></div>
          <span class="network-name">
            ${this.currentNetwork?.name || "Select Network"}
          </span>
          ${this.canSwitch
            ? html`<span class="chevron ${this.isOpen ? "open" : ""}">▼</span>`
            : ""}
        </button>

        <div class="dropdown ${this.isOpen ? "open" : ""}">
          ${availableNetworks.map(network => html`
            <button
              class="network-option ${network?.networkId === this.currentNetwork?.networkId ? "active" : ""}"
              @click=${() => this.handleNetworkSelect(network?.networkId || '')}
            >
              <div class="network-badge"></div>
              <span class="network-label">${network?.name || 'Unknown'}</span>
            </button>
          `)}
        </div>

        ${this.error
          ? html`<div class="error-message">${this.error}</div>`
          : ""}
      </div>
    `;
  }
}