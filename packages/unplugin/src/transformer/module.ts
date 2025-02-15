import type { SyntaxNode } from "tree-sitter";

import { PactCapability } from "./capability";
import { PactFunction } from "./function";
import { PactSchema } from "./schema";

/**
 * Represents a Pact module.
 */
export class PactModule {
  public name: string;
  public governance: string = "";
  public functions: PactFunction[] = [];
  public schemas: PactSchema[] = [];
  public capabilities: PactCapability[] = [];
  public doc: string = "";
  public path: string;

  constructor(
    public node: SyntaxNode,
    public namespace: string | undefined,
  ) {
    this.name = node.childForFieldName("name")?.text || "";
    this.doc = node.childForFieldName("doc")?.descendantsOfType("doc_string")[0]?.text || "";
    this.governance = node.childForFieldName("governance")?.text || "";
    this.path = this.namespace ? `${this.namespace}.${this.name}` : this.name;
    for (const child of node.children) {
      if (child.type === "defschema") {
        this.schemas.push(new PactSchema(child, this));
      } else if (child.type === "defcap") {
        this.capabilities.push(new PactCapability(child, this));
      } else if (child.type === "defun") {
        this.functions.push(new PactFunction(child, this));
      }
    }
  }

  getSchema(name: string): PactSchema | undefined {
    return this.schemas.find((s) => s.name.toLowerCase() === name.toLowerCase());
  }

  getFunction(name: string): PactFunction | undefined {
    return this.functions.find((f) => f.name === name);
  }

  getCapability(name: string): PactCapability | undefined {
    return this.capabilities.find((c) => c.name === name);
  }
}
