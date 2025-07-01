import { createScript } from "@pact-toolbox/script";

export default createScript({
  metadata: {
    name: "test-script",
    description: "Test script to verify all features work correctly",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["test", "verification"],
  },

  autoStartNetwork: true,
  persist: false,
  timeout: 30000,

  async run(ctx) {
    const { logger, deployer, coin, marmalade, currentSigner } = ctx;

    logger.info("🧪 Running test script to verify all components");
    logger.info(`📍 Network: ${ctx.network}`);
    logger.info(`🔗 Chain ID: ${ctx.chainId}`);
    logger.info(`👤 Current Signer: ${currentSigner?.account}`);

    const tests = [];

    // Test 1: Check deployer is working
    logger.info("\n1️⃣ Testing deployer...");
    try {
      const result = await deployer
        .execution("(+ 1 2)")
        .withChainId(ctx.chainId as any)
        .build()
        .dirtyRead();

      if (result.result === 3) {
        logger.success("✅ Deployer: Working");
        tests.push({ name: "Deployer", status: "PASS" });
      } else {
        logger.error("❌ Deployer: Unexpected result");
        tests.push({ name: "Deployer", status: "FAIL", error: "Unexpected result" });
      }
    } catch (error) {
      logger.error("❌ Deployer: Failed", error);
      tests.push({ name: "Deployer", status: "FAIL", error: error.message });
    }

    // Test 2: Check coin contract
    logger.info("\n2️⃣ Testing coin contract...");
    try {
      // Try to get coin module info
      const result = await deployer
        .execution("(describe-module coin)")
        .withChainId(ctx.chainId as any)
        .build()
        .dirtyRead();

      if (result.result) {
        logger.success("✅ Coin Contract: Available");
        tests.push({ name: "Coin Contract", status: "PASS" });
      } else {
        logger.warn("⚠️ Coin Contract: Not found");
        tests.push({ name: "Coin Contract", status: "WARN", error: "Module not found" });
      }
    } catch (error) {
      logger.warn("⚠️ Coin Contract: Not deployed", error.message);
      tests.push({ name: "Coin Contract", status: "WARN", error: "Not deployed" });
    }

    // Test 3: Check current signer
    logger.info("\n3️⃣ Testing wallet/signer...");
    if (currentSigner) {
      logger.success(`✅ Wallet: Connected (${currentSigner.account})`);
      tests.push({ name: "Wallet", status: "PASS", details: currentSigner.account });

      // Try to get balance
      try {
        const balanceResult = await coin.getBalance({ account: currentSigner.account });
        const balance = parseFloat(balanceResult.balance);
        logger.info(`   💰 Balance: ${balance} KDA`);
        tests.push({ name: "Balance Check", status: "PASS", details: `${balance} KDA` });
      } catch (error) {
        logger.debug("   Balance check failed (account might not exist)");
        tests.push({ name: "Balance Check", status: "SKIP", error: "Account not found" });
      }
    } else {
      logger.error("❌ Wallet: No signer available");
      tests.push({ name: "Wallet", status: "FAIL", error: "No signer" });
    }

    // Test 4: Check marmalade contract
    logger.info("\n4️⃣ Testing marmalade contract...");
    if (marmalade) {
      logger.success("✅ Marmalade Contract: Available");
      tests.push({ name: "Marmalade Contract", status: "PASS" });
    } else {
      logger.warn("⚠️ Marmalade Contract: Not available");
      tests.push({ name: "Marmalade Contract", status: "WARN" });
    }

    // Test 5: Check todos module
    logger.info("\n5️⃣ Testing todos module...");
    try {
      const result = await deployer
        .execution("(describe-module free.todos)")
        .withChainId(ctx.chainId as any)
        .build()
        .dirtyRead();

      if (result.result) {
        logger.success("✅ Todos Module: Deployed");
        tests.push({ name: "Todos Module", status: "PASS" });
      } else {
        logger.warn("⚠️ Todos Module: Not found");
        tests.push({ name: "Todos Module", status: "WARN", error: "Module not found" });
      }
    } catch (error) {
      logger.warn("⚠️ Todos Module: Not deployed");
      logger.info("   💡 Run 'deploy-todos' script to deploy");
      tests.push({ name: "Todos Module", status: "WARN", error: "Not deployed" });
    }

    // Summary
    logger.info("\n" + "=".repeat(50));
    logger.info("📊 Test Summary");
    logger.info("=".repeat(50));

    const passCount = tests.filter((t) => t.status === "PASS").length;
    const failCount = tests.filter((t) => t.status === "FAIL").length;
    const warnCount = tests.filter((t) => t.status === "WARN").length;
    const skipCount = tests.filter((t) => t.status === "SKIP").length;

    tests.forEach((test) => {
      const statusEmoji =
        test.status === "PASS" ? "✅" : test.status === "FAIL" ? "❌" : test.status === "WARN" ? "⚠️" : "⏭️";

      let message = `${statusEmoji} ${test.name}: ${test.status}`;
      if (test.details) message += ` (${test.details})`;
      if (test.error) message += ` - ${test.error}`;
      logger.info(message);
    });

    logger.info("\n" + "=".repeat(50));
    logger.info(`Results: ${passCount} PASS, ${failCount} FAIL, ${warnCount} WARN, ${skipCount} SKIP`);

    if (failCount === 0) {
      logger.success("🎉 All critical tests passed!");
    } else {
      logger.error("💥 Some tests failed. Please check the issues above.");
    }

    return {
      totalTests: tests.length,
      passed: passCount,
      failed: failCount,
      warned: warnCount,
      skipped: skipCount,
      tests,
    };
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Preparing test environment...");
    },

    async postRun(ctx, result) {
      if (result.failed === 0) {
        ctx.logger.success("✨ Test script completed successfully!");
      } else {
        ctx.logger.warn("⚠️ Test script completed with issues");
      }
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Test script failed:", error.message);
    },
  },
});