import { createScript } from "@pact-toolbox/script";

/**
 * Test script to demonstrate wallet argument handling
 *
 * Usage examples:
 *   # With private key
 *   pact-toolbox script wallet-test.ts -k YOUR_PRIVATE_KEY
 *
 *   # With public key only (read-only)
 *   pact-toolbox script wallet-test.ts -p YOUR_PUBLIC_KEY
 *
 *   # With account override
 *   pact-toolbox script wallet-test.ts -k YOUR_KEY -a sender00
 *
 *   # Interactive mode
 *   pact-toolbox script wallet-test.ts -i
 *
 *   # Skip wallet entirely
 *   pact-toolbox script wallet-test.ts --skip-wallet
 *
 *   # From environment
 *   PACT_PRIVATE_KEY=YOUR_KEY pact-toolbox script wallet-test.ts
 */

export default createScript({
  metadata: {
    name: "wallet-test",
    description: "Test wallet configuration and argument handling",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["test", "wallet", "configuration"],
  },

  autoStartNetwork: false,
  persist: false,
  timeout: 10000,

  async run(ctx) {
    const { logger, wallet, currentSigner, coin } = ctx;

    logger.info("🔐 Wallet Configuration Test");
    logger.info("=" .repeat(50));

    // Check if wallet is available
    if (wallet) {
      const walletInstance = wallet.getWallet();
      if (walletInstance) {
        logger.success("✅ Wallet initialized successfully");
        logger.info("   Type: Keypair Wallet");
      } else {
        logger.info("📖 Running in read-only mode (no private key)");
      }
    } else {
      logger.warn("⚠️ No wallet configured");
    }

    // Check signer information
    if (currentSigner) {
      logger.info("\n👤 Current Signer:");
      logger.info(`   Account: ${currentSigner.account}`);
      logger.info(`   Public Key: ${currentSigner.publicKey}`);

      if (currentSigner.capabilities && currentSigner.capabilities.length > 0) {
        logger.info(`   Capabilities: ${currentSigner.capabilities.length}`);
        currentSigner.capabilities.forEach((cap, i) => {
          logger.info(`     ${i + 1}. ${cap.name}(${cap.args.join(", ")})`);
        });
      } else {
        logger.info("   Capabilities: None");
      }

      // Try to check balance if we have coin contract
      if (coin) {
        try {
          logger.info("\n💰 Checking Balance...");
          const balanceResult = await coin.getBalance({ account: currentSigner.account });
          const balance = parseFloat(balanceResult.balance);
          logger.success(`   Balance: ${balance} KDA`);
        } catch (error) {
          logger.debug("   Could not check balance (account might not exist)");
        }
      }
    } else {
      logger.info("\n👤 No signer configured");
      logger.info("   Running without signing capabilities");
    }

    // Test read operations (should work even without wallet)
    logger.info("\n🧪 Testing Read Operations...");
    try {
      const result = await ctx.deployer
        .execution("(+ 1 2)")
        .withChainId(ctx.chainId as any)
        .build()
        .dirtyRead();

      if (result.result === 3) {
        logger.success("✅ Read operations: Working");
      } else {
        logger.error("❌ Read operations: Unexpected result");
      }
    } catch (error) {
      logger.error("❌ Read operations: Failed", error);
    }

    // Test write operations (requires wallet)
    if (currentSigner && wallet.getWallet()) {
      logger.info("\n🧪 Testing Write Capabilities...");
      logger.success("✅ Write operations: Available");
      logger.info("   Can sign transactions with current signer");
    } else if (currentSigner && !wallet.getWallet()) {
      logger.info("\n🧪 Testing Write Capabilities...");
      logger.warn("⚠️ Write operations: Limited");
      logger.info("   Have public key but no private key");
      logger.info("   Cannot sign transactions");
    } else {
      logger.info("\n🧪 Testing Write Capabilities...");
      logger.info("ℹ️ Write operations: Not available");
      logger.info("   No signer configured");
    }

    // Summary
    logger.info("\n" + "=" .repeat(50));
    logger.info("📊 Configuration Summary:");
    logger.info(`   Network: ${ctx.network}`);
    logger.info(`   Chain ID: ${ctx.chainId}`);
    logger.info(`   Wallet Status: ${wallet?.getWallet() ? "Active" : currentSigner ? "Read-Only" : "None"}`);
    logger.info(`   Signer: ${currentSigner ? currentSigner.account : "None"}`);

    return {
      hasWallet: !!wallet?.getWallet(),
      hasSigner: !!currentSigner,
      signerAccount: currentSigner?.account || null,
      signerPublicKey: currentSigner?.publicKey || null,
      canSign: !!wallet?.getWallet(),
      canRead: true,
    };
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Initializing wallet test...");
    },

    async postRun(ctx, result) {
      ctx.logger.success("\n✨ Wallet test completed");
      if (result.canSign) {
        ctx.logger.info("   You can perform both read and write operations");
      } else if (result.hasSigner) {
        ctx.logger.info("   You can perform read operations only");
      } else {
        ctx.logger.info("   Limited to read-only operations without account context");
      }
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Wallet test failed:", error.message);
      ctx.logger.info("\n💡 Troubleshooting:");
      ctx.logger.info("   1. Check your private key format (64 hex chars)");
      ctx.logger.info("   2. Verify environment variables are set");
      ctx.logger.info("   3. Try interactive mode with -i flag");
      ctx.logger.info("   4. Use --skip-wallet for read-only operations");
    },
  },
});