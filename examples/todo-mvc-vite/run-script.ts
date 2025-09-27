#!/usr/bin/env tsx

/**
 * Standalone script runner to bypass CLI issues
 * Usage: tsx run-script.ts <script-name>
 */

import { runScript } from "@pact-toolbox/script";
import { resolve } from "node:path";

async function main() {
  const scriptName = process.argv[2];

  if (!scriptName) {
    console.error("Usage: tsx run-script.ts <script-name>");
    console.error("Available scripts:");
    console.error("  - test-script");
    console.error("  - deploy-todos");
    console.error("  - setup-accounts");
    console.error("  - manage-todos");
    process.exit(1);
  }

  try {
    console.log(`🚀 Running script: ${scriptName}`);

    const result = await runScript(scriptName, {
      cwd: process.cwd(),
      network: "devnet",
      args: {},
      signing: {
        // Use dev wallet with default keys for testing
        type: "dev-wallet",
        account: "alice",
        publicKey: "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca",
        privateKey: "251a920c444d47e5c32cda83c6c9fbb3e4bb1a62b71de0e94e7e1cf86d44b36b"
      },
    });

    console.log("\n✅ Script completed successfully!");
    console.log("📊 Result:", JSON.stringify(result.metadata, null, 2));

    if (result.result) {
      console.log("🎯 Script Output:", JSON.stringify(result.result, null, 2));
    }

  } catch (error) {
    console.error("\n❌ Script failed:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);