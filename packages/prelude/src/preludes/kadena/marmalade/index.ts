import type { PreludeDefinition } from "../../../types";
import { repository, file, namespace, deploymentGroup, keysetTemplate, deploymentConditions } from "../../../utils";

// Define the marmalade prelude using the new system
export const marmaladeDefinition: PreludeDefinition = {
  id: "kadena/marmalade",
  name: "Kadena Marmalade NFT Framework",
  description: "Complete NFT framework with policies, ledger, and sale contracts",
  version: "2.0.0",

  repository: repository("kadena-io", "marmalade", {
    basePath: "pact",
  }),

  dependencies: ["kadena/chainweb"],

  namespaces: [
    namespace("kip", ["ns-admin-keyset", "ns-operate-keyset"]),
    namespace("util", ["ns-admin-keyset", "ns-operate-keyset"]),
    namespace("marmalade-v2", ["marmalade-admin", "marmalade-contract-admin"]),
    namespace("marmalade-sale", ["marmalade-admin", "marmalade-contract-admin"]),
  ],

  keysetTemplates: [
    keysetTemplate("marmalade-admin", "admin"),
    keysetTemplate("marmalade-user", "user"),
    keysetTemplate("marmalade-contract-admin", "admin"),
    keysetTemplate("ns-admin-keyset", "admin"),
    keysetTemplate("ns-operate-keyset", "admin"),
    keysetTemplate("ns-genesis-keyset", "admin"),
  ],

  deploymentGroups: [
    deploymentGroup("namespaces", [file("ns-marmalade.pact", { path: "marmalade-ns/ns-marmalade.pact" })], {
      shouldDeploy: async (client) => {
        const namespaces = ["kip", "util", "marmalade-v2", "marmalade-sale"];
        const checks = await Promise.all(namespaces.map((ns) => client.isNamespaceDefined(ns)));
        return checks.some((exists) => !exists);
      },
    }),

    deploymentGroup(
      "kip-standards",
      [
        file("account-protocols-v1.pact", { path: "kip/account-protocols-v1.pact" }),
        file("manifest.pact", { path: "kip/manifest.pact" }),
        file("poly-fungible-v3.pact", { path: "kip/poly-fungible-v3.pact" }),
        file("token-policy-v2.pact", { path: "kip/token-policy-v2.pact" }),
        file("updatable-uri-policy-v1.pact", { path: "kip/updatable-uri-policy-v1.pact" }),
      ],
      {
        namespace: "kip",
        dependsOn: ["namespaces"],
      },
    ),

    deploymentGroup(
      "utilities",
      [
        file("fungible-util.pact", { path: "util/fungible-util.pact" }),
        file("guards1.pact", { path: "util/guards1.pact" }),
      ],
      {
        namespace: "util",
        dependsOn: ["namespaces"],
      },
    ),

    deploymentGroup(
      "core-ledger",
      [
        file("ledger.interface.pact", { path: "ledger/ledger.interface.pact" }),
        file("ledger.pact", { path: "ledger/ledger.pact" }),
      ],
      {
        namespace: "marmalade-v2",
        dependsOn: ["kip-standards"],
      },
    ),

    deploymentGroup(
      "policy-manager",
      [
        file("sale.interface.pact", { path: "policy-manager/sale.interface.pact" }),
        file("policy-manager.pact", { path: "policy-manager/policy-manager.pact" }),
        file("manager-init.pact", { path: "policy-manager/manager-init.pact" }),
      ],
      {
        namespace: "marmalade-v2",
        dependsOn: ["core-ledger"],
      },
    ),

    deploymentGroup("marmalade-util", [file("util-v1.pact", { path: "marmalade-util/util-v1.pact" })], {
      namespace: "marmalade-v2",
      dependsOn: ["policy-manager"],
    }),

    deploymentGroup(
      "concrete-policies",
      [
        file("collection-policy-v1.pact", {
          path: "concrete-policies/collection-policy/collection-policy-v1.pact",
        }),
        file("guard-policy-v1.pact", {
          path: "concrete-policies/guard-policy/guard-policy-v1.pact",
        }),
        file("non-fungible-policy-v1.pact", {
          path: "concrete-policies/non-fungible-policy/non-fungible-policy-v1.pact",
        }),
        file("non-updatable-uri-policy-v1.pact", {
          path: "concrete-policies/non-updatable-uri-policy/non-updatable-uri-policy-v1.pact",
        }),
        file("royalty-policy-v1.pact", {
          path: "concrete-policies/royalty-policy/royalty-policy-v1.pact",
        }),
      ],
      {
        namespace: "marmalade-v2",
        dependsOn: ["policy-manager"],
        optional: true, // Policies are optional for basic functionality
      },
    ),

    deploymentGroup(
      "sale-contracts",
      [
        file("conventional-auction.pact", {
          path: "sale-contracts/conventional-auction/conventional-auction.pact",
        }),
        file("dutch-auction.pact", {
          path: "sale-contracts/dutch-auction/dutch-auction.pact",
        }),
      ],
      {
        namespace: "marmalade-sale",
        dependsOn: ["policy-manager"],
        optional: true,
      },
    ),
  ],

  deploymentConditions: deploymentConditions.ifContractsMissing(["marmalade-v2.ledger", "marmalade-v2.policy-manager"]),

  replTemplate: `
;; Marmalade v2 Installation Script
;; This script installs the complete Marmalade v2 token framework
;; Network: {{networkId}}
;; Admin: {{accountName}} ({{publicKey}})

;; Setup environment data for keysets
(env-data {
  "ns-admin-keyset": ["{{publicKey}}"],
  "ns-genesis-keyset": ["{{publicKey}}"],
  "ns-operate-keyset": ["{{publicKey}}"],
  "marmalade-admin": ["{{publicKey}}"],
  "marmalade-user": ["{{publicKey}}"],
  "marmalade-contract-admin": ["{{publicKey}}"]
})

;; Create KIP namespace and load KIP standards
(begin-tx "Create KIP namespace and load standards")
  (define-namespace 'kip
    (read-keyset 'ns-admin-keyset)
    (read-keyset 'ns-genesis-keyset))

  (namespace 'kip)
  (load "kip/account-protocols-v1.pact")
  (load "kip/manifest.pact")
  (load "kip/token-policy-v2.pact")
  (load "kip/poly-fungible-v3.pact")
  (load "kip/updatable-uri-policy-v1.pact")
(commit-tx)

;; Create util namespace and load utilities
(begin-tx "Create util namespace and load utilities")
  (define-namespace 'util
    (read-keyset 'ns-admin-keyset)
    (read-keyset 'ns-genesis-keyset))

  (namespace 'util)
  (load "util/fungible-util.pact")
  (load "util/guards1.pact")
(commit-tx)

;; Create marmalade-v2 namespace
(begin-tx "Create marmalade-v2 namespace and admin keyset")
  (define-namespace 'marmalade-v2
    (read-keyset 'ns-admin-keyset)
    (read-keyset 'ns-genesis-keyset))

  (namespace 'marmalade-v2)
  (define-keyset "marmalade-v2.marmalade-contract-admin" (read-keyset 'marmalade-contract-admin))
(commit-tx)

;; Create marmalade-sale namespace
(begin-tx "Create marmalade-sale namespace and admin keyset")
  (define-namespace 'marmalade-sale
    (read-keyset 'ns-admin-keyset)
    (read-keyset 'ns-genesis-keyset))

  (namespace 'marmalade-sale)
  (define-keyset "marmalade-sale.marmalade-contract-admin" (read-keyset 'marmalade-contract-admin))
(commit-tx)

;; Load core marmalade contracts
(begin-tx "Load core marmalade contracts")
  (namespace 'marmalade-v2)

  ;; Core interfaces
  (load "ledger/ledger.interface.pact")
  (load "policy-manager/sale.interface.pact")

  ;; Policy manager
  (load "policy-manager/policy-manager.pact")

  ;; Core ledger
  (load "ledger/ledger.pact")

  ;; Utilities
  (load "marmalade-util/util-v1.pact")
(commit-tx)

;; Load concrete policies
(begin-tx "Load concrete policies")
  (namespace 'marmalade-v2)

  (load "concrete-policies/collection-policy/collection-policy-v1.pact")
  (load "concrete-policies/guard-policy/guard-policy-v1.pact")
  (load "concrete-policies/non-fungible-policy/non-fungible-policy-v1.pact")
  (load "concrete-policies/non-updatable-uri-policy/non-updatable-uri-policy-v1.pact")
  (load "concrete-policies/royalty-policy/royalty-policy-v1.pact")

  ;; Initialize policy manager
  (load "policy-manager/manager-init.pact")
(commit-tx)

;; Load sale contracts
(begin-tx "Load sale contracts")
  (namespace 'marmalade-sale)

  (load "sale-contracts/conventional-auction/conventional-auction.pact")
  (load "sale-contracts/dutch-auction/dutch-auction.pact")
(commit-tx)

(print "✓ Marmalade v2 installation completed successfully!")
(print "Available namespaces: kip, util, marmalade-v2, marmalade-sale")
(print "Core contracts: marmalade-v2.ledger, marmalade-v2.policy-manager")
(print "Policies: collection, guard, non-fungible, non-updatable-uri, royalty")
(print "Sale contracts: conventional-auction, dutch-auction")
  `.trim(),

  hooks: {
    beforeDeploy: async (_client) => {
      console.log("🚀 Starting Marmalade v2 deployment...");
    },

    afterDeploy: async (_client) => {
      console.log("✅ Marmalade v2 deployment completed!");
    },

    onError: async (_client, error) => {
      console.error("❌ Marmalade deployment failed:", error.message);
    },
  },
};

export default marmaladeDefinition;
