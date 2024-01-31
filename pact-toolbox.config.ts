import { createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } from '.';

export default defineConfig({
  defaultNetwork: 'local',
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
      },
    }),
    devnet: createDevNetNetworkConfig({
      containerConfig: {
        image: 'kadena/devnet',
        tag: 'minimal',
        name: 'devnet-minimal',
      },
    }),
  },
});
