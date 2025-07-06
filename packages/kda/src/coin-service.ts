// Export the legacy version for backward compatibility
export { CoinService, type CoinServiceConfig } from "./coin-service-legacy";

// Export the new DI-based version
export { 
  CoinServiceDI, 
  createCoinService,
  type CoinServiceConfigDI,
  type CoinOperationOptions,
  type CreateAccountOptions,
  type TransferOptions,
  type TransferCreateOptions,
  type CrosschainTransferOptions,
  type AccountInfo
} from "./coin-service-di";

// Re-export adapters for those who need them
export { createAdaptersFromContext } from "./context-adapter";