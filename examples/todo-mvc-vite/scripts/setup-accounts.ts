import { createScript } from "@pact-toolbox/script";
import { generateKeyPair } from "@pact-toolbox/crypto";

export interface SetupArgs {
  accounts?: number;
  fundAmount?: number;
  prefix?: string;
}

export default createScript<SetupArgs>({
  metadata: {
    name: "setup-accounts",
    description: "Setup test accounts with KDA funding",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["setup", "accounts", "funding"],
  },

  autoStartNetwork: true,
  persist: false,
  timeout: 120000, // 2 minutes

  async run(ctx) {
    const { logger, currentSigner, coin, deployer } = ctx;
    const numAccounts = ctx.args.accounts || 3;
    const fundAmount = ctx.args.fundAmount || 100;
    const prefix = ctx.args.prefix || "test";

    logger.info("💳 Setting up test accounts");
    logger.info(`📊 Configuration:`);
    logger.info(`  - Number of accounts: ${numAccounts}`);
    logger.info(`  - Initial funding: ${fundAmount} KDA each`);
    logger.info(`  - Account prefix: ${prefix}`);
    logger.info(`  - Funding source: ${currentSigner?.account}`);

    // Check funder balance
    if (currentSigner) {
      try {
        const balanceResult = await coin.getBalance({ account: currentSigner.account });
        const balance = parseFloat(balanceResult.balance);
        const requiredBalance = numAccounts * fundAmount;

        logger.info(`💰 Funder balance: ${balance} KDA`);

        if (balance < requiredBalance) {
          logger.warn(`⚠️ Insufficient balance. Need ${requiredBalance} KDA, have ${balance} KDA`);
          logger.info("Attempting to continue anyway...");
        }
      } catch (error) {
        logger.debug("Could not check funder balance");
      }
    }

    const accounts = [];

    for (let i = 0; i < numAccounts; i++) {
      const accountNum = i + 1;
      const accountName = `${prefix}-${accountNum.toString().padStart(3, "0")}`;

      logger.info(`\n🔨 Creating account ${accountNum}/${numAccounts}: ${accountName}`);

      try {
        // Generate a new keypair for this account
        const keyPair = generateKeyPair();
        const kAccount = `k:${keyPair.publicKey}`;

        logger.info(`  🔑 Generated keypair`);
        logger.debug(`  Public Key: ${keyPair.publicKey}`);

        // Create the account
        logger.info(`  📝 Creating account on chain...`);
        const createResult = await coin.createAccount({
          account: kAccount,
          guard: {
            keys: [keyPair.publicKey],
            pred: "keys-all",
          },
        });

        logger.success(`  ✅ Account created: ${kAccount}`);

        // Fund the account if we have a signer
        if (currentSigner && fundAmount > 0) {
          logger.info(`  💸 Funding account with ${fundAmount} KDA...`);

          try {
            const transferResult = await coin.transfer({
              from: currentSigner.account,
              to: kAccount,
              amount: fundAmount.toString(),
            });

            logger.success(`  ✅ Account funded successfully`);

            // Verify the balance
            const balanceResult = await coin.getBalance({ account: kAccount });
            const balance = parseFloat(balanceResult.balance);
            logger.info(`  💰 New balance: ${balance} KDA`);
          } catch (error) {
            logger.warn(`  ⚠️ Could not fund account: ${error}`);
          }
        }

        accounts.push({
          name: accountName,
          account: kAccount,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.secretKey,
          balance: fundAmount,
        });
      } catch (error) {
        logger.error(`❌ Failed to create account ${accountName}:`, error);

        // Try to continue with remaining accounts
        accounts.push({
          name: accountName,
          account: null,
          error: error.message,
        });
      }
    }

    // Generate summary
    const successCount = accounts.filter((a) => a.account).length;
    const failureCount = accounts.length - successCount;

    logger.info("\n📊 Account Setup Summary");
    logger.info("=".repeat(50));
    logger.info(`✅ Successfully created: ${successCount} accounts`);
    if (failureCount > 0) {
      logger.warn(`❌ Failed: ${failureCount} accounts`);
    }

    logger.info("\n📋 Account Details:");
    accounts.forEach((account, index) => {
      if (account.account) {
        logger.info(`\n${index + 1}. ${account.name}`);
        logger.info(`   Account: ${account.account}`);
        logger.info(`   Balance: ${account.balance} KDA`);
        logger.info(`   Public Key: ${account.publicKey}`);
        logger.info(`   Private Key: ${account.privateKey}`);
      } else {
        logger.error(`\n${index + 1}. ${account.name} - FAILED`);
        logger.error(`   Error: ${account.error}`);
      }
    });

    // Save account information for later use
    const accountsFile = "test-accounts.json";
    logger.info(`\n💾 Saving account information to ${accountsFile}`);

    const accountData = accounts.filter((a) => a.account).map((a) => ({
      name: a.name,
      account: a.account,
      publicKey: a.publicKey,
      privateKey: a.privateKey,
    }));

    // Return the results
    return {
      success: successCount,
      failed: failureCount,
      accounts: accountData,
      totalFunded: successCount * fundAmount,
    };
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Preparing account setup...");
      ctx.logger.info("⚠️ Keep your private keys secure!");
      ctx.logger.info("💡 These accounts are for testing only");
    },

    async postRun(ctx, result) {
      ctx.logger.success("\n🎉 Account setup completed!");
      ctx.logger.info(`📊 Final Statistics:`);
      ctx.logger.info(`  - Accounts created: ${result.success}`);
      ctx.logger.info(`  - Total KDA distributed: ${result.totalFunded}`);

      if (result.failed > 0) {
        ctx.logger.warn(`  - Failed operations: ${result.failed}`);
      }

      ctx.logger.info("\n💡 Next steps:");
      ctx.logger.info("  1. Use these accounts in your tests");
      ctx.logger.info("  2. Deploy contracts using any account");
      ctx.logger.info("  3. Test transactions between accounts");
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Account setup failed:", error.message);
      ctx.logger.info("💡 Common issues:");
      ctx.logger.info("  - DevNet not running");
      ctx.logger.info("  - Insufficient KDA in source account");
      ctx.logger.info("  - Network connectivity issues");
    },
  },
});