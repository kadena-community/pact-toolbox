import type { SyntaxNode } from "tree-sitter";
import Parser from "tree-sitter";
import Pact from "tree-sitter-pact";

import type { ErrorDetail } from "./errors";
import { ParsingError } from "./errors";
import { PactModule } from "./module";
import { getNamespaceOf } from "./utils";

/**
 * Class responsible for transforming Pact code into a custom AST and applying visitors.
 */
export class PactTransformer {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    //@ts-expect-error - fix me
    this.parser.setLanguage(Pact);
  }

  /**
   * Transforms the given Pact code into a custom AST and applies the provided visitors.
   * @param pactCode The Pact code as a string.
   * @param visitors Array of Visitor instances to apply during traversal.
   * @returns The transformation result containing the AST.
   */
  public transform(pactCode: string): PactModule[] {
    const tree = this.parser.parse(pactCode);
    const root = tree.rootNode;

    // Check for parsing errors using root.hasError()
    if (root.hasError) {
      const errors = this.collectErrors(root);
      throw new ParsingError("Failed to parse Pact code due to syntax errors.", errors);
    }

    const modules: PactModule[] = [];
    // Parse module nodes
    const namespace = getNamespaceOf(root);
    for (const node of root.children) {
      if (node.type === "module") {
        modules.push(new PactModule(node, namespace));
      }
    }

    return modules;
  }

  /**
   * Collects detailed error information from the syntax tree.
   * @param root The root node of the syntax tree.
   * @returns An array of error details.
   */
  private collectErrors(root: SyntaxNode): ErrorDetail[] {
    const errorNodes = root.descendantsOfType("ERROR");
    const errors: ErrorDetail[] = [];

    for (const node of errorNodes) {
      const startPosition = node.startPosition;
      const message = `Unexpected token '${node.text}'`;
      errors.push({
        message,
        line: startPosition.row + 1,
        column: startPosition.column + 1,
      });
    }

    return errors;
  }
}
