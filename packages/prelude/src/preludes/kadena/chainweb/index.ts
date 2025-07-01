import type { PreludeDefinition, PatchContext } from "../../../types";
import { repository, file, namespace, deploymentGroup, keysetTemplate, deploymentConditions } from "../../../utils";
import { createSimplePatch, createFunctionPatch, patchConditions } from "../../../patch-processor";

// Coin contract patches for development
const coinbaseCapabilityPatch = createSimplePatch("replace", {
  find: '(defcap COINBASE ()\n  "Magic capability to protect miner reward"\n  true)',
  replace: `(defcap COINBASE ()
  @doc "Magic capability to protect miner reward"
  (enforce-one
    "COINBASE requires miner or dev init"
    [(is-principal (read-msg 'miner))
     (= (read-msg 'dev-init "") "true")]))`,
  description: "Enable COINBASE for development initialization",
  condition: patchConditions.isPactServer,
});

const senderAccountsInitPatch = createFunctionPatch(
  async (code, context) => {
    // Only apply in pact-server
    if (context.client.getNetworkConfig().type !== "pact-server") {
      return code;
    }

    const senderAccountInit = `

; Development initialization for sender accounts
(if (= (read-msg 'dev-init "") "true")
  (let ()
    ; Create and fund sender00
    (coin.create-account "sender00"
      { "keys": ["368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender00"
        { "keys": ["368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender01
    (coin.create-account "sender01"
      { "keys": ["6be2f485a7af75fedb4b7f153a903f7e6000ca4aa501179c91a2450b777bd2a7"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender01"
        { "keys": ["6be2f485a7af75fedb4b7f153a903f7e6000ca4aa501179c91a2450b777bd2a7"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender02
    (coin.create-account "sender02"
      { "keys": ["3a9dd532d73dace195dbb64d1dba6572fb783d0fdd324685e32fbda2f89f99a6"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender02"
        { "keys": ["3a9dd532d73dace195dbb64d1dba6572fb783d0fdd324685e32fbda2f89f99a6"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender03
    (coin.create-account "sender03"
      { "keys": ["43f2adb1de192000cb3777bacc7f983b6614fd9c1715cd44cd484b6d3a0d34c8"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender03"
        { "keys": ["43f2adb1de192000cb3777bacc7f983b6614fd9c1715cd44cd484b6d3a0d34c8"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender04
    (coin.create-account "sender04"
      { "keys": ["2d70aa4f697c3a3b8dd6d97745ac074edcfd0eb65c37774cde25135483bea71e"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender04"
        { "keys": ["2d70aa4f697c3a3b8dd6d97745ac074edcfd0eb65c37774cde25135483bea71e"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender05
    (coin.create-account "sender05"
      { "keys": ["f09d8f6394aea425fe6783d88cd81363d8017f16afd3711c575be0f5cd5c9bb9"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender05"
        { "keys": ["f09d8f6394aea425fe6783d88cd81363d8017f16afd3711c575be0f5cd5c9bb9"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender06
    (coin.create-account "sender06"
      { "keys": ["5ffc1f7fef7a44738625762f75a4229454951e03f2afc6f81309c0c1bdf9ee6f"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender06"
        { "keys": ["5ffc1f7fef7a44738625762f75a4229454951e03f2afc6f81309c0c1bdf9ee6f"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender07
    (coin.create-account "sender07"
      { "keys": ["4c31dc9ee7f24177f78b6f518012a208326e2af1f37bb0a2405b5056d0cad628"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender07"
        { "keys": ["4c31dc9ee7f24177f78b6f518012a208326e2af1f37bb0a2405b5056d0cad628"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender08
    (coin.create-account "sender08"
      { "keys": ["63b2eba4ed70d4612d3e7bc90db2fbf4c76f7b074363e86d73f0bc617f8e8b81"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender08"
        { "keys": ["63b2eba4ed70d4612d3e7bc90db2fbf4c76f7b074363e86d73f0bc617f8e8b81"], "pred": "keys-all" }
        1000000.0))

    ; Create and fund sender09
    (coin.create-account "sender09"
      { "keys": ["c59d9840b0b66090836546b7eb4a73606257527ec8c2b482300fd229264b07e6"], "pred": "keys-all" })
    (with-capability (COINBASE)
      (coin.coinbase "sender09"
        { "keys": ["c59d9840b0b66090836546b7eb4a73606257527ec8c2b482300fd229264b07e6"], "pred": "keys-all" }
        1000000.0))

    "Initialized 10 sender accounts with 1,000,000 KDA each")
  "Skipped dev initialization")
`;

    // Find the end of the file (after table creations) and append
    const lastTableCreation = code.lastIndexOf("(create-table allocation-table)");
    if (lastTableCreation === -1) {
      throw new Error("Could not find allocation-table creation in coin contract");
    }

    // Insert right after the last table creation
    const insertionPoint = lastTableCreation + "(create-table allocation-table)".length;
    return code.slice(0, insertionPoint) + senderAccountInit + code.slice(insertionPoint);
  },
  {
    description: "Initialize sender accounts with funding for development",
    condition: patchConditions.isPactServer,
  }
);

const coinDeploymentBuilder = (tx: any, context: PatchContext) => {
  // Add dev-init flag for pact-server deployments
  if (context.client.getNetworkConfig().type === "pact-server") {
    tx.addData({ "dev-init": "true" });
  }
  return tx;
};

// Define the chainweb prelude using the new system
export const chainwebDefinition: PreludeDefinition = {
  id: "kadena/chainweb",
  name: "Kadena Chainweb Core",
  description: "Essential Kadena blockchain contracts including coin, fungible standards, and namespaces",
  version: "1.0.0",

  repository: repository("kadena-io", "chainweb-node", {
    branch: "master",
    basePath: "pact",
  }),

  namespaces: [
    namespace("root", ["ns-admin-keyset", "ns-operate-keyset"]),
    namespace("util", ["util-ns-admin", "util-ns-users"]),
    namespace("free", [], { create: true }),
    namespace("user", [], { create: true }),
    namespace("kadena", [], { create: true }),
  ],

  keysetTemplates: [
    keysetTemplate("ns-admin-keyset", []),
    keysetTemplate("ns-operate-keyset", []),
    keysetTemplate("ns-genesis-keyset", [], "="), // Empty for genesis with = predicate
    keysetTemplate("util-ns-admin", "admin"),
    keysetTemplate("util-ns-users", "user"),
  ],

  deploymentGroups: [
    deploymentGroup(
      "core",
      [
        file("gas-payer-v1.pact", { path: "gas-payer/gas-payer-v1.pact" }),
        file("fungible-v2.pact", { path: "coin-contract/v2/fungible-v2.pact" }),
        file("fungible-xchain-v1.pact", { path: "coin-contract/v4/fungible-xchain-v1.pact" }),
        file("coin.pact", {
          path: "coin-contract/coin-install.pact",
          deploymentBuilder: coinDeploymentBuilder,
          patches: [coinbaseCapabilityPatch, senderAccountsInitPatch],
        }),
        file("ns.pact", { path: "namespaces/ns-install.pact" }),
      ],
      {
        namespace: "root",
      },
    ),

    deploymentGroup(
      "utilities",
      [file("util-ns.pact", { path: "util/util-ns.pact" }), file("guards.pact", { path: "util/guards.pact" })],
      {
        namespace: "util",
        dependsOn: ["core"],
      },
    ),
  ],

  deploymentConditions: deploymentConditions.combine(
    deploymentConditions.skipOnChainweb(),
    deploymentConditions.ifContractsMissing(["coin"]),
    deploymentConditions.ifNamespacesMissing(["free", "user", "kadena"]),
  ),

  replTemplate: `
(env-exec-config ["DisablePact44", "DisablePact45"])
(begin-tx "Load root contracts")
(env-data {
  'ns-admin-keyset: [],
  'ns-operate-keyset: [],
  'ns-genesis-keyset: { "keys": [], "pred": "="}
})
(load "root/ns.pact")
(load "root/gas-payer-v1.pact")
(load "root/fungible-v2.pact")
(load "root/fungible-xchain-v1.pact")
(load "root/coin.pact")
(commit-tx)


(begin-tx "Load util contracts")
(env-data {
  'util-ns-users: ["{{publicKey}}"],
  'util-ns-admin: ["{{publicKey}}"]
})
(env-sigs [
  { "key": "{{publicKey}}", "caps": [] },
  { "key": "{{publicKey}}", "caps": [] },
  { "key": "{{publicKey}}", "caps": [] }
])
(load "util/util-ns.pact")
(load "util/guards.pact")
(commit-tx)

(print "Loaded kadena/chainweb contracts.")
  `.trim(),

  hooks: {
    afterDeploy: async (client) => {
      // Verify sender accounts on pact-server
      if (client.getNetworkConfig().type === "pact-server") {
        try {
          const balance = await client.execution('(coin.get-balance "sender00")').build().dirtyRead();
          console.log(`✓ Coin contract deployed with development patches`);
          console.log(`  sender00 balance: ${balance}`);
        } catch {
          console.log("✓ Coin contract deployed (could not verify sender00 balance)");
        }
      }
    },
  },
};

export default chainwebDefinition;
