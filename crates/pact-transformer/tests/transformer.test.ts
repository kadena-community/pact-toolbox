import { describe, expect, it } from "vitest";
import { transformPactToJs, createPactTransformer } from "../index.js";

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
    const result = await transformPactToJs(pactCode, {
      generateTypes: true,
    });

    expect(result).toBeDefined();
    expect(result.modules).toBeDefined();
    expect(result.modules).toHaveLength(1);

    const module = result.modules[0];
    expect(module.name).toBe("coin");
    expect(module.governance).toBe("GOVERNANCE");
    expect(module.functions).toHaveLength(1);
    expect(module.schemas).toHaveLength(1);
    expect(module.capabilities).toHaveLength(1);
    expect(module.constants).toHaveLength(1);

    expect(result.code).toBeDefined();
    expect(result.types).toBeDefined();
  });

  it("should work with sync transformer", () => {
    const transformer = createPactTransformer();

    const modules = transformer.transform(pactCode);
    expect(modules).toBeDefined();
    expect(modules).toHaveLength(1);

    const module = modules[0];
    expect(module.name).toBe("coin");
    expect(module.governance).toBe("GOVERNANCE");
  });

  it("should detect errors in invalid Pact code", () => {
    const transformer = createPactTransformer();

    expect(() => {
      transformer.transform("(invalid pact code");
    }).toThrow();
  });

  it("should parse function with parameters", () => {
    const transformer = createPactTransformer();
    const modules = transformer.transform(pactCode);

    const transferFunction = modules[0].functions.find((f) => f.name === "transfer");
    expect(transferFunction).toBeDefined();
    expect(transferFunction?.parameters).toHaveLength(3);
    expect(transferFunction?.parameters[0].name).toBe("from");
    expect(transferFunction?.parameters[1].name).toBe("to");
    expect(transferFunction?.parameters[2].name).toBe("amount");
  });

  it("should parse schema with fields", () => {
    const transformer = createPactTransformer();
    const modules = transformer.transform(pactCode);

    const accountSchema = modules[0].schemas.find((s) => s.name === "account");
    expect(accountSchema).toBeDefined();
    expect(accountSchema?.fields).toHaveLength(2);
    expect(accountSchema?.fields[0].name).toBe("balance");
    expect(accountSchema?.fields[1].name).toBe("guard");
  });

  it("should parse capability", () => {
    const transformer = createPactTransformer();
    const modules = transformer.transform(pactCode);

    const transferCap = modules[0].capabilities.find((c) => c.name === "TRANSFER");
    expect(transferCap).toBeDefined();
    expect(transferCap?.parameters).toHaveLength(3);
  });

  it("should parse constant", () => {
    const transformer = createPactTransformer();
    const modules = transformer.transform(pactCode);

    const minTransfer = modules[0].constants.find((c) => c.name === "MIN_TRANSFER");
    expect(minTransfer).toBeDefined();
    expect(minTransfer?.constantType).toBe("decimal");
  });
});
