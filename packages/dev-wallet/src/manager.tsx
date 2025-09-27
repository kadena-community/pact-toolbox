import { render } from "solid-js/web";
import { initializeGlobalStyles, ThemeProvider, ToastProvider } from "@pact-toolbox/ui-shared";
import { WalletContainer } from "./components/wallet-container";
import { css } from "goober";

export interface DevWalletManagerOptions {
  containerId?: string;
  theme?: "light" | "dark" | "auto";
  position?: "right" | "bottom" | "floating";
}

const floatingButtonStyles = css`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--pact-color-primary);
  color: var(--pact-color-text-on-primary);
  border: 2px solid var(--pact-color-bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--pact-shadow-lg);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  z-index: var(--pact-z-index-toast);

  &:hover {
    transform: scale(1.1);
    background: var(--pact-color-primary-hover);
    box-shadow: var(--pact-shadow-xl);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const walletContainerStyles = css`
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  max-width: 100%;
  background: var(--pact-color-bg-primary);
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: var(--pact-z-index-fixed);
  transform: translateX(100%);
  transition: transform 0.3s ease-out;

  &.visible {
    transform: translateX(0);
  }
`;

const walletContainerBottomStyles = css`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 600px;
  max-height: 90vh;
  background: var(--pact-color-bg-primary);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: var(--pact-z-index-fixed);
  transform: translateY(100%);
  transition: transform 0.3s ease-out;

  &.visible {
    transform: translateY(0);
  }
`;

const walletContainerFloatingStyles = css`
  position: fixed;
  bottom: 80px;
  right: var(--pact-spacing-5);
  width: 400px;
  height: 600px;
  max-width: calc(100vw - var(--pact-spacing-10));
  max-height: calc(100vh - 100px);
  background: var(--pact-color-bg-primary);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-xl);
  box-shadow: var(--pact-modal-shadow);
  z-index: var(--pact-z-index-fixed);
  transform: scale(0) translateY(20px);
  transform-origin: bottom right;
  transition: transform var(--pact-transition-slow) cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.visible {
    transform: scale(1) translateY(0);
  }
`;

export class DevWalletManager {
  private container: HTMLElement | null = null;
  private walletContainer: HTMLElement | null = null;
  private floatingButton: HTMLElement | null = null;
  private initialized = false;
  private visible = false;
  private options: DevWalletManagerOptions;
  cleanup: (() => void) | null = null;

  constructor(options: DevWalletManagerOptions = {}) {
    this.options = {
      containerId: "pact-dev-wallet-root",
      theme: "light",
      position: "floating",
      ...options,
    };
  }

  initialize(): void {
    if (this.initialized) return;

    // Initialize global styles
    initializeGlobalStyles();

    // Create container
    this.ensureContainer();

    // Always create floating button to ensure it's always visible
    this.createFloatingButton();

    // Set up close event listener
    document.addEventListener("toolbox-close-wallet", this.handleCloseWallet);

    this.initialized = true;
  }

  private ensureContainer(): void {
    if (!this.container) {
      this.container = document.getElementById(this.options.containerId!);

      if (!this.container) {
        this.container = document.createElement("div");
        this.container.id = this.options.containerId!;
        this.container.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: var(--pact-z-index-fixed);
          inset: 0;
          isolation: isolate;
        `;
        document.body.appendChild(this.container);
      }
    }
  }

  private createFloatingButton(): void {
    if (!this.floatingButton) {
      this.floatingButton = document.createElement("button");
      this.floatingButton.className = floatingButtonStyles;
      this.floatingButton.setAttribute("aria-label", "Open Dev Wallet");
      // Additional inline styles to ensure visibility
      this.floatingButton.style.position = "fixed";
      this.floatingButton.style.zIndex = "var(--pact-z-index-toast)";
      this.floatingButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      `;
      this.floatingButton.onclick = () => this.toggleDevWallet();
      document.body.appendChild(this.floatingButton);
    }
  }

  private getContainerStyles(): string {
    switch (this.options.position) {
      case "bottom":
        return walletContainerBottomStyles;
      case "floating":
        return walletContainerFloatingStyles;
      case "right":
      default:
        return walletContainerStyles;
    }
  }

  private handleCloseWallet = () => {
    this.hideDevWallet();
  };

  showDevWallet(): void {
    this.ensureContainer();

    if (!this.walletContainer) {
      // Create wallet container
      this.walletContainer = document.createElement("div");
      this.walletContainer.className = this.getContainerStyles();
      // Additional inline styles to ensure visibility
      this.walletContainer.style.pointerEvents = "auto";
      this.walletContainer.style.zIndex = "var(--pact-z-index-side-panel)";
      this.container!.appendChild(this.walletContainer);

      // Render the wallet component with ThemeProvider and ToastProvider
      this.cleanup = render(
        () => (
          <ThemeProvider theme={this.options.theme || "auto"}>
            <ToastProvider>
              <WalletContainer />
            </ToastProvider>
          </ThemeProvider>
        ),
        this.walletContainer,
      );
    }

    // Show with animation
    // Small delay to ensure DOM is ready for CSS transition
    requestAnimationFrame(() => {
      if (this.walletContainer) {
        this.walletContainer.classList.add("visible");
      }
    });

    this.visible = true;

    // Keep floating button visible but change its appearance when wallet is open
    if (this.floatingButton && this.options.position === "floating") {
      this.floatingButton.style.opacity = "0.7";
      this.floatingButton.style.transform = "scale(0.9)";
    }
  }

  hideDevWallet(): void {
    if (this.walletContainer) {
      this.walletContainer.classList.remove("visible");

      // Listen for transition end to cleanup
      const handleTransitionEnd = () => {
        if (this.walletContainer && this.walletContainer.parentNode) {
          this.walletContainer.removeEventListener('transitionend', handleTransitionEnd);
          this.walletContainer.parentNode.removeChild(this.walletContainer);
          this.walletContainer = null;
        }

        // Clean up the Solid app
        if (this.cleanup) {
          this.cleanup();
          this.cleanup = null;
        }
      };
      this.walletContainer.addEventListener('transitionend', handleTransitionEnd);
    }

    this.visible = false;

    // Restore floating button to normal appearance
    if (this.floatingButton && this.options.position === "floating") {
      this.floatingButton.style.opacity = "1";
      this.floatingButton.style.transform = "scale(1)";
    }
  }

  toggleDevWallet(): void {
    if (this.visible) {
      this.hideDevWallet();
    } else {
      this.showDevWallet();
    }
  }

  setTheme(theme: "light" | "dark"): void {
    this.options.theme = theme;
    // Theme will be applied when wallet is shown
  }

  destroy(): void {
    this.hideDevWallet();

    if (this.floatingButton && this.floatingButton.parentNode) {
      this.floatingButton.parentNode.removeChild(this.floatingButton);
      this.floatingButton = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.innerHTML = "";
    }

    document.removeEventListener("toolbox-close-wallet", this.handleCloseWallet);

    this.initialized = false;
  }
}

// Create default instance
let defaultDevWalletManager: DevWalletManager | null = null;

export function getDefaultDevWalletManager(options?: DevWalletManagerOptions): DevWalletManager {
  if (!defaultDevWalletManager) {
    defaultDevWalletManager = new DevWalletManager(options);
  }
  return defaultDevWalletManager;
}

export function createDevWalletManager(options?: DevWalletManagerOptions): DevWalletManager {
  return new DevWalletManager(options);
}

// Backward compatibility
export const getDefaultModalManager = getDefaultDevWalletManager;
export const createModalManager = createDevWalletManager;
export type ModalManagerOptions = DevWalletManagerOptions;
export const ModalManager = DevWalletManager;
