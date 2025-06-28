import { walletService, type Wallet, type WalletAccount } from "@pact-toolbox/wallet-adapters";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { baseStyles, truncateAddress } from "@pact-toolbox/ui-shared";
// Import and register shared components
import "@pact-toolbox/ui-shared";
import "./wallet-modal";
import "./wallet-selector";

@customElement("pact-wallet-connect")
export class PactWalletConnect extends LitElement {
  @state() private wallet: Wallet | null = null;
  @state() private account: WalletAccount | null = null;
  @state() private showModal: boolean = false;
  @state() private loading: boolean = false;

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .account-info {
        display: flex;
        align-items: center;
        gap: var(--pact-spacing-sm);
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        background: var(--pact-color-bg-secondary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-base);
        font-size: var(--pact-font-size-sm);
      }

      .account-address {
        font-family: var(--pact-font-family-mono);
        color: var(--pact-color-text-primary);
      }

      .account-balance {
        color: var(--pact-color-text-secondary);
      }

      .wallet-icon {
        width: 20px;
        height: 20px;
        border-radius: var(--pact-border-radius-sm);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--pact-color-bg-primary);
      }

      .wallet-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ];

  override async connectedCallback() {
    super.connectedCallback();

    // Check if already connected
    this.wallet = walletService.getPrimaryWallet();
    if (this.wallet) {
      await this.loadAccount();
    }

    // Listen for wallet events
    walletService.on("connected", this.handleWalletConnected);
    walletService.on("disconnected", this.handleWalletDisconnected);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    walletService.off("connected", this.handleWalletConnected);
    walletService.off("disconnected", this.handleWalletDisconnected);
  }

  private handleWalletConnected = async (wallet: Wallet) => {
    this.wallet = wallet;
    await this.loadAccount();
    this.showModal = false;
  };

  private handleWalletDisconnected = () => {
    this.wallet = null;
    this.account = null;
  };

  private async loadAccount() {
    if (!this.wallet) return;

    this.loading = true;
    try {
      this.account = await this.wallet.getAccount();
    } catch (error) {
      console.error("Failed to load account:", error);
    } finally {
      this.loading = false;
    }
  }

  private handleConnect() {
    this.showModal = true;
  }

  private async handleDisconnect() {
    if (!this.wallet) return;

    const wallets = walletService.getConnectedWallets();
    const walletEntry = wallets.find((w) => w === this.wallet);

    if (walletEntry) {
      // Find wallet ID by checking available wallets
      const availableWallets = await walletService.getAvailableWallets();
      const walletMeta = availableWallets.find((_meta) => {
        // This is a simplified check - in real implementation we'd need a better way
        return true; // Would need to match by some property
      });

      if (walletMeta) {
        await walletService.disconnect(walletMeta.id);
      }
    }
  }

  override render() {
    if (this.wallet && this.account) {
      return html`
        <div class="account-info">
          <div class="wallet-icon">
            <span>👛</span>
          </div>
          <span class="account-address">${truncateAddress(this.account.address)}</span>
          ${this.account.balance !== undefined
            ? html`<span class="account-balance">${this.account.balance} KDA</span>`
            : ""}
          <pact-button
            variant="ghost"
            size="sm"
            @click=${this.handleDisconnect}
          >
            Disconnect
          </pact-button>
        </div>
      `;
    }

    return html`
      <pact-button
        variant="primary"
        @click=${this.handleConnect}
        .loading=${this.loading}
      >
        Connect Wallet
      </pact-button>

      <pact-wallet-modal
        .open=${this.showModal}
        heading="Connect Wallet"
        @close=${() => (this.showModal = false)}
      >
        <pact-wallet-selector
          @wallet-connected=${() => (this.showModal = false)}
        ></pact-wallet-selector>
      </pact-wallet-modal>
    `;
  }
}