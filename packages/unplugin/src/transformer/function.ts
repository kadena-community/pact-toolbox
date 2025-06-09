import type { SyntaxNode } from "tree-sitter";
import { Query } from "tree-sitter";
import Pact from "tree-sitter-pact";

import type { PactModule } from "./module";
import { PactParameter } from "./parameter";
import { getReturnTypeOf } from "./utils";

export function getRequiredCapabilities(node: SyntaxNode): string[] {
  const queryStr = `(s_expression
  head: (s_expression_head) @caller
  (#any-of? @caller
    "with-capability" "require-capability" "compose-capability" "install-capability"
  )
  tail: (s_expression (s_expression_head) @cap)*
)`;
  //@ts-expect-error - fix me
  const query = new Query(Pact, queryStr);
  query.matches(node);

  return [];
  // return matches.map((m) => m.captures[0].node.text
}

/**
 * Represents a Pact function.
 */
export class PactFunction {
  public name: string;
  public path: string;
  public parameters: PactParameter[] = [];
  public returnType: string;
  public requiredCapabilities: string[] = [];
  public doc: string = "";

  constructor(
    public node: SyntaxNode,
    public module: PactModule,
  ) {
    // Replace 'any' with actual Tree-sitter node type
    this.name = node.childForFieldName("name")?.text || "";
    this.returnType = getReturnTypeOf(node);
    this.doc = node.childForFieldName("doc")?.descendantsOfType("doc_string")[0]?.text || "";
    this.path = `${module.path}.${this.name}`;
    // Parse parameters
    const parameterNodes = node.childForFieldName("parameters")?.children || [];
    for (const pNode of parameterNodes) {
      if (pNode.type === "parameter") {
        this.parameters.push(new PactParameter(pNode, module));
      }
    }

    // Placeholder for extracting required capabilities
    // this.requiredCapabilities = []; // Implement capability extraction logic as needed
  }
}
