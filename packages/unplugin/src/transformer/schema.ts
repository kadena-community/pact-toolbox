import type { SyntaxNode } from "tree-sitter";

import type { PactModule } from "./module";

/**
 * Represents a field within a schema.
 */
export class PactSchemaField {
  public name: string;
  public type: string;
  constructor(
    public node: SyntaxNode,
    public module: PactModule,
  ) {
    this.name = node.childForFieldName("name")?.text || "";
    this.type = node.descendantsOfType("type_identifier")?.[0]?.text || "unknown";
  }
}

/**
 * Represents a Pact schema.
 */
export class PactSchema {
  public name: string;
  public fields: PactSchemaField[] = [];
  public doc: string = "";
  constructor(
    public node: SyntaxNode,
    public module: PactModule,
  ) {
    this.name = node.childForFieldName("name")?.text || "";
    this.doc = node.childForFieldName("doc")?.descendantsOfType("doc_string")[0]?.text || "";
    const fieldNodes = node.childForFieldName("fields")?.descendantsOfType("schema_field") || [];
    // Parse fields
    for (const child of fieldNodes) {
      this.fields.push(new PactSchemaField(child, module));
    }
  }
}
