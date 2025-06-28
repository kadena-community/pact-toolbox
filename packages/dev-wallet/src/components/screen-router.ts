import { html } from "lit";
import type { TemplateResult } from "lit";
import type { WalletState } from "../types/enhanced-types";

/**
 * Screen router for wallet navigation
 */
export class ScreenRouter {
  /**
   * Render the current screen based on wallet state
   */
  renderScreen(state: WalletState): TemplateResult {
    const screenClass = "screen-container screen-enter";

    switch (state.currentScreen) {
      case "accounts":
        return html`
          <pact-toolbox-accounts-screen
            class="${screenClass}"
            .accounts=${state.accounts}
            .selectedAccount=${state.selectedAccount}
          ></pact-toolbox-accounts-screen>
        `;

      case "transactions":
        return html`
          <pact-toolbox-transactions-screen
            class="${screenClass}"
            .transactions=${state.transactions}
            .selectedAccount=${state.selectedAccount}
          ></pact-toolbox-transactions-screen>
        `;

      case "networks":
        return html`
          <pact-toolbox-networks-screen
            class="${screenClass}"
            .networks=${state.networks}
            .activeNetwork=${state.activeNetwork}
            .showTestNetworks=${state.settings?.showTestNetworks ?? true}
          ></pact-toolbox-networks-screen>
        `;

      case "settings":
        return html`
          <pact-toolbox-settings-screen 
            class="${screenClass}"
            .settings=${state.settings}
          ></pact-toolbox-settings-screen>
        `;

      case "connect":
        return html`
          <pact-toolbox-connect-screen
            class="${screenClass}"
            .accounts=${state.accounts}
            .selectedAccount=${state.selectedAccount}
            .isConnecting=${state.isConnecting}
          ></pact-toolbox-connect-screen>
        `;

      case "sign":
        return html`
          <pact-toolbox-sign-screen
            class="${screenClass}"
            .transaction=${state.pendingTransaction}
            .selectedAccount=${state.selectedAccount}
            .network=${state.activeNetwork}
          ></pact-toolbox-sign-screen>
        `;

      default:
        return this.renderUnknownScreen(state.currentScreen);
    }
  }

  /**
   * Render unknown screen with error message
   */
  private renderUnknownScreen(screen: string): TemplateResult {
    return html`
      <div class="screen-container error-screen">
        <div class="error-content">
          <h2>Unknown Screen</h2>
          <p>The requested screen "${screen}" is not recognized.</p>
          <p>Please navigate to a valid screen using the bottom navigation.</p>
        </div>
      </div>
    `;
  }

  /**
   * Check if a screen is valid
   */
  isValidScreen(screen: string): boolean {
    const validScreens = ["accounts", "transactions", "networks", "settings", "connect", "sign"];
    return validScreens.includes(screen);
  }

  /**
   * Get default screen based on wallet state
   */
  getDefaultScreen(state: WalletState): WalletState['currentScreen'] {
    // If locked, go to accounts screen
    if (state.isLocked) {
      return "accounts";
    }

    // If no accounts, go to accounts screen
    if (state.accounts.length === 0) {
      return "accounts";
    }

    // If there's a pending transaction, go to sign screen
    if (state.pendingTransaction) {
      return "sign";
    }

    // If connecting, go to connect screen
    if (state.isConnecting) {
      return "connect";
    }

    // Default to transactions
    return "transactions";
  }

  /**
   * Get available screens based on wallet state
   */
  getAvailableScreens(state: WalletState): WalletState['currentScreen'][] {
    const baseScreens: WalletState['currentScreen'][] = ["accounts", "transactions", "networks", "settings"];
    
    // Add conditional screens
    if (state.isConnecting || !state.selectedAccount) {
      baseScreens.push("connect");
    }
    
    if (state.pendingTransaction && state.selectedAccount) {
      baseScreens.push("sign");
    }

    return baseScreens;
  }

  /**
   * Check if navigation to a screen is allowed
   */
  canNavigateToScreen(targetScreen: WalletState['currentScreen'], state: WalletState): boolean {
    // Always allow navigation to basic screens
    const alwaysAllowed = ["accounts", "transactions", "networks", "settings"];
    if (alwaysAllowed.includes(targetScreen)) {
      return true;
    }

    // Special rules for conditional screens
    switch (targetScreen) {
      case "connect":
        // Can navigate to connect if not connected or if connecting
        return !state.selectedAccount || state.isConnecting || false;
      
      case "sign":
        // Can navigate to sign if there's a pending transaction and account is selected
        return Boolean(state.pendingTransaction && state.selectedAccount);
      
      default:
        return false;
    }
  }

  /**
   * Get screen title for display
   */
  getScreenTitle(screen: WalletState['currentScreen']): string {
    const titles: Record<WalletState['currentScreen'], string> = {
      accounts: "Accounts",
      transactions: "Transactions", 
      networks: "Networks",
      settings: "Settings",
      connect: "Connect Wallet",
      sign: "Sign Transaction",
    };

    return titles[screen] || "Unknown";
  }

  /**
   * Get screen icon for display
   */
  getScreenIcon(screen: WalletState['currentScreen']): string {
    const icons: Record<WalletState['currentScreen'], string> = {
      accounts: "👤",
      transactions: "📋",
      networks: "🌐",
      settings: "⚙️",
      connect: "🔗",
      sign: "✍️",
    };

    return icons[screen] || "❓";
  }
}