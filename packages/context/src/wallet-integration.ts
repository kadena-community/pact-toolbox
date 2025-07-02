import type { Wallet, WalletMetadata } from "@pact-toolbox/wallet-core";
import { getWalletSystem, type TypeSafeWalletConfig, isTestEnvironment, isBrowser } from "@pact-toolbox/wallet-adapters";
import { eventBus } from "./events";
import type { ContextConfig } from "./types";

/**
 * Initialize wallet system for the context
 */
export async function initializeWalletSystem(config: ContextConfig & { _walletConfig?: TypeSafeWalletConfig }): Promise<{
  walletSystem: Awaited<ReturnType<typeof getWalletSystem>>;
  availableWallets: WalletMetadata[];
}> {
  // Use provided wallet config or build from legacy config
  const walletConfig: TypeSafeWalletConfig = config._walletConfig || {
    preferences: {
      autoConnect: config.autoConnectWallet,
      preferredOrder: config.preferredWallets,
    },
    ui: {
      showOnConnect: config.enableWalletUI && !isTestEnvironment(),
    },
  };

  // Initialize wallet system
  const walletSystem = await getWalletSystem(walletConfig);
  
  // Get available wallets
  const availableWallets = await walletSystem.getAvailable();

  // Set up event forwarding
  walletSystem.on("connected", (wallet: Wallet) => {
    eventBus.emit("wallet:connected", { wallet });
  });

  walletSystem.on("disconnected", (_walletId: string) => {
    eventBus.emit("wallet:disconnected", { wallet: null });
  });

  walletSystem.on("error", (error: Error) => {
    eventBus.emit("wallet:error", { error });
  });

  // Auto-connect if configured
  if (config.autoConnectWallet) {
    walletSystem.autoConnect().catch(() => {
      // Ignore auto-connect failures
    });
  }

  return { walletSystem, availableWallets };
}

/**
 * Create wallet modal component
 */
export function createWalletModal(): HTMLElement | null {
  if (!isBrowser() || isTestEnvironment()) return null;

  // Import wallet UI components
  import("@pact-toolbox/wallet-ui").then(() => {
    // Components will auto-register
  });

  // Create modal element
  const modal = document.createElement("pact-wallet-modal");
  modal.setAttribute("open", "false");
  
  // Create selector inside modal
  const selector = document.createElement("pact-wallet-selector");
  modal.appendChild(selector);

  // Handle wallet selection
  selector.addEventListener("wallet-selected", async (event: any) => {
    const { walletId } = event.detail;
    try {
      const walletSystem = await getWalletSystem();
      await walletSystem.connect(walletId);
      modal.setAttribute("open", "false");
      eventBus.emit("wallet:modal:close");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  });

  // Handle auto-connect
  selector.addEventListener("auto-connect", async () => {
    try {
      const walletSystem = await getWalletSystem();
      await walletSystem.autoConnect();
      modal.setAttribute("open", "false");
      eventBus.emit("wallet:modal:close");
    } catch (error) {
      console.error("Failed to auto-connect:", error);
    }
  });

  return modal;
}