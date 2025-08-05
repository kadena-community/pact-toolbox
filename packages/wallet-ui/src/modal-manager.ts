import { getWalletSystem } from "@pact-toolbox/wallet-adapters";
import "./components/wallet-modal";
import "./components/wallet-selector";
import "@pact-toolbox/ui-shared";
import type { PactWalletModal } from "./components/wallet-modal";
import type { PactWalletSelector } from "./components/wallet-selector";
import type { PactThemeProvider } from "@pact-toolbox/ui-shared";

export interface ModalManagerOptions {
  containerId?: string;
  theme?: "light" | "dark" | "auto";
}

export class ModalManager {
  private container: HTMLElement | null = null;
  private themeProvider: PactThemeProvider | null = null;
  private modal: PactWalletModal | null = null;
  private initialized = false;
  private options: ModalManagerOptions;

  constructor(options: ModalManagerOptions = {}) {
    this.options = {
      containerId: "pact-wallet-ui-root",
      theme: "auto",
      ...options,
    };
  }

  initialize(): void {
    if (this.initialized) return;

    this.ensureContainer();
    this.applyTheme();
    this.initialized = true;
  }

  private ensureContainer(): void {
    if (!this.container) {
      // Check if container already exists
      this.container = document.getElementById(this.options.containerId!);

      if (!this.container) {
        // Create new container
        this.container = document.createElement("div");
        this.container.id = this.options.containerId!;
        this.container.style.cssText = "position: fixed; z-index: 9999;"; // Use fixed z-index temporarily
        document.body.appendChild(this.container);
      }

      // Create theme provider wrapper
      if (!this.themeProvider) {
        this.themeProvider = document.createElement("pact-theme-provider") as PactThemeProvider;
        this.themeProvider.theme = this.options.theme || "light";
        this.container.appendChild(this.themeProvider);
      }

      // Wait for custom element to be defined before creating
      if (!customElements.get("pact-wallet-modal")) {
        console.warn("pact-wallet-modal not yet defined, importing components...");
        // Force import of components if not already defined
        import("./components/wallet-modal");
      }

      // Create modal instance inside theme provider
      this.modal = document.createElement("pact-wallet-modal") as PactWalletModal;
      this.themeProvider.appendChild(this.modal);
    }
  }

  private applyTheme(): void {
    if (this.options.theme === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.setTheme(prefersDark ? "dark" : "light");
    } else if (this.options.theme) {
      this.setTheme(this.options.theme);
    }
  }

  setTheme(theme: "light" | "dark"): void {
    if (this.themeProvider) {
      this.themeProvider.theme = theme;
    }
  }

  async showWalletSelector(): Promise<string | null> {
    this.ensureContainer();

    return new Promise((resolve) => {
      if (!this.modal) {
        resolve(null);
        return;
      }

      // Create wallet selector
      const selector = document.createElement("pact-wallet-selector") as PactWalletSelector;

      // Handle wallet selection
      const handleWalletSelected = (e: CustomEvent) => {
        cleanup();
        console.log("handleWalletSelected Wallet selected:", e.detail.walletId);
        resolve(e.detail.walletId);
      };

      // Handle auto-connect
      const handleAutoConnect = () => {
        cleanup();
        console.log("handleAutoConnect Auto-connect selected");
        resolve("auto");
      };

      // Handle modal close
      const handleClose = () => {
        cleanup();
        console.log("handleClose Modal closed");
        resolve(null);
      };

      const cleanup = () => {
        selector.removeEventListener("wallet-selected", handleWalletSelected as EventListener);
        selector.removeEventListener("auto-connect", handleAutoConnect as EventListener);
        this.modal!.removeEventListener("close", handleClose as EventListener);
        this.modal!.open = false;
        this.modal!.innerHTML = "";
      };

      // Add event listeners
      selector.addEventListener("wallet-selected", handleWalletSelected as EventListener);
      selector.addEventListener("auto-connect", handleAutoConnect as EventListener);
      this.modal.addEventListener("close", handleClose as EventListener);

      // Show modal
      this.modal.heading = "Connect Wallet";
      this.modal.innerHTML = "";
      this.modal.appendChild(selector);
      this.modal.open = true;
    });
  }


  async connectWallet(walletId?: string): Promise<boolean> {
    try {
      const walletSystem = await getWalletSystem();
      if (walletId && walletId !== "auto") {
        await (walletSystem as any).connect({ walletId });
      }
      return true;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return false;
    }
  }

  cleanup(): void {
    if (this.modal) {
      this.modal.open = false;
      this.modal.innerHTML = "";
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.modal = null;
    this.initialized = false;
  }
}

/**
 * Creates a new ModalManager instance
 */
export function createModalManager(options?: ModalManagerOptions): ModalManager {
  return new ModalManager(options);
}

// Default instance for backward compatibility
let defaultModalManager: ModalManager | null = null;

/**
 * Gets the default ModalManager instance (for backward compatibility)
 * @deprecated Use createModalManager() for new code
 */
export function getDefaultModalManager(options?: ModalManagerOptions): ModalManager {
  if (!defaultModalManager) {
    defaultModalManager = createModalManager(options);
  }
  return defaultModalManager;
}
