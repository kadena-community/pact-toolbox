/**
 * Performance comparison between the native Rust transformer and the original TypeScript transformer
 *
 * This example demonstrates the significant performance improvements achieved by using the native
 * NAPI-RS implementation with tree-sitter-pact.
 */

import { performance } from "perf_hooks";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// Sample Pact code for testing
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const samplePactCode = readFileSync(join(__dirname, "code.pact"), "utf8");

/**
 * Benchmark a function with multiple iterations
 */
function benchmark(name: string, fn: () => void, iterations = 100) {
  console.log(`\\n🏃 Running ${name} (${iterations} iterations)...`);

  const times = [];
  let totalMemoryDelta = 0;

  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    try {
      fn();
    } catch (error) {
      console.error(`❌ Error in ${name}:`, error.message);
      return null;
    }

    const end = performance.now();
    const memAfter = process.memoryUsage().heapUsed;

    times.push(end - start);
    totalMemoryDelta += memAfter - memBefore;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const avgMemory = totalMemoryDelta / iterations;

  console.log(`   ⏱️  Average: ${avgTime.toFixed(2)}ms`);
  console.log(`   🚀 Best: ${minTime.toFixed(2)}ms`);
  console.log(`   🐌 Worst: ${maxTime.toFixed(2)}ms`);
  console.log(`   💾 Avg Memory: ${(avgMemory / 1024).toFixed(2)}KB`);

  return {
    name,
    avgTime,
    minTime,
    maxTime,
    avgMemory,
    times,
  };
}

/**
 * Test the native Rust transformer
 */
async function testNativeTransformer() {
  try {
    // Import the native transformer
    const { transformPactCode } = await import("@pact-toolbox/pact-transformer-napi");

    return benchmark("Native Rust Transformer", () => {
      const result = transformPactCode(samplePactCode, { debug: false });

      // Verify we got results
      if (!result.code || !result.types || result.modules.length === 0) {
        throw new Error("Invalid transformation result");
      }
    });
  } catch (error) {
    console.error("❌ Failed to load native transformer:", error.message);
    console.log("💡 Make sure to build the native module first:");
    console.log("   cd crates/pact-transformer-napi && npm run build");
    return null;
  }
}

/**
 * Test the original TypeScript transformer (if available)
 */
async function testTypeScriptTransformer() {
  try {
    // Try to import the original transformer
    const { createPactToJSTransformer } = await import("@pact-toolbox/unplugin/transform");

    const transformer = createPactToJSTransformer({ debug: false });

    return benchmark("TypeScript Transformer", () => {
      const result = transformer(samplePactCode);

      // Verify we got results
      if (!result.code || !result.types || result.modules.length === 0) {
        throw new Error("Invalid transformation result");
      }
    });
  } catch (error) {
    console.error("❌ Failed to load TypeScript transformer:", error.message);
    console.log("💡 This is expected if the original transformer is not available");
    return null;
  }
}

/**
 * Main comparison function
 */
async function runComparison() {
  console.log("🚀 Pact Transformer Performance Comparison");
  console.log("=".repeat(50));

  console.log(`📝 Sample code: ${samplePactCode.split("\\n").length} lines`);
  console.log(`📏 Code size: ${(samplePactCode.length / 1024).toFixed(2)}KB`);

  const results = [];

  // Test native transformer
  const nativeResult = await testNativeTransformer();
  if (nativeResult) results.push(nativeResult);

  // Test TypeScript transformer
  const tsResult = await testTypeScriptTransformer();
  if (tsResult) results.push(tsResult);

  // Compare results
  if (results.length === 2) {
    console.log("\\n📊 Performance Comparison:");
    console.log("=".repeat(30));

    const [native, ts] = results;
    const speedup = ts?.avgTime / native?.avgTime;
    const memoryImprovement = ts?.avgMemory / native?.avgMemory;

    console.log(`🚀 Speed improvement: ${speedup.toFixed(1)}x faster`);
    console.log(`💾 Memory improvement: ${memoryImprovement.toFixed(1)}x more efficient`);

    if (speedup > 10) {
      console.log("\\n🎉 Excellent! The native transformer is significantly faster!");
    } else if (speedup > 3) {
      console.log("\\n✅ Great! The native transformer provides solid performance gains!");
    } else {
      console.log("\\n👍 Good! The native transformer is faster!");
    }
  } else if (results.length === 1 && results[0].name.includes("Native")) {
    console.log("\\n✅ Native transformer is working correctly!");
    console.log("💡 Install the TypeScript transformer to see performance comparison");
  }

  console.log("\\n🏁 Benchmark completed!");
}

// Run the comparison
runComparison().catch(console.error);
