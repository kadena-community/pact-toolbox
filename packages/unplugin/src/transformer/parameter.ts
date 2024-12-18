import type { SyntaxNode } from "tree-sitter";

import type { PactModule } from "./module";

/**
 * Represents a parameter (used in functions and capabilities).
 */
export class PactParameter {
  public name: string;
  public type: string;

  constructor(
    public node: SyntaxNode,
    public module: PactModule,
  ) {
    this.name = node.childForFieldName("name")?.text || "";
    this.type = node.childForFieldName("type")?.descendantsOfType("type_identifier")?.[0]?.text || "unknown";
  }
}
