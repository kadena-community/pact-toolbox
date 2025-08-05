import type { Wallet } from "@pact-toolbox/types";
import { getWalletSystem } from "./wallet-system";
import { isTestEnvironment, isBrowser } from "./environment";

/**
 * Options for signing
 */
export interface SigningOptions {
  signer?: Wallet;
  showUI?: boolean;
  walletId?: string;
  context?: any;
  [key: string]: any;
}

/**
 * Wallet UI integration options
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

  /**
   * Wallet ID to use
   */
  walletId?: string;
}

/**
 * Default wallet selector using wallet-ui modal
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
  const primaryWallet = walletSystem.getPrimaryWallet();
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
 * Get wallet with UI integration
 * 
 * This function is used by the wallet provider registered in the DI container
 * to handle wallet selection with optional UI.
 */
export async function getWalletWithUI(
  walletOrId: Wallet | string | undefined,
  options: WalletUIOptions = {},
  context?: { isLocalNetwork?: boolean; networkId?: string; context?: any },
): Promise<Wallet> {
  const mergedOptions = {
    showUI: isBrowser(),
    forceUI: false,
    walletSelector: defaultWalletSelector,
    ...options,
  };

  const { showUI, forceUI, walletSelector } = mergedOptions;

  // If wallet is provided and UI is not forced, use it directly
  if (walletOrId && !forceUI) {
    if (typeof walletOrId === "string") {
      const walletSystem = await getWalletSystem();
      const wallet = await walletSystem.connect({ walletId: walletOrId });
      return wallet;
    }
    return walletOrId;
  }

  // Check if there's already a connected wallet (unless forceUI is true)
  if (!forceUI) {
    // First check unified context if available
    if (context?.context && 'getWallet' in context.context) {
      const contextWallet = context.context.getWallet();
      if (contextWallet) {
        return contextWallet;
      }
    }

    // Then check wallet system
    const walletSystem = await getWalletSystem();
    const primaryWallet = walletSystem.getPrimaryWallet();
    if (primaryWallet) {
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
      const walletSystem = await getWalletSystem();
      return walletSystem.connect({
        walletId: walletOrId,
        networkId: context?.networkId,
      });
    }
    return walletOrId;
  }

  // Show wallet selector UI
  const wallet = await (walletSelector === defaultWalletSelector
    ? defaultWalletSelector(context?.context)
    : walletSelector());
  if (!wallet) {
    throw new Error("No wallet selected");
  }

  // If using unified context, update the context's wallet
  if (context?.context && 'setWallet' in context.context && wallet) {
    context.context.setWallet(wallet);
  }

  return wallet;
}

/**
 * Setup transaction integration with wallet system
 * 
 * @deprecated This function is no longer needed. The wallet system is now
 * integrated via the DI container. Use `setupWalletDI()` instead.
 */
export function setupTransactionIntegration(): void {
  console.warn(
    "setupTransactionIntegration() is deprecated. " +
    "Wallet integration is now handled automatically via the DI container. " + 
    "Use setupWalletDI() from @pact-toolbox/wallet-adapters instead."
  );
}