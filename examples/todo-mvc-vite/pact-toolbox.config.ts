import {
  createDevNetNetworkConfig,
  createLocalChainwebNetworkConfig,
  createLocalNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from 'pact-toolbox';

const minimal = {
  image: 'kadena/devnet',
  tag: 'minimal',
  name: 'devnet-minimal',
  port: 8080,
};

const onDemandImageSalama = {
  image: 'salamaashoush/kdevnet',
  tag: 'on-demand',
  name: 'devnet-on-demand',
};

export default defineConfig({
  defaultNetwork: 'devnet',
  // preludes: ['kadena/marmalade'],
  networks: {
    local: createLocalNetworkConfig(),
    localChainweb: createLocalChainwebNetworkConfig(),
    devnet: createDevNetNetworkConfig({
      containerConfig: minimal,
      miningConfig: {
        batchPeriod: 0.05,
      },
    }),
    devnetOnDemand: createDevNetNetworkConfig({
      containerConfig: onDemandImageSalama,
      onDemandMining: true,
    }),
    test: createTestNetNetworkConfig(),
  },
});
