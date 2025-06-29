import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

export interface FungibleContext {
  name: string;
  namespace?: string;
  adminKeyset?: string;
}

const TEMPLATE = `
(namespace "{{namespace}}")

(module {{name}} {{adminKeyset}}
  "A basic fungible token module"
  
  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}}))

  ; Add your fungible token implementation here
  (defun placeholder ()
    "This is a placeholder fungible token module")
)`;

export function generateFungible(context: FungibleContext): string {
  const fullContext = {
    name: context.name,
    namespace: context.namespace ?? "free",
    adminKeyset: context.adminKeyset ?? "admin-keyset",
  };

  return fillTemplatePlaceholders(TEMPLATE.trim(), fullContext);
}
