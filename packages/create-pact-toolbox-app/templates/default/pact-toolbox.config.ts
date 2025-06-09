import {
  createDevNetNetworkConfig,
  createMainNetNetworkConfig,
  createPactServerNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from "pact-toolbox";

export default defineConfig({
  defaultNetwork: "pactServer",
  deployPreludes: true,
  networks: {
    pactServer: createPactServerNetworkConfig(),
    devnet: createDevNetNetworkConfig(),
    testnet: createTestNetNetworkConfig(),
    mainnet: createMainNetNetworkConfig(),
  },
});
