import type { CommonNetworkConfig, StandardPrelude } from "@pact-toolbox/types";

import { loadConfig } from "c12";

import { defaultConfig } from "./defaults";

/**
 * Configuration for DevNet mining behavior
 */
export interface DevNetMiningConfig {
  /**
   * Wait for this period, in seconds, after receiving a transaction and then mine blocks on the chain where the transaction was received. This period is used to batch transactions and avoid mining a block for each transaction. Increasing this period also makes mining more realistic compared to the public networks
   * @default 0.05
   */
  transactionBatchPeriod?: number;
  /**
   * The number of blocks to mine faster after transactions; This makes it quicker to get a transaction confirmed.
   * @default 5
   */
  confirmationCount?: number;
  /**
   * The period, in seconds, to wait after minting the confirmation blocks of transactions
   * @default 5.0
   */
  confirmationPeriod?: number;
  /**
   * Disable quick mining for confirming transactions. Note that if you want to mint the blocks containing transactions only and no further confirmations, don’t disable this option and use MINING_CONFIRMATION_COUNT=1 instead.
   * @default false
   */
  disableConfirmationWorker?: boolean;
  /**
   * Disable periodic mining when the network is idle. Note that this is NOT RECOMMENDED for most cases, since in the absence of mining, the node’s current time will lag behind and transactions will not be accepted. Consider increasing MINING_IDLE_PERIOD instead.
   * @default false
   */
  disableIdleWorker?: boolean;
  /**
   * The average time, in seconds, it takes to mine blocks and advance the block height by one while the network is idle (i.e. no incoming transactions)
   * @default 10
   */
  idlePeriod?: number;
  /**
   * The average time, in seconds, it takes to mine blocks and advance the block height by one while the network is idle (i.e. no incoming transactions)
   * @default 0.05
   */
  miningCooldown?: number;
}

/**
 * Configuration for Chainweb DevNet network (containerized local development)
 */
export interface DevNetworkConfig extends CommonNetworkConfig, LocalNetworkCommonConfig {
  type: "chainweb-devnet";
  containerConfig?: DevNetContainerConfig;
  miningConfig?: DevNetMiningConfig;
}

/**
 * Common configuration for local networks (Pact Server and DevNet)
 */
export interface LocalNetworkCommonConfig {
  /**
   * Whether to automatically start the network when needed
   * @default true
   */
  autoStart?: boolean;
}

/**
 * Configuration for Pact Server network (simple local development)
 */
export interface PactServerNetworkConfig extends CommonNetworkConfig, LocalNetworkCommonConfig {
  type: "pact-server";
  serverConfig?: PactServerConfig;
  /**
   * Path to the Pact binary (defaults to system Pact)
   */
  pactBin?: string;
  /**
   * Timeout in milliseconds for shutting down the server
   * @default 5000
   */
  shutdownTimeout?: number;
}

/**
 * Configuration for Chainweb network (testnet/mainnet)
 */
export interface ChainwebNetworkConfig extends CommonNetworkConfig {
  type: "chainweb";
}

/**
 * Union type for all network configurations
 */
export type NetworkConfig = DevNetworkConfig | PactServerNetworkConfig | ChainwebNetworkConfig;

/**
 * Network configuration type discriminator
 */
export type NetworkConfigType = NetworkConfig["type"];

/**
 * Pact runtime execution flags for controlling language features
 */
export type PactExecConfigFlags =
  | "AllowReadInLocal"
  | "DisableHistoryInTransactionalMode"
  | "DisableInlineMemCheck"
  | "DisableModuleInstall"
  | "DisableNewTrans"
  | "DisablePact40"
  | "DisablePact420"
  | "DisablePact43"
  | "DisablePact431"
  | "DisablePact44"
  | "DisablePact45"
  | "DisablePact46"
  | "DisablePact47"
  | "DisablePact48"
  | "DisablePact49"
  | "DisablePactEvents"
  | "DisableRuntimeReturnTypeChecking"
  | "EnforceKeyFormats"
  | "OldReadOnlyBehavior"
  | "PreserveModuleIfacesBug"
  | "PreserveModuleNameBug"
  | "PreserveNsModuleInstallBug"
  | "PreserveShowDefs";

/**
 * Configuration options for Pact Server
 */
export interface PactServerConfig {
  /**
   * HTTP server port
   */
  port?: number;
  /**
   * Directory for HTTP logs
   */
  logDir?: string;
  /**
   * Directory for database files. If ommitted, runs in-memory only.
   */
  persistDir?: string;
  /**
   * SQLite pragmas to use with persistence DBs
   */
  pragmas?: string[];
  /**
   * verbosity of logging
   */
  verbose?: boolean;
  /**
   * Entity name for simulating privacy, defaults to "entity"
   */
  entity?: string;

  /**
   * Pact runtime execution flags
   */
  execConfig?: (PactExecConfigFlags | (string & {}))[];
  /**
   * Gas limit for each transaction, defaults to 0
   */
  gasLimit?: number;
  /**
   * Gas price per action, defaults to 0
   */
  gasRate?: number;
}

/**
 * Configuration for DevNet Docker container
 */
export interface DevNetContainerConfig {
  /**
   * Port to expose the DevNet on
   * @default 8080
   */
  port?: number;
  /**
   * Whether to persist the database between restarts
   * @default true
   */
  persistDb?: boolean;
  /**
   * Enable on-demand mining (mine only when transactions are received)
   * @default false
   */
  onDemandMining?: boolean;
  /**
   * Constant delay in seconds between blocks (overrides other mining config)
   */
  constantDelayBlockTime?: number;
}

/**
 * Environment-specific configuration overrides
 */
export interface PactToolboxConfigEnvOverrides<
  T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>,
> {
  extends?: string | string[];
  // environment specific configurations
  $test?: Partial<PactToolboxConfigObj<T>>;
  $development?: Partial<PactToolboxConfigObj<T>>;
  $production?: Partial<PactToolboxConfigObj<T>>;
  $env?: { [key: string]: Partial<PactToolboxConfigObj<T>> };
}

/**
 * Main configuration object for pact-toolbox
 */
export interface PactToolboxConfigObj<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>> {
  defaultNetwork: keyof T;
  networks: T;
  contractsDir?: string;
  scriptsDir?: string;
  pactVersion?: string;
  preludes?: (StandardPrelude | (string & {}))[];
  downloadPreludes?: boolean;
  deployPreludes?: boolean;
}

/**
 * Configuration type that can be either static or dynamic (function)
 */
export type PactToolboxConfig<T extends Record<string, NetworkConfig> = {}> =
  | (Partial<PactToolboxConfigObj<T>> & PactToolboxConfigEnvOverrides<T>)
  | ((network: string) => Partial<PactToolboxConfigObj<T>> & PactToolboxConfigEnvOverrides<T>);

let __CONFIG__: Required<PactToolboxConfigObj> | undefined = undefined;
let __CONFIG_HASH__: string | undefined = undefined;

/**
 * Remove duplicate values from arrays in an object recursively
 * @internal
 */
function dedupeArrays(obj: Record<string, any>) {
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // remove duplicates from arrays
      obj[key] = value.filter((v, i, a) => a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i);
    } else if (typeof value === "object" && value !== null) {
      dedupeArrays(value);
    }
  }
}

/**
 * Clear the cached configuration
 * Useful for testing or when configuration changes at runtime
 */
export function clearConfigCache(): void {
  __CONFIG__ = undefined;
  __CONFIG_HASH__ = undefined;
}
/**
 * Resolves configuration from all sources (env, config files, defaults)
 * Caches the result for subsequent calls
 * @param overrides - Configuration overrides to apply
 * @returns Resolved configuration with all required fields
 */
export async function resolveConfig(
  overrides?: Partial<PactToolboxConfigObj>,
): Promise<Required<PactToolboxConfigObj>> {
  if (__CONFIG__) {
    return __CONFIG__;
  }
  const configResult = await loadConfig<PactToolboxConfigObj>({
    name: "pact-toolbox",
    overrides: overrides as PactToolboxConfigObj,
    defaults: defaultConfig as PactToolboxConfigObj,
    dotenv: true,
    packageJson: true,
  });

  configResult.config.networks = configResult.config.networks || {};
  for (const [network, networkConfig] of Object.entries(configResult.config.networks)) {
    configResult.config.networks[network] = networkConfig;
    dedupeArrays(networkConfig);
  }
  __CONFIG__ = configResult.config as Required<PactToolboxConfigObj>;
  return __CONFIG__;
}

/**
 * Helper function for defining configuration with TypeScript support
 * @param config - Configuration object or function
 * @returns The same configuration for type inference
 * @example
 * ```typescript
 * export default defineConfig({
 *   defaultNetwork: 'devnet',
 *   networks: {
 *     devnet: createDevNetNetworkConfig({})
 *   }
 * });
 * ```
 */
export function defineConfig<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>>(
  config: PactToolboxConfig<T>,
): PactToolboxConfig<T> {
  return config;
}
