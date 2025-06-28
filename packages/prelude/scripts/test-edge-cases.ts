#!/usr/bin/env tsx

/**
 * Test script for edge cases and error handling
 */

import { join } from "pathe";
import { rm, mkdir } from "node:fs/promises";
import { 
  downloadAllPreludes, 
  shouldDownloadPreludes,
} from "../src/index";

// Mock client for testing
const mockClient = {
  getNetworkConfig: () => ({
    type: "pact-server",
    networkId: "development",
    keyPairs: [],
    meta: { gasLimit: 150000 },
  }),
  getSignerKeys: () => ({
    publicKey: "test-key",
    secretKey: "test-secret", 
    account: "test-account",
  }),
} as any;

async function testInvalidPrelude() {
  console.log("🧪 Testing invalid prelude handling...");
  
  const testDir = join(process.cwd(), ".test-edge-cases");
  const contractsDir = join(testDir, "contracts");
  
  try {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    const config = {
      contractsDir,
      preludes: ["nonexistent/prelude"],
      client: mockClient,
    };

    await shouldDownloadPreludes(config);
    console.log("❌ Should have thrown error for invalid prelude");
  } catch (error) {
    console.log(`✅ Correctly handled invalid prelude: ${error.message}`);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
}

async function testCacheManagement() {
  console.log("\n🧪 Testing cache management...");
  
  const testDir = join(process.cwd(), ".test-cache-mgmt");
  const contractsDir = join(testDir, "contracts");
  
  try {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    const config = {
      contractsDir,
      preludes: ["kadena/chainweb"],
      client: mockClient,
    };

    // First download
    console.log("📥 First download...");
    await downloadAllPreludes(config);
    
    // Test force download
    console.log("🔄 Testing force download...");
    await downloadAllPreludes(config, { forceDownload: true });
    
    // Test clean cache
    console.log("🧹 Testing cache cleaning...");
    await downloadAllPreludes(config, { cleanCache: true });
    
    console.log("✅ Cache management tests passed");
  } catch (error) {
    console.log(`❌ Cache management test failed: ${error.message}`);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
}

async function testEmptyPreludes() {
  console.log("\n🧪 Testing empty preludes list...");
  
  const testDir = join(process.cwd(), ".test-empty");
  const contractsDir = join(testDir, "contracts");
  
  try {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });

    const config = {
      contractsDir,
      preludes: [],
      client: mockClient,
    };

    const needsDownload = await shouldDownloadPreludes(config);
    console.log(`📥 Needs download with empty list: ${needsDownload}`);
    
    await downloadAllPreludes(config);
    console.log("✅ Empty preludes handled correctly");
  } catch (error) {
    console.log(`❌ Empty preludes test failed: ${error.message}`);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log("🧪 Running edge case tests...\n");
  
  await testInvalidPrelude();
  await testCacheManagement(); 
  await testEmptyPreludes();
  
  console.log("\n🎉 Edge case tests completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}