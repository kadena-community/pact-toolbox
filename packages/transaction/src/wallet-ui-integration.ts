import type { Wallet } from "@pact-toolbox/wallet-core";
import { walletService } from "@pact-toolbox/wallet-adapters";

/**
 * Wallet UI integration options for transaction builder
 */
export interface WalletUIOptions {
  /**
   * Whether to show wallet selector UI automatically
   * @default true in browser, false in Node.js
   */
  showUI?: boolean;

  /**
   * Force UI even when wallet is provided
   * @default false
   */
  forceUI?: boolean;

  /**
   * Custom wallet selector function
   */
  walletSelector?: () => Promise<Wallet | null>;
}

/**
 * Default wallet selector using wallet-ui modal
 */
async function defaultWalletSelector(): Promise<Wallet | null> {
  // Check if there's already a connected wallet
  const primaryWallet = walletService.getPrimaryWallet();
  if (primaryWallet) {
    console.log("Using already connected wallet");
    return primaryWallet;
  }

  // No connected wallet, show selector
  // Dynamically import wallet-ui to avoid loading it in Node.js
  const { ModalManager } = await import("@pact-toolbox/wallet-ui");
  const modalManager = ModalManager.getInstance();

  modalManager.initialize();
  const walletId = await modalManager.showWalletSelector();

  if (!walletId) {
    return null;
  }

  // Connect to selected wallet
  return walletService.connect(walletId);
}

/**
 * Check if we're in a browser environment
 */
export function isBrowserEnvironment(): boolean {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.navigator !== "undefined"
  );
}

/**
 * Get wallet with UI integration
 */
export async function getWalletWithUI(
  walletOrId: Wallet | string | undefined,
  options: WalletUIOptions = {},
  context?: { isLocalNetwork?: boolean; networkId?: string },
): Promise<Wallet> {
  console.log("Getting wallet with UI");
  const {
    showUI = isBrowserEnvironment(),
    forceUI = false,
    walletSelector = defaultWalletSelector,
  } = options;

  // If wallet is provided and UI is not forced, use it directly
  if (walletOrId && !forceUI) {
    console.log("Using provided wallet");
    if (typeof walletOrId === "string") {
      return walletService.connect(walletOrId);
    }
    return walletOrId;
  }

  // Check if there's already a connected wallet (unless forceUI is true)
  if (!forceUI) {
    const primaryWallet = walletService.getPrimaryWallet();
    if (primaryWallet) {
      console.log("Using already connected wallet for transaction");
      return primaryWallet;
    }
  }

  // If UI is disabled, fall back to default behavior
  if (!showUI) {
    // If no wallet provided, throw error instead of auto-connecting
    if (!walletOrId) {
      throw new Error(
        "No wallet provided and UI is disabled. Please provide a wallet instance or wallet ID, or enable UI to show wallet selector.",
      );
    }

    // Handle provided wallet
    if (typeof walletOrId === "string") {
      console.log("Using provided wallet");
      return walletService.connect(walletOrId, {
        networkId: context?.networkId,
      });
    }
    return walletOrId;
  }

  // Show wallet selector UI (only if no wallet is connected)
  const wallet = await walletSelector();
  console.log("Wallet selected:", wallet);
  if (!wallet) {
    throw new Error("No wallet selected");
  }

  return wallet;
}

/**
 * Global UI configuration
 */
let globalUIConfig: WalletUIOptions = {};

/**
 * Configure global wallet UI behavior
 */
export function configureWalletUI(options: WalletUIOptions): void {
  globalUIConfig = { ...globalUIConfig, ...options };
}

/**
 * Get global UI configuration
 */
export function getWalletUIConfig(): WalletUIOptions {
  return globalUIConfig;
}
