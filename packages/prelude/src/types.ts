import type { PactDeployer } from "@pact-toolbox/deployer";
import type { PactCapability } from "@pact-toolbox/types";
import type { DeploymentCondition } from "./utils";

// Core prelude definition system
export interface RepositoryConfig {
  provider: "github" | "gitlab" | "bitbucket";
  org: string;
  repo: string;
  branch?: string;
  basePath?: string;
}

export interface FileSpec {
  /** Local filename */
  name: string;
  /** Path within the repository (optional if same as name) */
  path?: string;
  /** Expected checksum for verification */
  checksum?: string;
  /** Version tag for compatibility */
  version?: string;
}

export interface NamespaceConfig {
  name: string;
  /** Keysets required for this namespace */
  keysets: string[];
  /** Whether this namespace should be created during deployment */
  create?: boolean;
}

export interface DeploymentGroup {
  /** Group identifier */
  name: string;
  /** Target namespace for deployment */
  namespace?: string;
  /** Files to deploy in this group */
  files: FileSpec[];
  /** Groups that must be deployed before this one */
  dependsOn?: string[];
  /** Whether this group is optional */
  optional?: boolean;
  /** Condition function to determine if deployment is needed */
  shouldDeploy?: (deployer: PactDeployer) => Promise<boolean>;
  /** keysets templates */
  keysetTemplates?: KeysetTemplate[];
  /** capabilities or capability templates */
  capabilities?: PactCapability[];
}

export interface KeysetTemplate {
  /** Template name */
  name: string;
  /** Keys placeholder (filled at deployment time) */
  keys: "admin" | "user" | "operator" | string[];
  /** Predicate function */
  pred: "keys-all" | "keys-any" | "keys-2" | string;
}

export interface PreludeDefinition {
  /** Unique prelude identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this prelude provides */
  description: string;
  /** Version of this prelude definition */
  version: string;

  /** Repository configuration */
  repository: RepositoryConfig;

  /** Required preludes that must be deployed first */
  dependencies?: string[];

  /** Namespaces used by this prelude */
  namespaces?: NamespaceConfig[];

  /** Reusable keyset templates */
  keysetTemplates?: KeysetTemplate[];

  /** Deployment groups in dependency order */
  deploymentGroups: DeploymentGroup[];

  /** Global deployment conditions */
  deploymentConditions?: DeploymentCondition;

  /** REPL initialization script template */
  replTemplate?: string;

  /** Custom deployment hooks */
  hooks?: {
    beforeDeploy?: (deployer: PactDeployer) => Promise<void>;
    afterDeploy?: (deployer: PactDeployer) => Promise<void>;
    onError?: (deployer: PactDeployer, error: Error) => Promise<void>;
  };
}

export interface CommonPreludeOptions {
  contractsDir: string;
  preludes?: (PreludeDefinition | string)[];
  deployer: PactDeployer;
}

// Internal dependency type for backward compatibility with download system
export interface PactDependency {
  name: string;
  uri: string;
  group?: string;
  requires?: PactDependency[];
  checksum?: string;
  version?: string;
}
