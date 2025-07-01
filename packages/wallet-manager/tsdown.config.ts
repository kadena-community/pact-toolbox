import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },

  format: ["esm", "cjs"],
  platform: "neutral",
  clean: true,

  dts: true,

  external: [
    "@pact-toolbox/crypto",
    "@pact-toolbox/dev-wallet",
    "@pact-toolbox/signers",
    "@pact-toolbox/types",
    "@pact-toolbox/utils",
    "@pact-toolbox/wallet-core",
    "@pact-toolbox/wallet-ui",
    "@pact-toolbox/ui-shared",
    "solid-js",
    "solid-js/web",
  ],
});
