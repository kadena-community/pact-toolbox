/**
 * Setup dependency injection for wallet adapters
 * 
 * This file configures the DI container to provide wallet functionality
 * to other packages without creating direct dependencies.
 */

import { register, resolve } from "@pact-toolbox/utils";
import { TOKENS } from "@pact-toolbox/types";
import { createWalletSystem, WalletSystem } from "./wallet-system";
import { WalletRegistry } from "./wallet-registry";
import type { SigningOptions } from "./transaction-integration";
import type { TypeSafeWalletConfig } from "./config";

/**
 * Initialize wallet adapters in the DI container
 * 
 * Call this function once during application startup to configure
 * wallet functionality for the entire application.
 * 
 * @example
 * ```ts
 * import { setupWalletDI } from '@pact-toolbox/wallet-adapters';
 * 
 * // In your app initialization
 * await setupWalletDI({
 *   wallets: {
 *     chainweaver: true,
 *     walletconnect: { projectId: 'your-project-id' }
 *   }
 * });
 * ```
 */
export async function setupWalletDI(config?: TypeSafeWalletConfig): Promise<void> {
  // Create and register wallet system
  const walletSystem = await createWalletSystem(config);
  register(TOKENS.WalletSystem, walletSystem);

  // Register wallet registry interface
  register(TOKENS.WalletRegistry, {
    register: WalletRegistry.register.bind(WalletRegistry),
    get: (name: string) => WalletRegistry['providers'].get(name),
    list: () => WalletRegistry.getProviderIds()
  });

  // Register wallet provider function for transaction package
  register(TOKENS.WalletProvider, async (options?: SigningOptions) => {
    const system = resolve(TOKENS.WalletSystem) as WalletSystem;
    
    if (options?.signer) {
      return options.signer;
    }

    // If no primary wallet, connect one
    if (!system.getPrimaryWallet()) {
      await system.connect(options);
    }

    const wallet = system.getPrimaryWallet();
    if (!wallet) {
      throw new Error("No wallet connected");
    }

    return wallet;
  });

  // Register wallet persistence
  const { persistWallet, getPersistedWallet, clearPersistedWallet } = await import('./persistence');
  register(TOKENS.WalletPersistence, {
    save: persistWallet,
    load: () => getPersistedWallet()?.lastWalletId || null,
    clear: clearPersistedWallet
  });
}

/**
 * Auto-setup in browser environment
 * 
 * This automatically configures DI when the module is imported in a browser.
 * For Node.js or custom setups, call setupWalletDI() manually.
 */
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  // Auto-setup with default config in browser
  setupWalletDI().catch(console.error);
}