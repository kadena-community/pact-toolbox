import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared/styles";
import { themeMapping } from "../styles/theme-mapping";
import { getDefaultModalManager } from "../modal-manager";
import type { ModalManager } from "../modal-manager";

@customElement("toolbox-wallet-floating-button")
export class ToolboxWalletFloatingButton extends LitElement {
  @state() private walletConnected = false;
  @state() private accountAddress = "";
  @state() private transactionCount = 0;

  private modalManager: ModalManager;

  constructor() {
    super();
    this.modalManager = getDefaultModalManager();
  }

  static override styles = [
    baseStyles,
    themeMapping,
    css`
      :host {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: var(--pact-z-index-modal);
      }

      .wallet-button {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--pact-brand-primary);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all var(--pact-transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .wallet-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      }

      .wallet-button:active {
        transform: scale(0.95);
      }

      .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        background: var(--pact-error);
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        padding: 0 6px;
        border: 2px solid var(--pact-bg-primary);
      }

      .wallet-tooltip {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: var(--pact-font-size-sm);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--pact-transition-fast);
      }

      .wallet-button:hover + .wallet-tooltip {
        opacity: 1;
      }

      .wallet-tooltip::after {
        content: "";
        position: absolute;
        top: 100%;
        right: 20px;
        border: 6px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.9);
      }

      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(0, 102, 204, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(0, 102, 204, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(0, 102, 204, 0);
        }
      }

      .wallet-button.has-pending {
        animation: pulse 2s infinite;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.checkConnectionStatus();
    this.setupEventListeners();
    this.setupWalletServiceListeners();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListeners();
    this.removeWalletServiceListeners();
  }

  private setupEventListeners() {
    document.addEventListener("toolbox-wallet-connected", this.handleWalletConnected as EventListener);
    document.addEventListener("toolbox-wallet-disconnected", this.handleWalletDisconnected as EventListener);
    document.addEventListener("toolbox-transaction-added", this.handleTransactionAdded as EventListener);
    document.addEventListener("connect-approved", this.handleConnectApproved as EventListener);

    // Listen for modal show/hide to trigger re-render
    document.addEventListener("toolbox-wallet-shown", () => this.requestUpdate());
    document.addEventListener("toolbox-wallet-hidden", () => this.requestUpdate());
  }

  private removeEventListeners() {
    document.removeEventListener("toolbox-wallet-connected", this.handleWalletConnected as EventListener);
    document.removeEventListener("toolbox-wallet-disconnected", this.handleWalletDisconnected as EventListener);
    document.removeEventListener("toolbox-transaction-added", this.handleTransactionAdded as EventListener);
    document.removeEventListener("connect-approved", this.handleConnectApproved as EventListener);
    // Note: Cannot remove anonymous functions - they will be garbage collected with the component
  }

  private async setupWalletServiceListeners() {
    // Listen for dev-wallet specific events instead of using walletService
    // This avoids circular dependencies
    document.addEventListener("dev-wallet-connected", this.handleDevWalletConnected as EventListener);
    document.addEventListener("dev-wallet-disconnected", this.handleDevWalletDisconnected as EventListener);
  }

  private handleDevWalletConnected = (event: CustomEvent) => {
    if (event.detail?.walletId === "keypair" || event.detail?.walletId === "dev-wallet") {
      this.walletConnected = true;
      this.checkConnectionStatus();
    }
  };

  private handleDevWalletDisconnected = (event: CustomEvent) => {
    if (event.detail?.walletId === "keypair" || event.detail?.walletId === "dev-wallet") {
      this.walletConnected = false;
      this.accountAddress = "";
      this.transactionCount = 0;
    }
  };

  private async removeWalletServiceListeners() {
    document.removeEventListener("dev-wallet-connected", this.handleDevWalletConnected as EventListener);
    document.removeEventListener("dev-wallet-disconnected", this.handleDevWalletDisconnected as EventListener);
  }

  private handleWalletConnected = (event: CustomEvent) => {
    this.walletConnected = true;
    this.accountAddress = event.detail.address || "";
  };

  private handleWalletDisconnected = () => {
    this.walletConnected = false;
    this.accountAddress = "";
    this.transactionCount = 0;
  };

  private handleTransactionAdded = () => {
    this.transactionCount++;
  };

  private handleConnectApproved = (event: CustomEvent) => {
    if (event.detail.account) {
      this.walletConnected = true;
      this.accountAddress = event.detail.account.address || "";
    }
  };

  private async checkConnectionStatus() {
    // Check connection status via local storage or events
    try {
      // Check if we have a selected key in storage
      const selectedKey = localStorage.getItem("pact-toolbox-wallet-selected-key");

      if (selectedKey) {
        // We have a selected key, so we're connected
        this.walletConnected = true;

        // Try to get the full account info from localStorage
        const accounts = localStorage.getItem("pact-toolbox-wallet-keys");
        if (accounts) {
          try {
            const accountList = JSON.parse(accounts);
            const account = accountList.find((acc: { address: string }) => acc.address === selectedKey);
            if (account) {
              this.accountAddress = account.address;
            }
          } catch (e) {
            console.error("Failed to parse accounts:", e);
          }
        }
      } else {
        this.walletConnected = false;
        this.accountAddress = "";
      }
    } catch (e) {
      console.error("Failed to check connection status:", e);
    }
  }

  private handleClick() {
    // Show the dev wallet modal
    this.modalManager.showDevWallet();
  }

  private formatAddress(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  override render() {
    if (!this.walletConnected) {
      return null; // Don't show button if not connected
    }

    // Hide floating button when wallet UI is open
    if (this.modalManager.isVisible()) {
      return null;
    }

    return html`
      <button class="wallet-button ${this.transactionCount > 0 ? "has-pending" : ""}" @click=${this.handleClick}>
        🧰 ${this.transactionCount > 0 ? html` <span class="notification-badge">${this.transactionCount}</span> ` : ""}
      </button>
      <div class="wallet-tooltip">
        Toolbox Wallet${this.accountAddress ? ` - ${this.formatAddress(this.accountAddress)}` : ""}
      </div>
    `;
  }
}
