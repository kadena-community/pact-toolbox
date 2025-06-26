import type { LitElement } from "lit";
import "@pact-toolbox/ui-shared";

/**
 * Manages the display and lifecycle of the dev wallet modal
 */
export class ModalManager {
  private static instance: ModalManager;
  private modalElement: LitElement | null = null;
  private initialized = false;

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  /**
   * Initialize the modal manager
   */
  initialize(): void {
    if (this.initialized || typeof document === "undefined") {
      return;
    }

    // The modal will be created on demand
    this.initialized = true;
  }

  /**
   * Show the dev wallet UI
   */
  showDevWallet(): void {
    if (typeof document === "undefined") {
      return;
    }

    // Create floating wallet container if it doesn't exist
    let container = document.querySelector("#pact-dev-wallet-container") as HTMLDivElement;
    if (!container) {
      container = document.createElement("div");
      container.id = "pact-dev-wallet-container";
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        height: 700px;
        z-index: 9999;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      `;
      document.body.appendChild(container);

      // Create theme provider wrapper
      const themeProvider = document.createElement("pact-theme-provider");
      themeProvider.setAttribute("theme", "auto");
      themeProvider.style.height = "100%";
      container.appendChild(themeProvider);

      // Create wallet component inside theme provider
      const wallet = document.createElement("pact-dev-wallet");
      themeProvider.appendChild(wallet);

      this.modalElement = wallet as LitElement;
      
      // Wait for next frame to avoid flicker
      requestAnimationFrame(() => {
        container.style.opacity = "1";
      });
    }

    // Show the container with fade-in
    container.style.display = "block";
    requestAnimationFrame(() => {
      container.style.opacity = "1";
    });

    // Dispatch event to notify components that wallet is shown
    document.dispatchEvent(new CustomEvent('toolbox-wallet-shown'));
  }

  /**
   * Hide the dev wallet UI
   */
  hideDevWallet(): void {
    const container = document.querySelector("#pact-dev-wallet-container") as HTMLElement;
    if (container) {
      container.style.opacity = "0";
      setTimeout(() => {
        container.style.display = "none";
        // Dispatch event to notify components that wallet is hidden
        document.dispatchEvent(new CustomEvent('toolbox-wallet-hidden'));
      }, 300);
    }
  }

  /**
   * Clean up the modal
   */
  cleanup(): void {
    this.hideDevWallet();
  }

  /**
   * Check if the modal is visible
   */
  isVisible(): boolean {
    const container = document.querySelector("#pact-dev-wallet-container") as HTMLElement;
    return !!(container && container.style.display !== "none" && container.style.opacity !== "0");
  }
}
