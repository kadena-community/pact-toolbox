import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

const TEMPLATE = `
(namespace "{{namespace}}")
(module {{name}} {{adminKeyset}}
  (implements gas-payer-v1)
  (use coin)

  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}})
  )

  (defcap ALLOW_GAS () true)

  (defcap ACCOUNT_GUARD () true)

  (defconst GAS_STATION_ACCOUNT "{{account}}")

  (defun chain-gas-price ()
    (at 'gas-price (chain-data))
  )

  (defun enforce-below-or-at-gas-price:bool (gasPrice:decimal)
    (enforce (<= (chain-gas-price) gasPrice)
      (format "Gas Price must be smaller than or equal to {}" [gasPrice]))
  )

  (defcap GAS_PAYER:bool
    ( user:string
      limit:integer
      price:decimal
    )
    (let ((tx-type:string (read-msg "tx-type"))
          (exec-code:[string] (read-msg "exec-code"))
          (formatted (format "({}.{}." [ "{{namespace}}", "{{module}}" ]))
        )
      (enforce (= "exec" tx-type) "Can only be used inside an exec")
      (enforce (= 1 (length exec-code)) "Can only be used to call one pact function")
      (enforce (= formatted (take (length formatted) (at 0 exec-code))) "only {{namespace}}.{{module}} smart contract")
    )
    (enforce-below-or-at-gas-price 0.000001)
    (compose-capability (ALLOW_GAS))
  )


  (defun create-gas-payer-guard:guard ()
    (create-user-guard (gas-payer-guard))
  )

  (defun gas-payer-guard ()
    (require-capability (GAS))
    (require-capability (ALLOW_GAS))
  )

  (defun init ()
    (coin.create-account GAS_STATION_ACCOUNT (create-gas-payer-guard))
  )
)

(if (read-msg "init")
  [(init)]
  ["not creating the gas station account"]
)
`;

export interface GasStationContext {
  name: string;
  namespace?: string;
  adminKeyset?: string;
  account: string;
  module: string;
}

export function generateGasStation(context: GasStationContext): string {
  const fullContext = {
    name: context.name,
    namespace: context.namespace ?? "free",
    adminKeyset: context.adminKeyset ?? "admin-keyset",
    account: context.account,
    module: context.module
  };
  
  return fillTemplatePlaceholders(TEMPLATE.trim(), fullContext);
}
