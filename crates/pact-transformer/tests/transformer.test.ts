import { describe, expect, it } from "vitest";
import { PactTransformer } from "../index.js";

const pactCode = `
(module coin GOVERNANCE
  "Coin contract with transfer functionality"

  (defschema account
    "Account schema"
    balance:decimal
    guard:guard)

  (defun transfer:string (from:string to:string amount:decimal)
    "Transfer amount from one account to another"
    (enforce (> amount 0.0) "Amount must be positive")
    (with-read accounts from { "balance":= from-bal }
      (with-read accounts to { "balance":= to-bal }
        (enforce (>= from-bal amount) "Insufficient balance")
        (update accounts from { "balance": (- from-bal amount) })
        (update accounts to { "balance": (+ to-bal amount) })
        (format "Transferred {} from {} to {}" [amount from to]))))

  (defcap TRANSFER:bool (from:string to:string amount:decimal)
    @managed amount TRANSFER-mgr
    @event
    (enforce-guard (at 'guard (read accounts from))))

  (defconst MIN_TRANSFER:decimal 0.0001
    "Minimum transfer amount")
)
`;

describe("Pact Transformer", () => {
  it("should transform Pact code to JS", async () => {
    const transformer = new PactTransformer();
    const result = await transformer.transform(pactCode, {
      generateTypes: true,
    });

    expect(result).toBeDefined();
    expect(result.javascript).toBeDefined();
    expect(result.typescript).toBeDefined();

    expect(result.javascript).toContain("coin");
    expect(result.javascript).toContain("transfer");
    expect(result.typescript).toContain("interface");
  });

  it("should parse Pact code and return module info", () => {
    const transformer = new PactTransformer();
    const modules = transformer.parse(pactCode);

    expect(modules).toBeDefined();
    expect(modules).toHaveLength(1);

    const module = modules[0];
    expect(module.name).toBe("coin");
    expect(module.governance).toBe("GOVERNANCE");
    expect(module.functionCount).toBe(1);
    expect(module.schemaCount).toBe(1);
    expect(module.capabilityCount).toBe(1);
    expect(module.constantCount).toBe(1);
  });

  it("should detect errors in invalid Pact code", () => {
    const transformer = new PactTransformer();
    const errors = transformer.getErrors("(invalid pact code");

    expect(errors).toBeDefined();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeDefined();
    expect(errors[0].line).toBeDefined();
    expect(errors[0].column).toBeDefined();
  });

  it("should transform with source maps", async () => {
    const transformer = new PactTransformer();
    const result = await transformer.transformFile(pactCode, "test.pact", {
      generateTypes: true,
      sourceMaps: true,
    });

    expect(result).toBeDefined();
    expect(result.javascript).toBeDefined();
    expect(result.typescript).toBeDefined();
    expect(result.sourceMap).toBeDefined();
  });

  it("should handle empty source code", async () => {
    const transformer = new PactTransformer();
    const result = await transformer.transform("", {
      generateTypes: true,
    });

    expect(result).toBeDefined();
    expect(result.javascript).toBeDefined();
  });

  it("should parse module documentation", () => {
    const transformer = new PactTransformer();
    const modules = transformer.parse(pactCode);

    const module = modules[0];
    expect(module.doc).toBe("Coin contract with transfer functionality");
  });

  it("should handle transform without types", async () => {
    const transformer = new PactTransformer();
    const result = await transformer.transform(pactCode, {
      generateTypes: false,
    });

    expect(result).toBeDefined();
    expect(result.javascript).toBeDefined();
    expect(result.typescript).toBeUndefined();
  });
});