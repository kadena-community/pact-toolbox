import { fillTemplatePlaceholders } from "@pact-toolbox/utils";

const TEMPLATE = `
(namespace "{{namespace}}")
(module {{name}} GOVERNANCE
  (defcap GOVERNANCE ()
    (enforce-keyset "{{namespace}}.{{adminKeyset}}")
  )
  (defun test (name:string)
    (format "Hello from {{name}} module!")
  )
)

(if (read-msg "upgrade")
  ["Module upgraded."]
  []
)
`;

interface ModuleTemplateContext {
  name: string;
  namespace?: string;
  adminKeyset?: string;
}
export function generateModule(context: ModuleTemplateContext): string {
  return fillTemplatePlaceholders(TEMPLATE.trim(), context);
}
