import type { SyntaxNode } from "tree-sitter";
import { pascalCase } from "scule";

import type { PactModule } from "./module";

const TYPE_MAP: Record<string, string> = {
  integer: "number",
  decimal: "number",
  time: "Date",
  bool: "boolean",
  string: "string",
  list: "unknown[]",
  keyset: "object",
  guard: "object",
  object: "Record<string, unknown>",
  table: "Record<string, unknown>",
};

/**
 * Maps Pact types to TypeScript types.
 * @param pactType The Pact type as a string.
 * @param module The current module context.
 * @returns The corresponding TypeScript type as a string.
 */
export function pactTypeToTypescriptType(pactType: string, module: PactModule): string {
  if (pactType.startsWith("{") || pactType.startsWith("object{")) {
    const schemaName = pactType.startsWith("{") ? pactType.slice(1, -1) : pactType.slice(7, -1);
    const schema = module.getSchema(schemaName);
    if (schema) {
      return pascalCase(schema.name);
    }
    return "Record<string, unknown>";
  }

  if (pactType.startsWith("[")) {
    const innerType = pactType.slice(1, -1);
    if (innerType) {
      return `${pactTypeToTypescriptType(innerType, module)}[]`;
    }
    return "unknown[]";
  }

  return TYPE_MAP[pactType] || "unknown";
}

export function getReturnTypeOf(node: SyntaxNode): string {
  return node.childForFieldName("return_type")?.descendantsOfType("type_identifier")?.[0]?.text || "void";
}

export function getNamespaceOf(node: SyntaxNode): string | undefined {
  let namespace = node?.descendantsOfType("namespace")?.[0]?.childForFieldName("namespace")?.text;
  if (!namespace) {
    return undefined;
  }
  if (namespace.startsWith("'")) {
    return namespace.slice(1);
  }
  return namespace.slice(1, -1);
}

/**
 * Converts a multi-line string with backslashes into a JSDoc comment.
 *
 * @param {string} inputStr - The original multi-line string with backslashes.
 * @returns {string} - The formatted JSDoc comment.
 *
 * @example
 * const originalString = " Checks ACCOUNT for reserved name and returns type if \\
 *     \\ found or empty string. Reserved names start with a \\
 *     \\ single char and colon, e.g. 'c:foo', which would return 'c' as type.";
 *
 * console.log(convertToJsDoc(originalString));
 *
 * // Output:
 * /**
 *  * Checks ACCOUNT for reserved name and returns type if
 *  * found or empty string. Reserved names start with a
 *  * single char and colon, e.g. 'c:foo', which would return 'c' as type.
 *  *\/
 */
export function convertToJsDoc(inputStr?: string): string {
  if (!inputStr) {
    return "";
  }
  // Step 1: Remove surrounding quotes (single or double)
  let trimmedStr = inputStr.trim();
  if (
    (trimmedStr.startsWith('"') && trimmedStr.endsWith('"')) ||
    (trimmedStr.startsWith("'") && trimmedStr.endsWith("'"))
  ) {
    trimmedStr = trimmedStr.slice(1, -1);
  }

  // Step 2: Replace backslash followed by any whitespace and backslash with a single space
  // This handles cases where backslashes are used for line continuation
  trimmedStr = trimmedStr.replace(/\\\s*\\/g, " ");

  // Step 3: Replace remaining backslashes used for line continuation with a space
  trimmedStr = trimmedStr.replace(/\\\s*\n\s*/g, " ");

  // Step 4: Split the string into sentences or desired lines
  // Here, we'll split by periods to create new lines, but you can adjust as needed
  const lines = trimmedStr.split(/(?<=\.)\s+/);

  // Step 5: Trim each line and prefix with ' * '
  const jsDocLines = lines.map((line) => ` * ${line.trim()}`);

  // Step 6: Combine all lines with JSDoc syntax
  const jsDocComment = ["/**", ...jsDocLines, " */"].join("\n");

  return `${jsDocComment}\n`;
}
