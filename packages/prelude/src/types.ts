import type { PactToolboxRuntime } from '@pact-toolbox/runtime';

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
  shouldDeploy: (client: PactToolboxRuntime) => Promise<boolean>;

  /**
   * deploy script fro local server
   */
  deploy(client: PactToolboxRuntime): Promise<void>;
  /**
   * pact repl install script
   */
  repl(client: PactToolboxRuntime): Promise<string>;
}

export interface CommonPreludeOptions {
  contractsDir: string;
  preludes: (PactPrelude | string)[];
  runtime: PactToolboxRuntime;
}
