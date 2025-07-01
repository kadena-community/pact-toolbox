import type { PactDeployer } from "@pact-toolbox/deployer";

/**
 * Interface representing cached transformation data.
 */
export interface CachedTransform {
  code: string;
  types: string;
  src: string;
  isDeployed: boolean;
}

export interface PluginOptions {
  onReady?: (deployer: PactDeployer) => Promise<void>;
  startNetwork?: boolean;
  deployer?: PactDeployer;
  cacheSize?: number;
}
