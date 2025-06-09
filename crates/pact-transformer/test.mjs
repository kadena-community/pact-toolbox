import { PactTransformer, transformPactCode } from "./index.js";

const samplePactCode = `
(namespace 'coin)

(module coin GOVERNANCE
  "A simple coin contract"

  (defschema account
    "User account schema"
    balance:decimal)

  (defun transfer:bool (from:string to:string amount:decimal)
    "Transfer coins between accounts"
    (with-capability (TRANSFER from to amount)
      (transfer-create from to amount)))

  (defcap TRANSFER (from:string to:string amount:decimal)
    "Transfer capability"
    (compose-capability (DEBIT from amount))
    (compose-capability (CREDIT to amount)))
)
`;

async function test() {
  try {
    console.log("🧪 Testing NAPI Pact Transformer...\n");

    // Test with class instance
    console.log("📝 Creating transformer instance...");
    const transformer = new PactTransformer();

    console.log("🔍 Parsing Pact code...");
    const modules = transformer.parse(samplePactCode);
    console.log("✅ Parsed modules:", JSON.stringify(modules, null, 2));

    console.log("\n🔄 Transforming Pact code...");
    const result = transformer.transform(samplePactCode, { debug: true });
    console.log("✅ Transformation result:");
    console.log("📄 Generated code:");
    console.log(result.code);
    console.log("\n📝 Generated types:");
    console.log(result.types);

    // Test with standalone function
    console.log("\n🔄 Testing standalone transform function...");
    const standaloneResult = transformPactCode(samplePactCode, { debug: false });
    console.log("✅ Standalone result modules:", standaloneResult.modules.length);

    console.log("\n✨ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

test();
