import { PactToolboxConfigObj, resolveConfig } from '@pact-toolbox/config';
import { PactToolboxRuntime } from './runtime';

export async function createPactRuntime(config?: PactToolboxConfigObj) {
  if (!config && process.env.__PACT_TOOLBOX_CONFIG__) {
    config = JSON.parse(process.env.__PACT_TOOLBOX_CONFIG__);
  }

  if (!config) {
    config = await resolveConfig();
  }

  return new PactToolboxRuntime(config);
}
