import { ChainId, IKeyPair } from '@kadena/types';
import { loadConfig } from 'c12';
import type { PactToolboxClient } from './client';
import { defaultConfig } from './defaults';

export interface KeysetConfig {
  keys: string[];
  pred: 'keys-all' | 'keys-any' | 'keys-2' | '=';
}

export interface GetRpcUrlParams {
  chainId?: string;
  networkId?: string;
  port?: string | number;
}

export interface Signer extends IKeyPair {
  account: string | `k:${string}`;
}

export interface CommonNetworkConfig {
  rpcUrl: string | ((params: GetRpcUrlParams) => string);
  name?: string;
  senderAccount: string;
  signers: Signer[];
  keysets: Record<string, KeysetConfig>;
  gasLimit?: number;
  gasPrice?: number;
  chainId?: ChainId;
  networkId: string;
  ttl?: number;
}
export interface DevNetworkConfig extends CommonNetworkConfig {
  type: 'chainweb-devnet';
  autoStart?: boolean;
  onDemandMining?: boolean;
  containerConfig?: DevNetContainerConfig;
}

export interface PactServerNetworkConfig extends CommonNetworkConfig {
  type: 'pact-server';
  autoStart?: boolean;
  serverConfig?: PactServerConfig;
}

export interface ChainwebNetworkConfig extends CommonNetworkConfig {
  type: 'chainweb';
}

export type NetworkConfig = DevNetworkConfig | PactServerNetworkConfig | ChainwebNetworkConfig;

export type PactExecConfigFlags =
  | 'AllowReadInLocal'
  | 'DisableHistoryInTransactionalMode'
  | 'DisableInlineMemCheck'
  | 'DisableModuleInstall'
  | 'DisableNewTrans'
  | 'DisablePact40'
  | 'DisablePact420'
  | 'DisablePact43'
  | 'DisablePact431'
  | 'DisablePact44'
  | 'DisablePact45'
  | 'DisablePact46'
  | 'DisablePact47'
  | 'DisablePact48'
  | 'DisablePact49'
  | 'DisablePactEvents'
  | 'DisableRuntimeReturnTypeChecking'
  | 'EnforceKeyFormats'
  | 'OldReadOnlyBehavior'
  | 'PreserveModuleIfacesBug'
  | 'PreserveModuleNameBug'
  | 'PreserveNsModuleInstallBug'
  | 'PreserveShowDefs';
export interface PactServerConfig {
  /**
   * HTTP server port
   */
  port?: string | number;
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
  port?: string | number;
  volume?: string;
  name?: string;
  image?: string;
  tag?: string;
}
export interface PactConfig {
  contractsDir?: string;
  version?: string;
  preludes?: ('kadena/chainweb' | 'kadena/marmalade-v2' | PactPrelude)[];
  downloadPreludes?: boolean;
  deployPreludes?: boolean;
}

export interface PactToolboxConfigObj<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>> {
  defaultNetwork: keyof T;
  networks: T;
  pact: PactConfig;
}

export interface PactDependency {
  name: string;
  uri: string;
  group?: string;
  requires?: PactDependency[];
}
export type PactPreludeSpecs = Record<string, PactDependency[]>;
export interface PactPrelude {
  name: string;
  specs: PactDependency[] | PactPreludeSpecs;

  /**
   * decides if prelude should be deployed to configured networks
   * useful to avoid re-deploying preludes that are already deployed eg. kadena/chainweb on devnet, testnet, mainnet
   */
  shouldDeploy: (client: PactToolboxClient) => Promise<boolean>;

  /**
   * deploy script fro local server
   */
  deploy(client: PactToolboxClient): Promise<void>;
  /**
   * pact repl install script
   */
  repl(client: PactToolboxClient): Promise<string>;
}
export type PactToolboxConfig<T extends Record<string, NetworkConfig> = {}> =
  | Partial<PactToolboxConfigObj<T>>
  | ((network: string) => Partial<PactToolboxConfigObj<T>>);

export async function resolveConfig(overrides?: Partial<PactToolboxConfigObj>) {
  const configResult = await loadConfig<PactToolboxConfigObj>({
    name: 'pact-toolbox',
    overrides: overrides as PactToolboxConfigObj,
    defaultConfig: defaultConfig as PactToolboxConfigObj,
  });
  return configResult.config as PactToolboxConfigObj;
}

export function defineConfig<T extends Record<string, NetworkConfig> = Record<string, NetworkConfig>>(
  config: PactToolboxConfig<T>,
) {
  return config;
}
export function isPactServerNetworkConfig(config: NetworkConfig): config is PactServerNetworkConfig {
  return config?.type === 'pact-server';
}

export function isDevNetworkConfig(config: NetworkConfig): config is DevNetworkConfig {
  return config?.type === 'chainweb-devnet';
}

export function isChainwebNetworkConfig(config: NetworkConfig): config is ChainwebNetworkConfig {
  return config?.type === 'chainweb';
}
