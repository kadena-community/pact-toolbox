import { createChainwebRpcUrl, createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } from 'pact-toolbox';

export default defineConfig({
  defaultNetwork: 'local',
  pact: {
    contractsDir: 'pact',
  },
  networks: {
    local: createLocalNetworkConfig({
      serverConfig: {
        port: 9001,
        persistDir: '.pact-toolbox/pact-state',
      },
    }),
    devnet: createDevNetNetworkConfig({
      containerConfig: {
        image: 'kadena/devnet',
        tag: 'latest',
        name: 'devnet',
      },
    }),
    kdevnet1: createDevNetNetworkConfig({
      autoStart: false,
      rpcUrl: createChainwebRpcUrl({
        host: 'https://kdevnet1.salamaashoush.com',
      }),
    }),
  },
});
