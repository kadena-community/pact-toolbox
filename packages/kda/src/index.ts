// Export all types
export * from "./types";

// Export services (require network context) - Legacy exports for backward compatibility
export { CoinService } from "./coin-service";
export type {
  CoinServiceConfig,
  CoinOperationOptions,
  CreateAccountOptions,
  TransferOptions,
  TransferCreateOptions,
  CrosschainTransferOptions,
  AccountInfo,
} from "./coin-service";

export { MarmaladeService } from "./marmalade-service";
export type {
  MarmaladeServiceConfig,
  MarmaladeOperationOptions,
  TokenInfo,
  CreateTokenOptions,
  MintTokenOptions,
  TransferTokenOptions,
  TransferCreateTokenOptions,
  BurnTokenOptions,
  CreateSaleOptions,
  BuyTokenOptions,
  PolicyInfo,
  TokenAccountInfo,
} from "./marmalade-service";

export { NamespaceService } from "./namespace-service";
export type {
  NamespaceServiceConfig,
  NamespaceOperationOptions,
  CreatePrincipalNamespaceOptions,
  NamespaceResult,
} from "./namespace-service";

// Export new DI-based services
export {
  // Coin Service DI
  CoinServiceDI,
  createCoinService,
  type CoinServiceConfigDI,
  // Adapters for migration
  createAdaptersFromContext
} from "./coin-service";

export {
  // Marmalade Service DI
  MarmaladeServiceDI,
  createMarmaladeService,
  type MarmaladeServiceConfigDI,
  type GetBalanceOptions,
} from "./marmalade-service";

export {
  // Namespace Service DI
  NamespaceServiceDI,
  createNamespaceService,
  type NamespaceServiceConfigDI,
  type CreateNamespaceOptions,
  type RotateNamespaceOptions,
  type DefineModuleOptions,
  type DefineInterfaceOptions,
  type NamespaceInfo,
} from "./namespace-service";

// Export standalone utilities (no network context required)
export * as pact from "./pact";
