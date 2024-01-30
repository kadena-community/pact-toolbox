import { createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } from '.';

export default defineConfig({
  defaultNetwork: 'devnet',
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
      },
    }),
    devnet: createDevNetNetworkConfig({
      containerConfig: {
        image: 'salamaashoush/kdevnet',
        tag: 'minimal',
        name: 'devnet-minimal',
      },
    }),
  },
});
