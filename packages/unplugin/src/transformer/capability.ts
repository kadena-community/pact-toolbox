import type { SyntaxNode } from "tree-sitter";

import type { PactModule } from "./module";
import { PactParameter } from "./parameter";
import { getReturnTypeOf } from "./utils";

/**
 * Represents a Pact capability.
 */
export class PactCapability {
  public name: string;
  public path: string;
  public parameters: PactParameter[];
  public returnType: string;
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
    this.parameters = [];
    const parameterNodes = node.childForFieldName("parameters")?.children || [];
    for (const pNode of parameterNodes) {
      if (pNode.type === "parameter") {
        this.parameters.push(new PactParameter(pNode, module));
      }
    }
  }
}
