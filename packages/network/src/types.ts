import type { PactToolboxClient } from "@pact-toolbox/runtime";
import type { ContainerConfig } from "@pact-toolbox/container-orchestrator";

export type ConflictStrategy = "error" | "replace" | "ignore";

export interface ToolboxNetworkStartOptions {
  isDetached?: boolean;
  isStateless?: boolean;
  conflictStrategy?: ConflictStrategy;
  client?: PactToolboxClient;
}
export interface ToolboxNetworkApi {
  stop: () => Promise<void>;
  start: (options?: ToolboxNetworkStartOptions) => Promise<void>;
  restart: (options?: ToolboxNetworkStartOptions) => Promise<void>;
  isOk: () => Promise<boolean>;
  getServicePort: () => number;
  hasOnDemandMining: () => boolean;
  getMiningClientUrl: () => string;
  getNodeServiceUrl: () => string;
  id: number | string;
}

export interface DevNetServiceDefinition {
  networkName: string;
  clusterId: string;
  volumes: string[];
  services: {
    bootstrapNode: ContainerConfig;
    miningClient: ContainerConfig;
    apiProxy: ContainerConfig;
    miningTrigger: ContainerConfig;
    [key: string]: ContainerConfig;
  };
}
