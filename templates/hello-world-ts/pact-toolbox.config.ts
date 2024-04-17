import {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createMainNetNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
  minimalDevNetContainer,
} from 'pact-toolbox';

export default defineConfig({
  defaultNetwork: 'local',
  networks: {
    local: createLocalNetworkConfig(),
    devnet: createDevNetNetworkConfig(),
    devnetOnDemand: createDevNetNetworkConfig({
      containerConfig: minimalDevNetContainer,
      miningConfig: {
        batchPeriod: 0.05,
      },
    }),
    testnet: createTestNetNetworkConfig(),
    mainnet: createMainNetNetworkConfig(),
  },
});
