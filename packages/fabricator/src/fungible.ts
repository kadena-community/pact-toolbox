interface FungibleTemplateContext {
  namespace?: string;
  adminKeyset?: string;
  gasStationAccount: string;
  module: string;
}

const TEMPLATE = `
(namespace "{{namespace}}")
(module {{module}}-gas-station GOVERNANCE
  (implements gas-payer-v1)
  (use coin)

  (defcap GOVERNANCE ()
    (enforce-keyset "{{namespace}}.{{adminKeyset}}")
  )

  (defcap ALLOW_GAS () true)

  (defconst GAS_STATION_ACCOUNT "{{gasStationAccount}}")

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
export function generateFungible(context: FungibleTemplateContext): string {
  return TEMPLATE.trim()
    .replace(/{{namespace}}/g, context.namespace ?? 'free')
    .replace(/{{adminKeyset}}/g, context.adminKeyset ?? `${context.module}-admin-keyset`)
    .replace(/{{gasStationAccount}}/g, context.gasStationAccount)
    .replace(/{{module}}/g, context.module);
}
