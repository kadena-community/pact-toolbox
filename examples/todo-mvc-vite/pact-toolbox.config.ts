import {
  createDevNetNetworkConfig,
  createMainNetNetworkConfig,
  createPactServerNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from "pact-toolbox";

export default defineConfig({
  defaultNetwork: "pactServer",
  preludes: ["kadena/chainweb"],
  downloadPreludes: true,
  deployPreludes: true,
  networks: {
    pactServer: createPactServerNetworkConfig(),
    devnet: createDevNetNetworkConfig(),
    testnet: createTestNetNetworkConfig(),
    mainnet: createMainNetNetworkConfig(),
  },
});
