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
    "@pact-toolbox/types",
    "@pact-toolbox/wallet-core"
  ],
});