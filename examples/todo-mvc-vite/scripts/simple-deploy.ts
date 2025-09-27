import { createScript } from "@pact-toolbox/script";
import { readFileSync } from "node:fs";
import path from "node:path";

export default createScript({
  metadata: {
    name: "simple-deploy",
    description: "Simple deploy script using correct API",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["deployment", "simple"],
  },

  autoStartNetwork: true,
  persist: false,
  timeout: 60000,

  async run(ctx) {
    const { logger, deployer, currentSigner } = ctx;

    logger.info("🚀 Starting simple deployment");
    logger.info(`📍 Network: ${ctx.network}`);
    logger.info(`🔗 Chain ID: ${ctx.chainId}`);
    logger.info(`👤 Deployer: ${currentSigner?.account}`);

    // Read the contract source
    const contractPath = path.resolve("pact/todos.pact");
    logger.info(`📄 Loading contract from: ${contractPath}`);
    const contractSource = readFileSync(contractPath, "utf-8");

    try {
      // Use the correct deployer API based on what I saw in the deployer source
      logger.info("📦 Deploying todos contract...");

      const tx = deployer
        .execution(contractSource)
        .withChainId(ctx.chainId as any)
        .withMeta({
          gasLimit: 100000,
          gasPrice: 0.00001,
          ttl: 600
        });

      if (currentSigner) {
        tx.withSigner({
          account: currentSigner.account,
          publicKey: currentSigner.publicKey,
          secretKey: currentSigner.secretKey,
          capabilities: [{
            name: "coin.GAS",
            args: []
          }]
        });
      }

      const result = await tx.build().execute();

      logger.success("✅ Contract deployed successfully!");
      logger.info(`📋 Request Key: ${result.requestKey}`);

      // Wait for confirmation
      logger.info("⏳ Waiting for transaction confirmation...");
      const confirmed = await deployer.waitForTransaction(result.requestKey);

      logger.success("✅ Transaction confirmed!");
      logger.info(`Result: ${JSON.stringify(confirmed, null, 2)}`);

      return {
        deployed: true,
        contractPath,
        network: ctx.network,
        chainId: ctx.chainId,
        requestKey: result.requestKey,
      };
    } catch (error) {
      logger.error("❌ Deployment failed:", error);
      throw error;
    }
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Preparing for simple deployment...");
    },

    async postRun(ctx, result) {
      ctx.logger.success("🎉 Simple deployment completed successfully!");
      ctx.logger.info(`📊 Result summary:`);
      ctx.logger.info(`  - Contract: ${result.contractPath}`);
      ctx.logger.info(`  - Network: ${result.network}`);
      ctx.logger.info(`  - Chain: ${result.chainId}`);
      ctx.logger.info(`  - Request Key: ${result.requestKey}`);
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Simple deployment failed:", error.message);
    },
  },
});