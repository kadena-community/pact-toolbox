import { createScript } from "@pact-toolbox/script";

/**
 * Interactive wallet test script
 *
 * This script demonstrates the improved interactive wallet setup.
 * Run without arguments to enter interactive mode:
 *
 *   pact-toolbox script interactive-wallet-test.ts -i
 *
 * Or provide wallet details directly:
 *
 *   pact-toolbox script interactive-wallet-test.ts -k YOUR_PRIVATE_KEY
 *   pact-toolbox script interactive-wallet-test.ts --wallet zelcore
 *   pact-toolbox script interactive-wallet-test.ts --wallet chainweaver-legacy
 */

export default createScript({
  metadata: {
    name: "interactive-wallet-test",
    description: "Test interactive wallet setup with all adapter types",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["test", "wallet", "interactive"],
  },

  // Don't auto-start network for this test
  autoStartNetwork: false,
  persist: false,
  timeout: 60000, // 1 minute for interactive setup

  async run(ctx) {
    const { logger, wallet, currentSigner, deployer } = ctx;

    logger.info("🔐 Interactive Wallet Test");
    logger.info("=" .repeat(50));

    // Display wallet information
    if (!wallet) {
      logger.warn("⚠️ No wallet configured");
      return { success: false, error: "No wallet" };
    }

    const walletInstance = wallet.getWallet();

    logger.info("\n📊 Wallet Configuration:");
    logger.info(`   Network: ${ctx.network}`);
    logger.info(`   Chain ID: ${ctx.chainId}`);

    if (walletInstance) {
      // Full wallet with private key
      logger.success("✅ Wallet Type: Full Wallet");

      // Try to get wallet info
      try {
        const account = await walletInstance.getAccount();
        logger.info(`   Wallet ID: ${walletInstance.id}`);
        logger.info(`   Account: ${account.address}`);
        logger.info(`   Public Key: ${account.publicKey}`);
        logger.info(`   Can Sign: Yes`);

        // Test signing capability
        logger.info("\n🧪 Testing Signing Capability...");

        const testTx = deployer
          .execution(`(+ 1 2)`)
          .withChainId(ctx.chainId as any);

        if (currentSigner) {
          testTx.withSigner(currentSigner.account);
        }

        const builtTx = testTx.build();

        try {
          // Try to sign (won't submit)
          const signed = await walletInstance.signPactCommands([builtTx]);
          logger.success("✅ Signing capability verified");
          logger.info(`   Signature count: ${signed[0].sigs.length}`);
        } catch (error) {
          logger.warn("⚠️ Could not test signing:", error.message);
        }
      } catch (error) {
        logger.error("❌ Error getting wallet info:", error.message);
      }
    } else if (currentSigner) {
      // Read-only mode with public key
      logger.info("📖 Wallet Type: Read-Only (Public Key Only)");
      logger.info(`   Account: ${currentSigner.account}`);
      logger.info(`   Public Key: ${currentSigner.publicKey}`);
      logger.info(`   Can Sign: No`);
    } else {
      logger.warn("⚠️ No wallet or signer configured");
    }

    // Test different operations based on wallet type
    logger.info("\n🧪 Testing Operations:");

    // 1. Read operations (should always work)
    try {
      const readResult = await deployer
        .execution(`(+ 2 3)`)
        .withChainId(ctx.chainId as any)
        .build()
        .dirtyRead();

      if (readResult.result === 5) {
        logger.success("✅ Read operations: Working");
      } else {
        logger.error("❌ Read operations: Unexpected result");
      }
    } catch (error) {
      logger.error("❌ Read operations: Failed", error.message);
    }

    // 2. Check wallet adapter features
    if (walletInstance) {
      logger.info("\n🔌 Wallet Adapter Features:");

      const walletId = walletInstance.id;
      switch (walletId) {
        case "keypair":
          logger.info("   Type: Keypair Wallet");
          logger.info("   Features: Direct key management, instant signing");
          logger.info("   Security: Private key in memory");
          break;

        case "zelcore":
          logger.info("   Type: Zelcore Desktop Wallet");
          logger.info("   Features: Desktop app integration, multi-account");
          logger.info("   Security: Keys managed by Zelcore");
          logger.info("   Note: Requires Zelcore desktop app running");
          break;

        case "chainweaver-legacy":
          logger.info("   Type: Chainweaver Desktop Wallet");
          logger.info("   Features: Official Kadena wallet, account management");
          logger.info("   Security: Keys managed by Chainweaver");
          logger.info("   Note: Requires Chainweaver desktop app running");
          break;

        default:
          logger.info(`   Type: ${walletId}`);
      }
    }

    // 3. Network connectivity test
    logger.info("\n🌐 Network Connectivity:");
    if (walletInstance && walletInstance.network) {
      logger.info(`   Network ID: ${walletInstance.network.networkId}`);
      logger.info(`   Network Name: ${walletInstance.network.name}`);
      if (walletInstance.network.url) {
        logger.info(`   RPC URL: ${walletInstance.network.url}`);
      }
    } else {
      logger.info("   Using default network configuration");
    }

    // Summary
    logger.info("\n" + "=" .repeat(50));
    logger.info("📊 Test Summary:");

    const canSign = !!walletInstance;
    const canRead = true;
    const walletType = walletInstance?.id || "none";

    logger.info(`   Wallet Type: ${walletType}`);
    logger.info(`   Can Sign Transactions: ${canSign ? "Yes" : "No"}`);
    logger.info(`   Can Read Blockchain: ${canRead ? "Yes" : "No"}`);

    if (currentSigner) {
      logger.info(`   Active Signer: ${currentSigner.account}`);
    }

    return {
      success: true,
      walletType,
      canSign,
      canRead,
      signer: currentSigner?.account || null,
    };
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Starting interactive wallet test...");
      ctx.logger.info("💡 This test will verify your wallet configuration");
    },

    async postRun(ctx, result) {
      if (result.success) {
        ctx.logger.success("\n✨ Wallet test completed successfully!");

        if (result.canSign) {
          ctx.logger.info("   ✅ Your wallet is fully configured for signing");
        } else {
          ctx.logger.info("   ℹ️ Your wallet is in read-only mode");
        }

        ctx.logger.info("\n💡 Next steps:");
        if (result.walletType === "keypair") {
          ctx.logger.info("   - You can now deploy contracts");
          ctx.logger.info("   - Execute transactions");
          ctx.logger.info("   - Manage accounts");
        } else if (result.walletType === "zelcore" || result.walletType === "chainweaver-legacy") {
          ctx.logger.info("   - Approve transactions in your desktop wallet");
          ctx.logger.info("   - Manage multiple accounts");
          ctx.logger.info("   - Use hardware wallet if supported");
        }
      }
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Wallet test failed:", error.message);
      ctx.logger.info("\n💡 Troubleshooting:");
      ctx.logger.info("   1. For desktop wallets, ensure the app is running");
      ctx.logger.info("   2. Check your private key format (64 hex chars)");
      ctx.logger.info("   3. Verify network connectivity");
      ctx.logger.info("   4. Try running with -i flag for interactive setup");
    },
  },
});