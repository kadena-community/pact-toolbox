import {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
  minimalDevNetContainer,
} from 'pact-toolbox';

console.log('Using root pact-toolbox.config.ts');
export default defineConfig({
  defaultNetwork: 'devnetOnDemand',
  networks: {
    local: createLocalNetworkConfig(),
    devnetOnDemand: createDevNetNetworkConfig({
      containerConfig: minimalDevNetContainer,
      miningConfig: {
        batchPeriod: 0.05,
      },
    }),
    devnet: createDevNetNetworkConfig(),
    test: createTestNetNetworkConfig(),
  },
});
