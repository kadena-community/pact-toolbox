import {
  createDevNetNetworkConfig,
  createMainNetNetworkConfig,
  createPactServerNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from "pact-toolbox";

export default defineConfig({
  defaultNetwork: "devnet",
  deployPreludes: true,
  networks: {
    pactServer: createPactServerNetworkConfig(),
    devnet: createDevNetNetworkConfig(),
    testnet: createTestNetNetworkConfig(),
    mainnet: createMainNetNetworkConfig(),
  },
});
