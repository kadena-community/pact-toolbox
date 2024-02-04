import { createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } from '.';

const onDemandImage = {
  image: 'salamaashoush/kdevnet',
  tag: 'on-demand',
  name: 'devnet-on-demand',
};
const minimalImage = {
  image: 'salamaashoush/kdevnet',
  tag: 'minimal',
  name: 'devnet-minimal',
};

const onDemandMining = true;
export default defineConfig({
  defaultNetwork: 'devnet',
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
      },
    }),
    devnet: createDevNetNetworkConfig({
      containerConfig: onDemandMining ? onDemandImage : minimalImage,
      onDemandMining,
    }),
  },
});
