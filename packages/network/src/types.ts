import type { PactToolboxClient } from "@pact-toolbox/runtime";
import type { DockerServiceConfig } from "@pact-toolbox/utils";

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
    bootstrapNode: DockerServiceConfig;
    miningClient: DockerServiceConfig;
    apiProxy: DockerServiceConfig;
    miningTrigger: DockerServiceConfig;
    [key: string]: DockerServiceConfig;
  };
}
