import {
  createChainwebLocalNetworkConfig,
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  defineConfig,
} from 'pact-toolbox';

const onDemandImage = {
  image: 'kadena/devnet',
  tag: 'on-demand-minimal',
  name: 'devnet-on-demand',
};

const onDemandImageSalama = {
  image: 'salamaashoush/kdevnet',
  tag: 'on-demand',
  name: 'devnet-on-demand',
};
const minimalImage = {
  image: 'salamaashoush/kdevnet',
  tag: 'minimal',
  name: 'devnet-minimal',
};

const isCI = process.env.CI === 'true';
export default defineConfig({
  defaultNetwork: 'local',
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
      },
    }),
    localChainweb: createChainwebLocalNetworkConfig({}),
    devnet: createDevNetNetworkConfig({
      containerConfig: minimalImage,
      onDemandMining: false,
    }),
    devnetOnDemand: createDevNetNetworkConfig({
      containerConfig: onDemandImageSalama,
      onDemandMining: true,
    }),
  },
});
