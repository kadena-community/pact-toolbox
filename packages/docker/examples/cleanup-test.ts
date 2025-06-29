#!/usr/bin/env tsx

import { ContainerOrchestrator } from "../src/orchestrator";

/**
 * Test script to demonstrate the cleanup functionality
 */
async function testCleanup() {
  console.log("🧹 Testing container cleanup functionality...");

  const orchestrator = new ContainerOrchestrator({
    defaultNetwork: "test-network",
    enableMetrics: false,
  });

  try {
    // Test cleanup of DevNet resources
    console.log("Cleaning up any existing DevNet containers...");
    await orchestrator.cleanupResources({
      containerPatterns: ["devnet", "chainweb", "mining", "bootstrap", "com.chainweb.devnet.description"],
      networkPatterns: ["devnet", "chainweb"],
      volumePatterns: ["devnet", "chainweb"],
      cleanupContainers: true,
      cleanupNetworks: true,
      cleanupVolumes: true,
      force: true,
    });

    console.log("✅ Cleanup completed successfully!");

    // Test cleanup of specific container patterns
    console.log("Testing cleanup with custom patterns...");
    await orchestrator.cleanupResources({
      containerPatterns: ["test-container"],
      networkPatterns: ["test-network"],
      volumePatterns: ["test-volume"],
      cleanupContainers: true,
      cleanupNetworks: true,
      cleanupVolumes: true,
      force: true,
    });

    console.log("✅ Custom cleanup completed successfully!");
  } catch (error) {
    console.error("❌ Cleanup test failed:", error);
    process.exit(1);
  }

  console.log("🎉 All cleanup tests passed!");
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCleanup().catch(console.error);
}

export { testCleanup };
