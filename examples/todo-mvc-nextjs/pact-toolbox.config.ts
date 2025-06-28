import { defineConfig } from "@pact-toolbox/config";

export default defineConfig({
  defaultNetwork: "pactServer",
  deployPreludes: true,
  networks: {
    mainnet: {
      networkId: "mainnet01",
      kadenaAPI: "https://api.chainweb.com",
    },
    testnet: {
      networkId: "testnet04",
      kadenaAPI: "https://api.testnet.chainweb.com",
    },
  },
});