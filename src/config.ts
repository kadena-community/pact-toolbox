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
}

export interface Signer extends IKeyPair {
  address: string;
}

export interface Network {
  rpcUrl: string | ((params: GetRpcUrlParams) => string);
  senderAccount: string;
  signers: Signer[];
  keysets: Record<string, KeysetConfig>;
  gasLimit?: number;
  gasPrice?: number;
  chainId: ChainId;
  networkId: string;
  ttl?: number;
}

export interface NetworkConfig extends Required<Network> {
  name: string;
}
type PactExecConfigFlags =
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

export interface PactConfig {
  contractsDir?: string;
  version?: string;
  preludes?: ('kadena/chainweb' | 'kadena/marmalade-v2' | PactPrelude)[];
  downloadPreludes?: boolean;
  deployPreludes?: boolean;
  server?: PactServerConfig;
}

export interface PactToolboxConfigObj {
  defaultNetwork?: string;
  networks?: Record<string, Network>;
  pact?: PactConfig;
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
export type PactToolboxConfig = PactToolboxConfigObj | ((network: string) => PactToolboxConfigObj);

export async function resolveConfig(overrides?: PactToolboxConfig) {
  const configResult = await loadConfig<PactToolboxConfig>({
    name: 'pact-toolbox',
    defaults: defaultConfig,
    overrides,
  });
  return configResult.config as Required<PactToolboxConfigObj>;
}

export function defineConfig<T>(config: PactToolboxConfig) {
  return config;
}
