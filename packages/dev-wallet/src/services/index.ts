/**
 * @fileoverview Service exports and factory functions with dependency injection
 */

import { createProvider } from "@pact-toolbox/utils";
import { createToken, type ServiceToken } from "@pact-toolbox/types";
import { AccountService } from "./account-service";
import { SettingsService } from "./settings-service";
import { TransactionService } from "./transaction-service";
import { WalletStateManager } from "./wallet-state-manager";

// Export service classes
export { AccountService } from "./account-service";
export { SettingsService } from "./settings-service";
export { TransactionService } from "./transaction-service";
export { WalletStateManager } from "./wallet-state-manager";

// Create service tokens for dev-wallet services
export const ACCOUNT_SERVICE: ServiceToken<AccountService> = createToken<AccountService>("AccountService");
export const SETTINGS_SERVICE: ServiceToken<SettingsService> = createToken<SettingsService>("SettingsService");
export const TRANSACTION_SERVICE: ServiceToken<TransactionService> = createToken<TransactionService>("TransactionService");
export const WALLET_STATE_MANAGER: ServiceToken<WalletStateManager> = createToken<WalletStateManager>("WalletStateManager");

/**
 * Factory function to create WalletStateManager with dependencies
 */
export const createWalletStateManager = createProvider(
  [ACCOUNT_SERVICE, SETTINGS_SERVICE, TRANSACTION_SERVICE],
  (accountService: AccountService, settingsService: SettingsService, transactionService: TransactionService) => {
    return new WalletStateManager(accountService, settingsService, transactionService);
  },
);

/**
 * Register all dev-wallet services in the container
 */
export function registerDevWalletServices(container: any) {
  // Register base services
  container.register(ACCOUNT_SERVICE, () => new AccountService());
  container.register(SETTINGS_SERVICE, () => new SettingsService());
  container.register(TRANSACTION_SERVICE, () => new TransactionService());

  // Register composite services with dependencies
  container.register(WALLET_STATE_MANAGER, createWalletStateManager);
}

/**
 * Create all dev-wallet services with proper wiring
 */
export function createDevWalletServices() {
  const accountService = new AccountService();
  const settingsService = new SettingsService();
  const transactionService = new TransactionService();
  const walletStateManager = new WalletStateManager(accountService, settingsService, transactionService);

  return {
    accountService,
    settingsService,
    transactionService,
    walletStateManager,
  };
}
