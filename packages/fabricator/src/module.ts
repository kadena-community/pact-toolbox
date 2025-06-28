import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

const TEMPLATE = `
(namespace "{{namespace}}")
(module {{name}} {{adminKeyset}}
  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}})
  )
  (defun upgrade ()
    @doc "Upgrade the module"
    (with-capability (GOVERNANCE)
      "Module upgraded"))

  (defun my-function ()
    @doc "Example function"
    "Hello from {{name}} module!")
)

`;

export interface ModuleContext {
  name: string;
  namespace?: string;
  adminKeyset?: string;
}
export function generateModule(context: ModuleContext): string {
  const fullContext = {
    name: context.name,
    namespace: context.namespace ?? "free",
    adminKeyset: context.adminKeyset ?? "admin-keyset"
  };
  
  return fillTemplatePlaceholders(TEMPLATE.trim(), fullContext);
}
