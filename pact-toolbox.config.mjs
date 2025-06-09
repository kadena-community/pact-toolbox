import {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createMainNetNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from "pact-toolbox";

export default defineConfig({
  defaultNetwork: "local",
  deployPreludes: true,
  networks: {
    local: createLocalNetworkConfig({
      // pactBin: '/home/salama/Workspace/Kadena/pact-5/result/bin/pact',
    }),
    devnet: createDevNetNetworkConfig(),
    test: createTestNetNetworkConfig(),
    main: createMainNetNetworkConfig(),
  },
});
