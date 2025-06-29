#!/usr/bin/env tsx

/**
 * Integration test script for prelude downloads
 * This script tests the actual download functionality without mocks
 */

import { join } from "pathe";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "@pact-toolbox/node-utils";
import { downloadAllPreludes, resolvePreludes, shouldDownloadPreludes, getCacheStats } from "../src/index";

// Mock client for testing
const mockClient = {
  getNetworkConfig: () => ({
    type: "pact-server",
    networkId: "development",
    keyPairs: [
      {
        publicKey: "test-key",
        secretKey: "test-secret",
        account: "test-account",
      },
    ],
    meta: { gasLimit: 150000 },
  }),
  getSignerKeys: () => ({
    publicKey: "test-key",
    secretKey: "test-secret",
    account: "test-account",
  }),
} as any;

async function main() {
  console.log("🧪 Testing prelude download functionality...\n");

  const testDir = join(process.cwd(), ".test-integration");
  const contractsDir = join(testDir, "contracts");

  try {
    // Clean up any previous test runs
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    const config = {
      contractsDir,
      preludes: ["kadena/chainweb"], // Test with a simple prelude
      client: mockClient,
    };

    console.log("📦 Resolving preludes...");
    const { preludes, preludesDir } = await resolvePreludes(config);
    console.log(`✅ Resolved ${preludes.length} preludes`);
    console.log(`📂 Preludes directory: ${preludesDir}`);

    console.log("\n🔍 Checking if download is needed...");
    const needsDownload = await shouldDownloadPreludes(config);
    console.log(`📥 Needs download: ${needsDownload}`);

    console.log("\n📥 Downloading preludes...");
    await downloadAllPreludes(config, {
      forceDownload: false,
      validateChecksums: true,
      cleanCache: false,
    });

    console.log("\n✅ Download completed! Verifying files...");

    // Check that files were downloaded
    const chainwebDir = join(preludesDir, "kadena/chainweb");
    if (existsSync(chainwebDir)) {
      console.log("✅ Chainweb prelude directory exists");

      // Check for some expected files
      const expectedFiles = ["root/coin.pact", "root/fungible-v2.pact", "root/ns.pact", "install.repl"];

      for (const file of expectedFiles) {
        const filePath = join(chainwebDir, file);
        if (existsSync(filePath)) {
          console.log(`✅ Found ${file}`);
        } else {
          console.log(`❌ Missing ${file}`);
        }
      }
    } else {
      console.log("❌ Chainweb prelude directory not found");
    }

    // Check cache stats
    console.log("\n📊 Cache statistics:");
    const stats = await getCacheStats(preludesDir);
    console.log(`   Entries: ${stats.totalEntries}`);
    console.log(`   Size: ~${Math.round(stats.totalSize / 1024)}KB`);

    // Test that second download is cached
    console.log("\n🔄 Testing cache behavior...");
    const needsDownloadAgain = await shouldDownloadPreludes(config);
    console.log(`📥 Needs download again: ${needsDownloadAgain}`);

    if (!needsDownloadAgain) {
      console.log("✅ Cache is working correctly!");
    } else {
      console.log("⚠️ Cache might not be working as expected");
    }

    console.log("\n🎉 Integration test completed successfully!");
  } catch (error) {
    console.error("\n❌ Integration test failed:", error);
    process.exit(1);
  } finally {
    // Clean up
    await rm(testDir, { recursive: true, force: true });
    console.log("🧹 Cleaned up test directory");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
