import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    // Main entry
    index: "src/index.ts",

    // Individual wallet providers as separate entries
    ecko: "src/providers/ecko/index.ts",
    chainweaver: "src/providers/chainweaver/index.ts",
    zelcore: "src/providers/zelcore/index.ts",
    walletconnect: "src/providers/walletconnect/index.ts",
    keypair: "src/providers/keypair/index.ts",
    magic: "src/providers/magic/index.ts",
  },

  format: ["esm", "cjs"],
  platform: "neutral",
  clean: true,

  dts: true,

  external: [
    "@pact-toolbox/types",
    "@pact-toolbox/signers",
    "@pact-toolbox/crypto",
    "@walletconnect/modal",
    "@walletconnect/sign-client",
    "@walletconnect/utils",
    "@walletconnect/types",
    "magic-sdk",
  ],

  // Output structure will be:
  // dist/index.js (main export)
  // dist/ecko.js (@pact-toolbox/wallet/ecko)
  // dist/chainweaver.js (@pact-toolbox/wallet/chainweaver)
  // dist/zelcore.js (@pact-toolbox/wallet/zelcore)
  // dist/walletconnect.js (@pact-toolbox/wallet/walletconnect)
  // dist/keypair.js (@pact-toolbox/wallet/keypair)
  // dist/magic.js (@pact-toolbox/wallet/magic)
});
