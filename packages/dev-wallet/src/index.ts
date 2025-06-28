/**
 * Refactored Dev Wallet - Clean Architecture Export
 *
 * This file exports the refactored components and services with improved
 * separation of concerns, comprehensive error handling, and extensive testing.
 */

// Enhanced Types
export type * from "./types/enhanced-types";
export type * from "./types/error-types";
export { WalletError } from "./types/error-types";

// Core Services
export { AccountService } from "./services/account-service";
export { SettingsService } from "./services/settings-service";
export { TransactionService } from "./services/transaction-service";
export { WalletStateManager } from "./services/wallet-state-manager";

// Components
export { ToolboxWalletContainerRefactored } from "./components/wallet-container";
export { WalletEventCoordinator } from "./components/wallet-event-coordinator";
export { ScreenRouter } from "./components/screen-router";
export { AutoLockManager } from "./components/auto-lock-manager";

// Utilities
export { ErrorHandler, errorHandler, handleErrors } from "./utils/error-handler";

// Storage (enhanced)
export { DevWalletStorage } from "./storage";

// Original exports for backward compatibility (except WalletState which conflicts)
export { type DevWalletConfig, type DevWalletKey, type DevWalletTransaction, type DevWalletSettings } from "./types";
export { DevWallet } from "./wallet";

// Test utilities (for development and testing)
export {
  setupBrowserMocks,
  resetMocks,
  createMockAccount,
  createMockTransaction,
  createMockSettings,
  createMockNetwork,
  waitFor,
} from "./test-utils/setup";
