import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getWalletSystem, type WalletMetadata } from "@pact-toolbox/wallet-adapters";
import { baseStyles } from "@pact-toolbox/ui-shared";
// Import and register shared components
import "@pact-toolbox/ui-shared";
import "./wallet-error";

@customElement("pact-wallet-selector")
export class PactWalletSelector extends LitElement {
  @property({ type: Boolean }) loading: boolean = false;
  @property({ type: String }) error: string = "";
  @state() private wallets: WalletMetadata[] = [];
  @state() private connectedWalletIds: string[] = [];

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .wallet-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: var(--pact-spacing-md);
        margin-top: var(--pact-spacing-lg);
      }

      .wallet-option {
        position: relative;
        padding: var(--pact-spacing-lg) var(--pact-spacing-md);
        background: var(--pact-color-bg-primary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-base);
        text-align: center;
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
        min-height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--pact-spacing-sm);
        cursor: pointer;
        color: var(--pact-color-text-primary);
        font-family: inherit;
      }

      .wallet-option:hover {
        border-color: var(--pact-color-primary);
        background: var(--pact-color-bg-secondary);
        box-shadow: var(--pact-shadow-md);
        transform: translateY(-2px);
      }

      .wallet-option.connected {
        border-color: var(--pact-color-success);
        background: var(--pact-color-success-light);
      }

      .connected-badge {
        position: absolute;
        top: var(--pact-spacing-xs);
        right: var(--pact-spacing-xs);
        background: var(--pact-color-success);
        color: white;
        border-radius: var(--pact-border-radius-full);
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--pact-font-size-xs);
        font-weight: var(--pact-font-weight-bold);
      }

      .wallet-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        border-radius: var(--pact-border-radius-base);
        background: var(--pact-color-bg-tertiary);
      }

      .wallet-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: var(--pact-border-radius-sm);
      }

      .wallet-name {
        font-size: var(--pact-font-size-sm);
        font-weight: var(--pact-font-weight-medium);
        color: var(--pact-color-text-primary);
      }

      .error-message {
        padding: var(--pact-spacing-md);
        background: var(--pact-color-error-light);
        border: var(--pact-border-width) solid var(--pact-color-error);
        border-radius: var(--pact-border-radius-base);
        color: var(--pact-color-error);
        text-align: center;
      }

      .loading-container {
        text-align: center;
        padding: var(--pact-spacing-xl) 0;
        color: var(--pact-color-text-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--pact-spacing-md);
      }

      .auto-connect {
        width: 100%;
        margin-bottom: var(--pact-spacing-lg);
      }

      .no-wallets {
        text-align: center;
        padding: var(--pact-spacing-xl) 0;
        color: var(--pact-color-text-secondary);
      }

      .no-wallets h3 {
        margin: 0 0 var(--pact-spacing-sm) 0;
        color: var(--pact-color-text-primary);
      }

      .no-wallets p {
        margin: 0;
      }
    `,
  ];

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadWallets();
    this.updateConnectionStatus();
  }

  private async loadWallets() {
    this.loading = true;
    try {
      const walletSystem = await getWalletSystem();
      this.wallets = await walletSystem.getAvailableWallets();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Failed to load wallets";
    } finally {
      this.loading = false;
    }
  }

  private async updateConnectionStatus() {
    const walletSystem = await getWalletSystem();
    const connectedWallets = walletSystem.getConnectedWallets();
    this.connectedWalletIds = connectedWallets.map((w: any) => w.id || '');
  }

  private selectWallet(walletId: string) {
    // Just dispatch the selection event and let the parent handle connection
    this.dispatchEvent(
      new CustomEvent("wallet-selected", {
        detail: { walletId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleAutoConnect() {
    // Just dispatch the auto-connect event and let the parent handle connection
    this.dispatchEvent(
      new CustomEvent("auto-connect", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getWalletIcon(metadata: WalletMetadata): string {
    const icons: Record<string, string> = {
      ecko: "🦎",
      chainweaver: "⛓️",
      zelcore: "🟦",
      walletconnect: "🔗",
      keypair: "🔑",
      magic: "✨",
    };
    return icons[metadata.id] || "👛";
  }

  override render() {
    if (this.loading) {
      return html`
        <div class="loading-container">
          <pact-spinner size="md"></pact-spinner>
          <p>Loading available wallets...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <pact-wallet-error
          .error=${this.error}
          .onRetry=${() => this.loadWallets()}
        ></pact-wallet-error>
      `;
    }

    const hasWallets = this.wallets.length > 0;

    return html`
      <div>
        ${hasWallets
          ? html`
              <pact-button
                class="auto-connect"
                variant="primary"
                @click=${this.handleAutoConnect}
              >
                Auto Connect
              </pact-button>

              <div class="wallet-grid">
                ${this.wallets.map((metadata) => {
                  const isConnected = this.connectedWalletIds.includes(metadata.id);
                  return html`
                    <button
                      class="wallet-option ${isConnected ? "connected" : ""}"
                      @click=${() => this.selectWallet(metadata.id)}
                    >
                      ${isConnected ? html`<span class="connected-badge">✓</span>` : ""}
                      <div class="wallet-icon">
                        ${metadata.icon
                          ? html`<img src="${metadata.icon}" alt="${metadata.name} icon" />`
                          : html`<span>${this.getWalletIcon(metadata)}</span>`}
                      </div>
                      <span class="wallet-name">${metadata.name}</span>
                    </button>
                  `;
                })}
              </div>
            `
          : html`
              <div class="no-wallets">
                <h3>No wallets detected</h3>
                <p>Install a wallet extension or use the development wallet.</p>
              </div>
            `}
      </div>
    `;
  }
}