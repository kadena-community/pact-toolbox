import type { PactToolboxClient } from '@pact-toolbox/runtime';

export interface Options {
  onReady?: (runtime: PactToolboxClient) => Promise<void>;
  startNetwork?: boolean;
}
