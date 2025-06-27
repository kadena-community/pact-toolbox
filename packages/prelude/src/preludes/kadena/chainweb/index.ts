import type { PreludeDefinition } from "../../../types";
import { 
  repository, 
  file, 
  namespace, 
  deploymentGroup, 
  keysetTemplate,
  deploymentConditions 
} from "../../../utils";

// Define the chainweb prelude using the new system
export const chainwebDefinition: PreludeDefinition = {
  id: "kadena/chainweb",
  name: "Kadena Chainweb Core",
  description: "Essential Kadena blockchain contracts including coin, fungible standards, and namespaces",
  version: "1.0.0",
  
  repository: repository("kadena-io", "chainweb-node", {
    branch: "master",
    basePath: "pact"
  }),
  
  namespaces: [
    namespace("root", ["ns-admin-keyset", "ns-operate-keyset"]),
    namespace("util", ["util-ns-admin", "util-ns-users"]),
  ],
  
  keysetTemplates: [
    keysetTemplate("ns-admin-keyset", []),
    keysetTemplate("ns-operate-keyset", []), 
    keysetTemplate("ns-genesis-keyset", [], "="), // Empty for genesis with = predicate
    keysetTemplate("util-ns-admin", "admin"),
    keysetTemplate("util-ns-users", "user"),
  ],
  
  deploymentGroups: [
    deploymentGroup("core", [
      file("gas-payer-v1.pact", { path: "gas-payer/gas-payer-v1.pact" }),
      file("fungible-v2.pact", { path: "coin-contract/v2/fungible-v2.pact" }),
      file("fungible-xchain-v1.pact", { path: "coin-contract/v4/fungible-xchain-v1.pact" }),
      file("coin.pact", { path: "coin-contract/coin-install.pact" }),
      file("ns.pact", { path: "namespaces/ns-install.pact" }),
    ], {
      namespace: "root",
    }),
    
    deploymentGroup("utilities", [
      file("util-ns.pact", { path: "util/util-ns.pact" }),
      file("guards.pact", { path: "util/guards.pact" }),
    ], {
      namespace: "util",
      dependsOn: ["core"],
    }),
  ],
  
  deploymentConditions: deploymentConditions.combine(
    deploymentConditions.skipOnChainweb(),
    deploymentConditions.ifContractsMissing(["coin"])
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
};

export default chainwebDefinition;
