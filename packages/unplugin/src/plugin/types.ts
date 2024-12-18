import type { PactToolboxClient } from "@pact-toolbox/runtime";

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
  onReady?: (runtime: PactToolboxClient) => Promise<void>;
  startNetwork?: boolean;
  client?: PactToolboxClient;
}
