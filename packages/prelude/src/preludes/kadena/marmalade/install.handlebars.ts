export const template = `
(begin-tx)
  (define-namespace 'kip (sig-keyset) (sig-keyset))
  (load "./kip/account-protocols-v1.pact")
  (env-data { 'ns: "kip", 'upgrade: false })
  (load "./kip/manifest.pact")
  (load "./kip/token-policy-v2.pact")
  (load "./kip/poly-fungible-v3.pact")
  (define-namespace 'util (sig-keyset) (sig-keyset))
  (load "./util/fungible-util.pact")
  (load "./util/guards1.pact")
(commit-tx)

(begin-tx "deploy marmalade-v2 namespace and admin keyset")
  (env-data
   { 'marmalade-admin: ["{{publicKey}}"]
   , 'marmalade-user: ["{{publicKey}}"]
   , 'ns: "marmalade-v2"
   , 'upgrade: false })
   (env-sigs [
     { 'key: 'marmalade-admin
      ,'caps: []
      }])
  (load "./marmalade-ns/ns-marmalade.pact")
  (env-data
   { "marmalade-v2.marmalade-contract-admin": ["marmalade-contract-admin"]
   , 'ns: "marmalade-v2"
   , 'upgrade: false })
   (env-sigs [
     { 'key: 'marmalade-user
      ,'caps: []
     }, {
       'key: 'marmalade-contract-admin
      ,'caps: []
      }])
  (load "./marmalade-ns/ns-contract-admin.pact")
(commit-tx)

(begin-tx "deploy marmalade-sale namespace and admin keyset")
  (env-data
   { 'marmalade-admin: ["{{publicKey}}"]
   , 'marmalade-user: ["{{publicKey}}"]
   , 'ns: "marmalade-sale"
   , 'upgrade: false })
   (env-sigs [
     { 'key: 'marmalade-admin
      ,'caps: []
      }])
  (load "./marmalade-ns/ns-marmalade.pact")
  (env-data
   { "marmalade-sale.marmalade-contract-admin": ["marmalade-contract-admin"]
   , 'ns: "marmalade-sale"
   , 'upgrade: false })
   (env-sigs [
     { 'key: 'marmalade-user
      ,'caps: []
     }, {
       'key: 'marmalade-contract-admin
      ,'caps: []
      }])
  (load "./marmalade-ns/ns-contract-admin.pact")
(commit-tx)

(env-data
 { 'marmalade-admin: ["{{publicKey}}"]
 , 'marmalade-user: ["{{publicKey}}"]
 , 'ns: "marmalade-v2"
 , 'upgrade: false })

(begin-tx)
  (load "./ledger/ledger.interface.pact")
  (load "./policy-manager/sale.interface.pact")
  (load "./policy-manager/policy-manager.pact")
  (load "./ledger/ledger.pact")
  (load "./marmalade-util/util-v1.pact")
  (load "./test/abc.pact")
  (load "./test/def.pact")
(commit-tx)

(begin-tx "load concrete-polices")
  (load "./concrete-policies/non-fungible-policy/non-fungible-policy-v1.pact")
  (load "./concrete-policies/royalty-policy/royalty-policy-v1.pact")
  (load "./concrete-policies/collection-policy/collection-policy-v1.pact")
  (load "./concrete-policies/guard-policy/guard-policy-v1.pact")
  (load "./policy-manager/manager-init.pact")
(commit-tx)
`.trim();
