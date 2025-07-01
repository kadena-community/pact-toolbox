import { initializeGlobalStyles } from "@pact-toolbox/ui-shared";
import { getGlobalWalletManager } from "./utils";
import { showWalletSelectorModal, showNetworkSelectorModal } from "./modal-renderer";

export interface WalletUIManagerOptions {
  containerId?: string;
  theme?: "light" | "dark" | "auto";
  walletSelectorTitle?: string;
  walletSelectorDescription?: string;
}

export class WalletUIManager {
  private container: HTMLElement | null = null;
  private initialized = false;
  private options: WalletUIManagerOptions;
  private walletManager: any;

  constructor(options: WalletUIManagerOptions = {}) {
    this.options = {
      containerId: "pact-wallet-ui-root",
      theme: "auto",
      ...options,
    };
  }

  initialize(walletManager?: any): void {
    this.walletManager = walletManager || getGlobalWalletManager();
    if (this.initialized) return;

    // Initialize global styles
    initializeGlobalStyles();
    this.ensureContainer();
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
        this.container.style.cssText =
          "position: fixed; z-index: 9999; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";
        document.body.appendChild(this.container);
      }
    }
  }

  setTheme(theme: "light" | "dark"): void {
    this.options.theme = theme;
    // Theme will be applied when modal is shown
  }


  async showWalletSelector(): Promise<string | null> {
    this.ensureContainer();

    return await showWalletSelectorModal({
      container: this.container!,
      theme: this.options.theme,
      title: this.options.walletSelectorTitle,
      description: this.options.walletSelectorDescription,
      walletManager: this.walletManager,
    });
  }

  async showNetworkSelector(): Promise<string | null> {
    this.ensureContainer();

    return showNetworkSelectorModal({
      container: this.container!,
      theme: this.options.theme,
      title: "Select Network",
    });
  }

  async connectWallet(walletId?: string): Promise<boolean> {
    try {
      if (!this.walletManager) {
        throw new Error("Wallet manager not set");
      }
      if (walletId && walletId !== "auto") {
        await this.walletManager.connect({ walletId });
      }
      return true;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return false;
    }
  }

  cleanup(): void {
    if (this.container && this.container.parentNode) {
      this.container.innerHTML = "";
    }
  }
}

/**
 * Creates a new WalletUIManager instance
 */
export function createWalletUIManager(options?: WalletUIManagerOptions): WalletUIManager {
  return new WalletUIManager(options);
}

// Backward compatibility
export const createModalManager = createWalletUIManager;
export type ModalManagerOptions = WalletUIManagerOptions;
export const ModalManager = WalletUIManager;

// Default instance for backward compatibility
let defaultWalletUIManager: WalletUIManager | null = null;

/**
 * Gets the default WalletUIManager instance
 */
export function getDefaultWalletUIManager(options?: WalletUIManagerOptions): WalletUIManager {
  if (!defaultWalletUIManager) {
    defaultWalletUIManager = createWalletUIManager(options);
  }
  return defaultWalletUIManager;
}

// Backward compatibility
export const getDefaultModalManager = getDefaultWalletUIManager;
