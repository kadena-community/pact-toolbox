import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../ui/styles/theme-mapping";
import type { WalletState } from "../types/enhanced-types";
import { WalletStateManager } from "../services/wallet-state-manager";
import { createDevWalletServices } from "../services";
import { WalletEventCoordinator } from "./wallet-event-coordinator";
import { ScreenRouter } from "./screen-router";
import { AutoLockManager } from "./auto-lock-manager";
import { createErrorHandler } from "../utils/error-handler";
import { uiLogger } from "../utils/logger";
import "../ui/components/wallet-header";
import "../ui/components/bottom-navigation";

/**
 * Refactored wallet container with improved state management
 */
@customElement("toolbox-wallet-container")
export class ToolboxWalletContainerRefactored extends LitElement {
  @state() private walletState: WalletState = {
    currentScreen: "transactions",
    accounts: [],
    transactions: [],
    networks: [],
    isLocked: false,
    lastActivity: Date.now(),
  };

  @property({ type: Object })
  networkContext?: any;

  private stateManager: WalletStateManager;
  private eventCoordinator: WalletEventCoordinator;
  private screenRouter: ScreenRouter;
  private autoLockManager: AutoLockManager;
  private unsubscribeFromState?: () => void;

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

      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        flex-direction: column;
        gap: var(--pact-spacing-md);
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--pact-border-color);
        border-top: 3px solid var(--pact-brand-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .error-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        flex-direction: column;
        gap: var(--pact-spacing-md);
        padding: var(--pact-spacing-xl);
        text-align: center;
      }

      .error-message {
        color: var(--pact-error);
        font-weight: 500;
      }

      .error-details {
        color: var(--pact-text-secondary);
        font-size: var(--pact-font-size-sm);
      }

      .retry-button {
        background: var(--pact-brand-primary);
        color: white;
        border: none;
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        border-radius: var(--pact-border-radius);
        cursor: pointer;
        font-weight: 500;
      }

      .retry-button:hover {
        background: var(--pact-brand-primary-dark);
      }
    `,
  ];

  private errorHandler = createErrorHandler();

  constructor() {
    super();
    
    // Initialize services using factory function
    const services = createDevWalletServices();
    
    // Use services from the factory
    this.stateManager = services.walletStateManager;
    
    this.eventCoordinator = new WalletEventCoordinator(
      this.stateManager,
      this.errorHandler,
      services.settingsService
    );
    this.screenRouter = new ScreenRouter();
    this.autoLockManager = new AutoLockManager(this.stateManager, this.errorHandler);
    
    // State is handled by the walletState property
  }

  override async connectedCallback() {
    super.connectedCallback();

    try {
      // Set network context if provided
      if (this.networkContext) {
        this.setNetworkContext(this.networkContext);
      }
      
      // Subscribe to state changes
      this.unsubscribeFromState = this.stateManager.subscribe((newState: WalletState) => {
        this.walletState = newState;
      });

      // Setup event coordination
      this.eventCoordinator.setup();

      // Initialize auto-lock if enabled
      this.autoLockManager.initialize();

      // Initialize wallet state
      await this.stateManager.initialize();

      uiLogger.operation('Wallet container initialization', 'success');
    } catch (error) {
      uiLogger.operation('Wallet container initialization', 'error', { error });
      await this.errorHandler.handle(error as Error, {
        component: "ToolboxWalletContainerRefactored",
        operation: "connectedCallback",
      });
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // Cleanup subscriptions
    if (this.unsubscribeFromState) {
      this.unsubscribeFromState();
    }

    // Cleanup event coordination
    this.eventCoordinator.cleanup();

    // Cleanup auto-lock
    this.autoLockManager.cleanup();

    uiLogger.debug("Wallet container disconnected");
  }

  /**
   * Handle navigation to different screens
   */
  private handleNavigation = async (screen: WalletState["currentScreen"]) => {
    try {
      await this.stateManager.setCurrentScreen(screen);
    } catch (error) {
      await this.errorHandler.handle(error as Error, {
        component: "ToolboxWalletContainerRefactored",
        operation: "handleNavigation",
      });
    }
  };

  /**
   * Handle wallet errors
   */
  private handleError = async (event: CustomEvent) => {
    const error = event.detail;
    console.error("Wallet error received:", error);

    // Show error to user (could be replaced with a toast/notification system)
    if (error.severity === "critical") {
      alert(`Critical Error: ${error.message}`);
    }
  };

  /**
   * Retry initialization on error
   */
  private handleRetryInitialization = async () => {
    try {
      await this.stateManager.initialize();
    } catch (error) {
      await this.errorHandler.handle(error as Error, {
        component: "ToolboxWalletContainerRefactored",
        operation: "handleRetryInitialization",
      });
    }
  };

  /**
   * Set network context for blockchain operations
   */
  setNetworkContext(context: any): void {
    this.networkContext = context;
    this.stateManager.setNetworkContext(context);
    uiLogger.debug('Network context set on wallet container');
  }

  override render() {
    // Show loading state during initialization
    if (!this.walletState.accounts && !this.walletState.networks.length) {
      return this.renderLoadingState();
    }

    return html`
      <div class="wallet-container" @wallet-error=${this.handleError}>
        <pact-toolbox-wallet-header
          .selectedAccount=${this.walletState.selectedAccount}
          .activeNetwork=${this.walletState.activeNetwork}
        ></pact-toolbox-wallet-header>

        <div class="wallet-content">${this.screenRouter.renderScreen(this.walletState)}</div>

        <pact-toolbox-bottom-navigation
          .currentScreen=${this.walletState.currentScreen}
          @navigate=${(e: CustomEvent) => this.handleNavigation(e.detail.screen)}
        ></pact-toolbox-bottom-navigation>
      </div>
    `;
  }

  private renderLoadingState() {
    return html`
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div>Initializing wallet...</div>
      </div>
    `;
  }

  private renderErrorState(error: string) {
    return html`
      <div class="error-container">
        <div class="error-message">Failed to load wallet</div>
        <div class="error-details">${error}</div>
        <button class="retry-button" @click=${this.handleRetryInitialization}>Retry</button>
      </div>
    `;
  }
}
