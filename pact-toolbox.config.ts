import {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
  minimalDevNetContainer,
} from 'pact-toolbox';

export default defineConfig({
  defaultNetwork: 'local',
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
