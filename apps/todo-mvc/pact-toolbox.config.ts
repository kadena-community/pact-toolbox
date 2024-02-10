import {
  createChainwebLocalNetworkConfig,
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from 'pact-toolbox';

const onDemandImage = {
  image: 'kadena/devnet',
  tag: 'on-demand-minimal',
  name: 'devnet-on-demand',
};

const defaultImage = {
  image: 'kadena/devnet',
  tag: 'latest',
  name: 'devnet',
};
export default defineConfig({
  defaultNetwork: 'local',
  pact: {
    contractsDir: 'pact',
  },
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
        // persistDir: '.pact-toolbox/pact-state',
      },
    }),
    devnet: createDevNetNetworkConfig({
      containerConfig: onDemandImage,
      onDemandMining: true,
    }),
    chainwebLocal: createChainwebLocalNetworkConfig({}),
    kdevnet1: createTestNetNetworkConfig({}),
  },
});
