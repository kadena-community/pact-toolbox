// Export the legacy version for backward compatibility
export { MarmaladeService, type MarmaladeServiceConfig } from "./marmalade-service-legacy";

// Export the new DI-based version
export { 
  MarmaladeServiceDI, 
  createMarmaladeService,
  type MarmaladeServiceConfigDI,
  type MarmaladeOperationOptions,
  type TokenInfo,
  type CreateTokenOptions,
  type MintTokenOptions,
  type TransferTokenOptions,
  type TransferCreateTokenOptions,
  type BurnTokenOptions,
  type GetBalanceOptions
} from "./marmalade-service-di";