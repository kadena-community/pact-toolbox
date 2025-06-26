import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../styles/theme-mapping";
import type { Account, Transaction, Network, WalletScreen, WalletState } from "../../types";
import { DevWalletStorage } from "../../storage";
import "../screens/accounts-screen";
import "../screens/transactions-screen";
import "../screens/networks-screen";
import "../screens/settings-screen";
import "../screens/connect-screen";
import "../screens/sign-screen";
import "./wallet-header";
import "./bottom-navigation";

@customElement("toolbox-wallet-container")
export class ToolboxWalletContainer extends LitElement {
  @state() private walletState: WalletState = {
    currentScreen: "transactions",
    accounts: [],
    transactions: [],
    networks: [],
  };

  private storage = new DevWalletStorage();

  static override styles = [
    baseStyles,
    themeMapping,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--pact-bg-primary);
        color: var(--pact-text-primary);
        font-family: var(--pact-font-family);
        overflow: hidden;
      }

      .wallet-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
      }

      pact-toolbox-wallet-header {
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .wallet-content {
        position: absolute;
        top: 60px; /* Height of header */
        bottom: 72px; /* Height of bottom navigation + padding */
        left: 0;
        right: 0;
        overflow-y: auto;
        overflow-x: hidden;
      }

      pact-toolbox-bottom-navigation {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 10;
      }

      .screen-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* Animations */
      .screen-enter {
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.loadWalletData();
    this.setupEventListeners();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListeners();
  }

  private setupEventListeners() {
    document.addEventListener("toolbox-navigate", this.handleNavigation as EventListener);
    document.addEventListener("toolbox-account-selected", this.handleAccountSelected as EventListener);
    document.addEventListener("toolbox-network-changed", this.handleNetworkChanged as EventListener);
    document.addEventListener("toolbox-sign-requested", this.handleSignRequested as EventListener);
    document.addEventListener("toolbox-connect-requested", this.handleConnectRequested as EventListener);
    document.addEventListener("connect-approved", this.handleConnectApproved as EventListener);
    document.addEventListener("connect-cancelled", this.handleConnectCancelled as EventListener);
    document.addEventListener("toolbox-close-wallet", this.handleCloseWallet as EventListener);
    document.addEventListener("sign-approved", this.handleSignApproved as EventListener);
    document.addEventListener("sign-rejected", this.handleSignRejected as EventListener);
    document.addEventListener("toolbox-transaction-added", this.handleTransactionAdded as any);
    document.addEventListener("toolbox-transaction-updated", this.handleTransactionUpdated as any);
  }

  private removeEventListeners() {
    document.removeEventListener("toolbox-navigate", this.handleNavigation as EventListener);
    document.removeEventListener("toolbox-account-selected", this.handleAccountSelected as EventListener);
    document.removeEventListener("toolbox-network-changed", this.handleNetworkChanged as EventListener);
    document.removeEventListener("toolbox-sign-requested", this.handleSignRequested as EventListener);
    document.removeEventListener("toolbox-connect-requested", this.handleConnectRequested as EventListener);
    document.removeEventListener("connect-approved", this.handleConnectApproved as EventListener);
    document.removeEventListener("connect-cancelled", this.handleConnectCancelled as EventListener);
    document.removeEventListener("toolbox-close-wallet", this.handleCloseWallet as EventListener);
    document.removeEventListener("sign-approved", this.handleSignApproved as EventListener);
    document.removeEventListener("sign-rejected", this.handleSignRejected as EventListener);
    document.removeEventListener("toolbox-transaction-added", this.handleTransactionAdded as any);
    document.removeEventListener("toolbox-transaction-updated", this.handleTransactionUpdated as any);
  }

  private handleNavigation = (event: CustomEvent<{ screen: WalletScreen }>) => {
    this.walletState = {
      ...this.walletState,
      currentScreen: event.detail.screen,
    };
  };

  private handleAccountSelected = (event: CustomEvent<{ account: Account }>) => {
    this.walletState = {
      ...this.walletState,
      selectedAccount: event.detail.account,
    };
  };

  private handleNetworkChanged = (event: CustomEvent<{ network: Network }>) => {
    this.walletState = {
      ...this.walletState,
      activeNetwork: event.detail.network,
    };
  };

  private handleSignRequested = (event: CustomEvent<{ transaction: any }>) => {
    console.log("Sign requested event received:", event.detail);

    // Store the pending transaction
    this.walletState = {
      ...this.walletState,
      pendingTransaction: event.detail.transaction,
    };

    // If not connected, show connect screen first
    if (!this.walletState.selectedAccount || this.walletState.isConnecting) {
      console.log("Not connected, showing connect screen first");
      this.walletState = {
        ...this.walletState,
        currentScreen: "connect",
        isConnecting: true,
      };
    } else {
      // Already connected, go straight to sign screen
      console.log("Already connected, showing sign screen");
      this.walletState = {
        ...this.walletState,
        currentScreen: "sign",
      };
    }
  };

  private handleConnectRequested = () => {
    this.walletState = {
      ...this.walletState,
      currentScreen: "connect",
      isConnecting: true,
    };
  };

  private handleConnectApproved = (event: CustomEvent<{ account: Account }>) => {
    // The connect screen already dispatches the connect-approved event
    // Check if we have a pending sign request
    if (this.walletState.pendingTransaction) {
      // Continue to sign screen
      this.walletState = {
        ...this.walletState,
        currentScreen: "sign",
        isConnecting: false,
      };
    } else {
      // Just connected, show transactions screen
      this.walletState = {
        ...this.walletState,
        currentScreen: "transactions",
        isConnecting: false,
      };
    }
  };

  private handleConnectCancelled = () => {
    // The connect screen already dispatches the connect-cancelled event
    // Reset state
    this.walletState = {
      ...this.walletState,
      currentScreen: "transactions",
      isConnecting: false,
      pendingTransaction: undefined,
    };
  };

  private handleCloseWallet = () => {
    // Import and use modal manager to hide the wallet
    import("../modal-manager").then(({ ModalManager }) => {
      ModalManager.getInstance().hideDevWallet();
    });
  };

  private handleSignApproved = (event: CustomEvent) => {
    console.log("Sign approved - clearing pending transaction");
    // Clear pending transaction and return to transactions screen
    this.walletState = {
      ...this.walletState,
      pendingTransaction: undefined,
      currentScreen: "transactions",
    };
  };

  private handleSignRejected = () => {
    console.log("Sign rejected - clearing pending transaction");
    // Clear pending transaction and return to transactions screen
    this.walletState = {
      ...this.walletState,
      pendingTransaction: undefined,
      currentScreen: "transactions",
    };
  };

  private handleTransactionAdded = async (event: CustomEvent) => {
    console.log("Transaction added event received:", event.detail);
    // Reload transaction history to show the new transaction
    await this.loadTransactionHistory();
  };

  private handleTransactionUpdated = async (event: CustomEvent) => {
    console.log("Transaction updated event received:", event.detail);
    // Reload transaction history to show the updated status
    await this.loadTransactionHistory();
  };

  private async loadWalletData() {
    // Load from global context if available
    const globalContext = (window as any).__PACT_TOOLBOX_CONTEXT__ || (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
    console.log("Global context:", globalContext);
    let networks: Network[] = [];
    let accounts: Account[] = [];

    if (typeof globalContext?.getNetworkConfig === "function") {
      const networkConfig = globalContext.getNetworkConfig();

      // Load accounts from network config
      if (networkConfig.keyPairs && networkConfig.keyPairs.length > 0) {
        accounts = networkConfig.keyPairs.map((kp: any, index: number) => ({
          address: kp.account,
          publicKey: kp.publicKey,
          privateKey: kp.secretKey,
          name: kp.account || `Account ${index + 1}`,
          chainId: networkConfig.meta?.chainId || "0",
          balance: 0,
        }));
      }

      // Set up network from config
      const currentNetwork: Network = {
        id: networkConfig.networkId || "development",
        name: networkConfig.networkId || "Development",
        chainId: networkConfig.meta?.chainId || "0",
        rpcUrl: networkConfig.rpcUrl || "http://localhost:8080",
        isActive: true,
      };

      networks.push(currentNetwork);

      // Check if we have multiple networks in the global context
      const configuredNetworks =
        typeof globalContext.getAllNetworkConfigs === "function" ? globalContext.getAllNetworkConfigs() : [];
      if (configuredNetworks.length > 0) {
        // Add other available networks
        for (const net of configuredNetworks) {
          if (net.networkId && net.networkId !== currentNetwork.id) {
            networks.push({
              id: net.networkId,
              name: net.name || net.networkId,
              chainId: net.meta?.chainId || "0",
              rpcUrl: net.rpcUrl
                ? net.rpcUrl.replace("{networkId}", net.networkId).replace("{chainId}", net.meta?.chainId || "0")
                : "http://localhost:8080",
              isActive: false,
            });
          }
        }
      }
    } else {
      // Use defaults if no global context
      networks = [
        {
          id: "development",
          name: "Development",
          chainId: "0",
          rpcUrl: "http://localhost:8080",
          isActive: true,
        },
      ];
    }

    // Load saved accounts from storage first
    const storedKeys = await this.storage.getKeys();
    let allAccounts = [...accounts]; // Start with context accounts

    // If we have context accounts, use them as primary
    if (accounts.length > 0) {
      console.log("Using context accounts:", accounts);
      // Add any additional accounts from storage that aren't in context
      if (storedKeys.length > 0) {
        const contextAddresses = new Set(accounts.map((a) => a.address));
        const additionalAccounts = accounts
          .filter((key) => !contextAddresses.has(key.address))
          .map((key) => ({
            address: key.address,
            publicKey: key.publicKey,
            privateKey: key.privateKey,
            name: key.name || "Account",
            chainId: "0",
            balance: 0,
          }));
        allAccounts = [...accounts, ...additionalAccounts];
      }
    } else {
      // No context accounts, use storage accounts as fallback
      if (storedKeys.length > 0) {
        allAccounts = storedKeys.map((key) => ({
          address: key.address,
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          name: key.name || "Account",
          chainId: "0",
          balance: 0,
        }));
        console.log("Using storage accounts as fallback:", allAccounts);
      }
    }
    console.log("Loaded accounts:", allAccounts);
    this.walletState = {
      ...this.walletState,
      networks,
      activeNetwork: networks.find((n) => n.isActive) || networks[0],
      accounts: allAccounts,
      selectedAccount: allAccounts[0],
    };

    // Load transaction history
    await this.loadTransactionHistory();
  }

  private async loadTransactionHistory() {
    try {
      const devWalletTransactions = await this.storage.getTransactions();
      // Convert DevWalletTransaction to Transaction (they have the same structure)
      const transactions: Transaction[] = devWalletTransactions.map((tx) => ({
        id: tx.id,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        gas: tx.gas,
        status: tx.status,
        timestamp: tx.timestamp,
        chainId: tx.chainId,
        capability: tx.capability,
        data: tx.data,
      }));

      this.walletState = {
        ...this.walletState,
        transactions,
      };
    } catch (e) {
      console.error("Failed to load transaction history:", e);
    }
  }

  private async loadKeysFromStorage(): Promise<Account[]> {
    try {
      const keys = await this.storage.getKeys();
      return keys.map((key) => ({
        address: key.address,
        publicKey: key.publicKey,
        privateKey: key.privateKey,
        name: key.name || "Account",
        chainId: "0",
        balance: 0,
      }));
    } catch (e) {
      console.error("Failed to load keys from storage:", e);
      return [];
    }
  }

  private renderCurrentScreen() {
    const screenClass = "screen-container screen-enter";

    switch (this.walletState.currentScreen) {
      case "accounts":
        return html`
          <pact-toolbox-accounts-screen
            class="${screenClass}"
            .accounts=${this.walletState.accounts}
            .selectedAccount=${this.walletState.selectedAccount}
          ></pact-toolbox-accounts-screen>
        `;

      case "transactions":
        return html`
          <pact-toolbox-transactions-screen
            class="${screenClass}"
            .transactions=${this.walletState.transactions}
            .selectedAccount=${this.walletState.selectedAccount}
          ></pact-toolbox-transactions-screen>
        `;

      case "networks":
        return html`
          <pact-toolbox-networks-screen
            class="${screenClass}"
            .networks=${this.walletState.networks}
            .activeNetwork=${this.walletState.activeNetwork}
          ></pact-toolbox-networks-screen>
        `;

      case "settings":
        return html` <pact-toolbox-settings-screen class="${screenClass}"></pact-toolbox-settings-screen> `;

      case "connect":
        return html`
          <pact-toolbox-connect-screen
            class="${screenClass}"
            .accounts=${this.walletState.accounts}
            .selectedAccount=${this.walletState.selectedAccount}
          ></pact-toolbox-connect-screen>
        `;

      case "sign":
        return html`
          <pact-toolbox-sign-screen
            class="${screenClass}"
            .transaction=${this.walletState.pendingTransaction}
            .selectedAccount=${this.walletState.selectedAccount}
            .network=${this.walletState.activeNetwork}
          ></pact-toolbox-sign-screen>
        `;

      default:
        return html`<div>Unknown screen</div>`;
    }
  }

  override render() {
    return html`
      <div class="wallet-container">
        <pact-toolbox-wallet-header
          .selectedAccount=${this.walletState.selectedAccount}
          .activeNetwork=${this.walletState.activeNetwork}
        ></pact-toolbox-wallet-header>

        <div class="wallet-content">${this.renderCurrentScreen()}</div>

        <pact-toolbox-bottom-navigation
          .currentScreen=${this.walletState.currentScreen}
        ></pact-toolbox-bottom-navigation>
      </div>
    `;
  }
}
