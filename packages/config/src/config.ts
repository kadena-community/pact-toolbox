import type { CommonNetworkConfig, StandardPrelude } from "@pact-toolbox/types";
import { loadConfig } from "c12";

import { defaultConfig } from "./defaults";

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
export interface DevNetworkConfig extends CommonNetworkConfig, LocalNetworkCommonConfig {
  type: "chainweb-devnet";
  containerConfig?: DevNetContainerConfig;
  miningConfig?: DevNetMiningConfig;
}

export interface LocalNetworkCommonConfig {
  autoStart?: boolean;
}

export interface PactServerNetworkConfig extends CommonNetworkConfig, LocalNetworkCommonConfig {
  type: "pact-server";
  serverConfig?: PactServerConfig;
  pactBin?: string;
}

export interface ChainwebNetworkConfig extends CommonNetworkConfig {
  type: "chainweb";
}

export type NetworkConfig = DevNetworkConfig | PactServerNetworkConfig | ChainwebNetworkConfig;

export type NetworkConfigType = NetworkConfig["type"];

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

export interface DevNetContainerConfig {
  port?: number;
  persistDb?: boolean;
  onDemandMining?: boolean;
  constantDelayBlockTime?: number;
}

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

export interface PactToolboxConfigObj<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>> {
  defaultNetwork: keyof T;
  networks: T;
  contractsDir?: string;
  scriptsDir?: string;
  pactVersion?: string;
  preludes?: StandardPrelude[];
  downloadPreludes?: boolean;
  deployPreludes?: boolean;
}

export type PactToolboxConfig<T extends Record<string, NetworkConfig> = {}> =
  | (Partial<PactToolboxConfigObj<T>> & PactToolboxConfigEnvOverrides<T>)
  | ((network: string) => Partial<PactToolboxConfigObj<T>> & PactToolboxConfigEnvOverrides<T>);

let __CONFIG__: Required<PactToolboxConfigObj> | undefined = undefined;
function dedupeArrays(obj: Record<string, any>) {
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // remove duplicates from arrays
      obj[key] = value.filter((v, i, a) => a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i);
    } else if (typeof value === "object") {
      dedupeArrays(value);
    }
  }
}
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

export function defineConfig<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>>(
  config: PactToolboxConfig<T>,
): PactToolboxConfig<T> {
  return config;
}
