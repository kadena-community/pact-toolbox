import type { PactToolboxRuntime } from '@pact-toolbox/runtime';

export interface Options {
  onReady?: (runtime: PactToolboxRuntime) => Promise<void>;
  startNetwork?: boolean;
}
