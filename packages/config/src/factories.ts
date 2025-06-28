import { defu } from "defu";

import type { ChainwebNetworkConfig, DevNetworkConfig, PactServerConfig, PactServerNetworkConfig } from "./config";
import { defaultKeyPairs, defaultKeysets, defaultMeta } from "./defaults";
import { createChainwebRpcUrl } from "./utils";
import { 
  validatePactServerConfig, 
  validateDevNetContainerConfig,
  validateDevNetMiningConfig,
  validateNetworkConfig
} from "./validation";

/**
 * Default testnet RPC URL for Kadena chainweb
 */
export const DEFAULT_TESTNET_RPC_URL: string = createChainwebRpcUrl({
  host: "https://api.testnet.chainweb.com",
});

/**
 * Create a Pact Server configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete Pact Server configuration
 * @throws {ConfigValidationError} If configuration is invalid
 */
export function createPactServerConfig(overrides?: Partial<PactServerConfig>): Required<PactServerConfig> {
  const defaults = {
    port: 9091,
    logDir: ".pact-toolbox/pact/logs",
    persistDir: ".pact-toolbox/pact/persist",
    verbose: true,
    pragmas: [],
    execConfig: ["DisablePact44", "AllowReadInLocal"],
    gasLimit: 150000,
    gasRate: 0.01,
    entity: "entity",
  };
  
  // Validate overrides if provided
  if (overrides) {
    validatePactServerConfig(overrides);
  }
  
  return {
    ...defaults,
    ...overrides,
  } as Required<PactServerConfig>;
}

/**
 * Create a Pact Server network configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete Pact Server network configuration
 * @throws {ConfigValidationError} If configuration is invalid
 * @example
 * ```typescript
 * const config = createPactServerNetworkConfig({
 *   serverConfig: { port: 9091 },
 *   meta: { gasLimit: 50000 }
 * });
 * ```
 */
export function createPactServerNetworkConfig(overrides?: Partial<PactServerNetworkConfig>): PactServerNetworkConfig {
  const defaults = {
    type: "pact-server" as const,
    rpcUrl: "http://localhost:{port}",
    networkId: "development",
    keyPairs: defaultKeyPairs,
    keysets: defaultKeysets,
    senderAccount: "sender00",
    autoStart: true,
    serverConfig: createPactServerConfig(),
    meta: defaultMeta,
    name: "pactServer",
  } satisfies PactServerNetworkConfig;
  
  // Merge with overrides
  const config = defu(overrides ?? {}, defaults) as PactServerNetworkConfig;
  
  // Skip validation during build/test to avoid circular dependencies
  // Validation will be done when the config is actually used
  if (process.env["NODE_ENV"] !== 'test' && typeof globalThis !== 'undefined' && !(globalThis as any).__vitest__) {
    validateNetworkConfig(config);
  }
  
  return config;
}

/**
 * Create a DevNet network configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete DevNet network configuration
 * @throws {ConfigValidationError} If configuration is invalid
 * @example
 * ```typescript
 * const config = createDevNetNetworkConfig({
 *   containerConfig: {
 *     port: 8080,
 *     onDemandMining: true
 *   }
 * });
 * ```
 */
export function createDevNetNetworkConfig(overrides?: Partial<DevNetworkConfig>): DevNetworkConfig {
  const defaults = {
    type: "chainweb-devnet" as const,
    rpcUrl: createChainwebRpcUrl(),
    networkId: "development",
    keyPairs: defaultKeyPairs,
    keysets: defaultKeysets,
    senderAccount: "sender00",
    autoStart: true,
    containerConfig: {
      port: 8080,
      persistDb: true,
      onDemandMining: false,
    },
    miningConfig: {
      transactionBatchPeriod: 0.05,
      confirmationCount: 5,
      confirmationPeriod: 5.0,
      disableConfirmationWorker: false,
      disableIdleWorker: false,
      idlePeriod: 10,
      miningCooldown: 0.05,
    },
    meta: defaultMeta,
    name: "devnet",
  } satisfies DevNetworkConfig;
  
  // Validate container and mining configs if provided
  if (overrides?.containerConfig) {
    validateDevNetContainerConfig(overrides.containerConfig);
  }
  if (overrides?.miningConfig) {
    validateDevNetMiningConfig(overrides.miningConfig);
  }
  
  // Merge with overrides
  const config = defu(overrides ?? {}, defaults) as DevNetworkConfig;
  
  // Skip validation during build/test to avoid circular dependencies
  // Validation will be done when the config is actually used
  if (process.env["NODE_ENV"] !== 'test' && typeof globalThis !== 'undefined' && !(globalThis as any).__vitest__) {
    validateNetworkConfig(config);
  }
  
  return config;
}

/**
 * Create a Chainweb network configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete Chainweb network configuration
 * @throws {ConfigValidationError} If configuration is invalid
 * @example
 * ```typescript
 * const config = createChainwebNetworkConfig({
 *   networkId: 'testnet04',
 *   rpcUrl: 'https://api.testnet.chainweb.com/...'
 * });
 * ```
 */
export function createChainwebNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  if (!overrides?.networkId) {
    throw new Error("networkId is required for Chainweb networks. Use createTestNetNetworkConfig() or createMainNetNetworkConfig() for pre-configured networks.");
  }
  
  const defaults = {
    type: "chainweb" as const,
    rpcUrl: createChainwebRpcUrl({
      host: "https://api.chainweb.com",
    }),
    networkId: "",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
    name: overrides.networkId,
  } as ChainwebNetworkConfig;

  // Merge with overrides
  const config = defu(overrides, defaults) as ChainwebNetworkConfig;
  
  // Skip validation during build/test to avoid circular dependencies
  // Validation will be done when the config is actually used
  if (process.env["NODE_ENV"] !== 'test' && typeof globalThis !== 'undefined' && !(globalThis as any).__vitest__) {
    validateNetworkConfig(config);
  }
  
  return config;
}
/**
 * Create a TestNet network configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete TestNet network configuration
 * @throws {ConfigValidationError} If configuration is invalid
 */
export function createTestNetNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  const defaults = {
    type: "chainweb" as const,
    rpcUrl: DEFAULT_TESTNET_RPC_URL,
    networkId: "testnet04",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
    name: "testnet",
  } satisfies ChainwebNetworkConfig;

  // Merge with overrides
  const config = defu(overrides ?? {}, defaults) as ChainwebNetworkConfig;
  
  // Skip validation during build/test to avoid circular dependencies
  // Validation will be done when the config is actually used
  if (process.env["NODE_ENV"] !== 'test' && typeof globalThis !== 'undefined' && !(globalThis as any).__vitest__) {
    validateNetworkConfig(config);
  }
  
  return config;
}

/**
 * Create a MainNet network configuration with defaults
 * @param overrides - Configuration overrides
 * @returns Complete MainNet network configuration
 * @throws {ConfigValidationError} If configuration is invalid
 */
export function createMainNetNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  const defaults = {
    type: "chainweb" as const,
    rpcUrl: createChainwebRpcUrl({
      host: "https://mainnet.chainweb.com",
    }),
    networkId: "mainnet01",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
    name: "mainnet",
  } satisfies ChainwebNetworkConfig;

  // Merge with overrides
  const config = defu(overrides ?? {}, defaults) as ChainwebNetworkConfig;
  
  // Skip validation during build/test to avoid circular dependencies
  // Validation will be done when the config is actually used
  if (process.env["NODE_ENV"] !== 'test' && typeof globalThis !== 'undefined' && !(globalThis as any).__vitest__) {
    validateNetworkConfig(config);
  }
  
  return config;
}
