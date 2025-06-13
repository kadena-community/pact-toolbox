import { transformPactToJs, createPactTransformer } from "./index.js";

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

async function testTransform() {
  console.log("Testing transformPactToJs...");

  try {
    const result = await transformPactToJs(pactCode, {
      generateTypes: true,
    });

    console.log("\n=== Modules ===");
    console.log(JSON.stringify(result.modules, null, 2));

    console.log("\n=== Generated Code ===");
    console.log(result.code);

    console.log("\n=== Generated Types ===");
    console.log(result.types);
  } catch (error) {
    console.error("Transform error:", error);
  }
}

function testSyncTransformer() {
  console.log("\n\nTesting PactTransformer...");

  const transformer = createPactTransformer();

  try {
    const modules = transformer.transform(pactCode);
    console.log("\n=== Sync Transform Result ===");
    console.log(JSON.stringify(modules, null, 2));

    const errors = transformer.getErrors("(invalid pact code");
    console.log("\n=== Error Detection ===");
    console.log(errors);
  } catch (error) {
    console.error("Sync transform error:", error);
  }
}

async function runTests() {
  await testTransform();
  testSyncTransformer();
}

runTests().catch(console.error);
