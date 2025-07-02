import type { Wallet } from "@pact-toolbox/wallet-core";
import { getWalletSystem, isTestEnvironment, isBrowser } from "@pact-toolbox/wallet-adapters";
import { EventEmitter } from "@pact-toolbox/utils";
import type { ContextEventMap } from "@pact-toolbox/types";

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
 * This now integrates with the unified context when available
 */
async function defaultWalletSelector(context?: any): Promise<Wallet | null> {
  // If we have a unified context, use its wallet modal
  if (context && context.eventBus) {
    // Check if there's already a connected wallet in the context
    const contextWallet = context.wallet;
    if (contextWallet) {
      console.log("Using wallet from unified context");
      return contextWallet;
    }

    // Open the unified context's wallet modal
    return new Promise((resolve) => {
      // Subscribe to wallet connection events using context's event bus
      const { eventBus } = context;

      const handleWalletConnected = ({ wallet }: { wallet: Wallet }) => {
        eventBus.off("wallet:connected", handleWalletConnected);
        eventBus.off("wallet:modal:close", handleModalClose);
        resolve(wallet);
      };

      const handleModalClose = () => {
        eventBus.off("wallet:connected", handleWalletConnected);
        eventBus.off("wallet:modal:close", handleModalClose);
        resolve(null);
      };

      eventBus.on("wallet:connected", handleWalletConnected);
      eventBus.on("wallet:modal:close", handleModalClose);

      // Open the modal
      context.openWalletModal();
    });
  }

  // Fallback to wallet system behavior
  const walletSystem = await getWalletSystem();
  const primaryWallet = walletSystem.getPrimary();
  if (primaryWallet) {
    console.log("Using already connected wallet");
    return primaryWallet;
  }

  // No connected wallet, use wallet system connect
  try {
    return await walletSystem.connect();
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    return null;
  }
}

/**
 * Check if we're in a browser environment
 */
export function isBrowserEnvironment(): boolean {
  return isBrowser();
}

/**
 * Get wallet with UI integration
 */
export async function getWalletWithUI(
  walletOrId: Wallet | string | undefined,
  options: WalletUIOptions = {},
  context?: { isLocalNetwork?: boolean; networkId?: string; context?: any },
): Promise<Wallet> {
  // Merge with global config first, then destructure
  const mergedOptions = {
    showUI: isBrowserEnvironment(),
    forceUI: false,
    walletSelector: defaultWalletSelector,
    ...getWalletUIConfig(),
    ...options,
  };

  console.log("mergedOptions", mergedOptions, context);

  const { showUI, forceUI, walletSelector } = mergedOptions;

  // If wallet is provided and UI is not forced, use it directly
  if (walletOrId && !forceUI) {
    console.log("Using provided wallet");
    if (typeof walletOrId === "string") {
      const walletSystem = await getWalletSystem();
      return walletSystem.connect(walletOrId);
    }
    return walletOrId;
  }

  // Check if there's already a connected wallet (unless forceUI is true)
  if (!forceUI) {
    // First check unified context if available
    if (context?.context) {
      const contextWallet = context.context.getWallet();
      if (contextWallet) {
        console.log("Using wallet from unified context for transaction");
        return contextWallet;
      }
    }

    // Then check wallet system
    const walletSystem = await getWalletSystem();
    const primaryWallet = walletSystem.getPrimary();
    if (primaryWallet) {
      console.log("Using already connected wallet for transaction");
      return primaryWallet;
    }
  }

  // Check if we're in test mode
  const isTestMode = isTestEnvironment() || (globalThis as any).__PACT_TOOLBOX_TEST_MODE__ === true;

  // If UI is disabled or we're in test mode, fall back to default behavior
  if (!showUI || isTestMode) {
    // In test mode, use the walletSelector to get the test wallet
    if (isTestMode && !walletOrId) {
      const testWallet = await walletSelector();
      if (testWallet) {
        return testWallet;
      }
    }

    // If no wallet provided, throw error instead of auto-connecting
    if (!walletOrId) {
      throw new Error(
        "No wallet provided and UI is disabled. Please provide a wallet instance or wallet ID, or enable UI to show wallet selector.",
      );
    }

    // Handle provided wallet
    if (typeof walletOrId === "string") {
      console.log("Using provided wallet");
      const walletSystem = await getWalletSystem();
      return walletSystem.connect({
        walletId: walletOrId,
        networkId: context?.networkId,
      });
    }
    return walletOrId;
  }

  // Show wallet selector UI (only if no wallet is connected)
  const wallet = await (walletSelector === defaultWalletSelector
    ? defaultWalletSelector(context?.context)
    : walletSelector());
  console.log("Wallet selected:", wallet);
  if (!wallet) {
    throw new Error("No wallet selected");
  }

  // If using unified context, update the context's wallet
  if (context?.context && wallet) {
    context.context.setWallet(wallet);
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