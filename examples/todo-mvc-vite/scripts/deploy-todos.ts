import { createScript } from "@pact-toolbox/script";
import { readFileSync } from "node:fs";
import path from "node:path";

export default createScript({
  metadata: {
    name: "deploy-todos",
    description: "Deploy the todos contract to the blockchain",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["deployment", "contract", "todos"],
  },

  // Auto-start the DevNet if not already running
  autoStartNetwork: true,
  persist: false,

  // Script configuration
  timeout: 60000, // 1 minute timeout

  async run(ctx) {
    const { logger, deployer, currentSigner, coin } = ctx;

    logger.info("🚀 Starting todos contract deployment");
    logger.info(`📍 Network: ${ctx.network}`);
    logger.info(`🔗 Chain ID: ${ctx.chainId}`);
    logger.info(`👤 Deployer: ${currentSigner?.account}`);

    // Read the contract source
    const contractPath = path.resolve("pact/todos.pact");
    logger.info(`📄 Loading contract from: ${contractPath}`);
    const contractSource = readFileSync(contractPath, "utf-8");

    // Deploy the contract
    logger.info("📦 Deploying todos contract...");
    try {
      const tx = deployer
        .execution(contractSource)
        .withChainId(ctx.chainId as any)
        .withSigner(currentSigner?.account || "")
        .withGasLimit(100000)
        .withGasPrice(0.00001);

      const result = await tx.build().execute();

      logger.success("✅ Contract deployed successfully!");
      logger.info(`📋 Request Key: ${result.requestKey}`);

      // Wait for confirmation
      logger.info("⏳ Waiting for transaction confirmation...");
      const confirmed = await deployer.waitForTransaction(result.requestKey);

      logger.success("✅ Transaction confirmed!");
      logger.info(`Result: ${JSON.stringify(confirmed, null, 2)}`);

      // Create a test todo to verify deployment
      logger.info("🧪 Creating test todo to verify deployment...");
      const testTodoId = `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const createTx = deployer
        .execution(`(free.todos.create-todo "${testTodoId}" "Test Todo from Deployment")`)
        .withChainId(ctx.chainId as any)
        .withSigner(currentSigner?.account || "")
        .withGasLimit(10000)
        .withGasPrice(0.00001);

      const createResult = await createTx.build().execute();
      await deployer.waitForTransaction(createResult.requestKey);

      logger.success("✅ Test todo created successfully!");

      // Verify the todo was created
      const getTodoTx = deployer
        .execution(`(free.todos.get-todo "${testTodoId}")`)
        .withChainId(ctx.chainId as any);

      const todoData = await getTodoTx.build().dirtyRead();
      logger.info(`📝 Test todo data: ${JSON.stringify(todoData, null, 2)}`);

      return {
        deployed: true,
        contractPath,
        testTodoId,
        network: ctx.network,
        chainId: ctx.chainId,
      };
    } catch (error) {
      logger.error("❌ Deployment failed:", error);
      throw error;
    }
  },

  hooks: {
    async preRun(ctx) {
      ctx.logger.info("🔧 Preparing for deployment...");

      // Check if account has sufficient balance
      if (ctx.currentSigner) {
        try {
          const balanceResult = await ctx.coin.getBalance({ account: ctx.currentSigner.account });
          const balance = parseFloat(balanceResult.balance);
          ctx.logger.info(`💰 Account balance: ${balance} KDA`);

          if (balance < 0.01) {
            ctx.logger.warn("⚠️ Low balance detected. Deployment might fail.");
          }
        } catch (error) {
          ctx.logger.debug("Could not check balance (account might not exist yet)");
        }
      }
    },

    async postRun(ctx, result) {
      ctx.logger.success("🎉 Deployment script completed successfully!");
      ctx.logger.info(`📊 Result summary:`);
      ctx.logger.info(`  - Contract: ${result.contractPath}`);
      ctx.logger.info(`  - Network: ${result.network}`);
      ctx.logger.info(`  - Chain: ${result.chainId}`);
      if (result.testTodoId) {
        ctx.logger.info(`  - Test Todo ID: ${result.testTodoId}`);
      }
    },

    async onError(ctx, error) {
      ctx.logger.error("💥 Deployment script failed:", error.message);
      ctx.logger.info("💡 Troubleshooting tips:");
      ctx.logger.info("  1. Check that the DevNet is running");
      ctx.logger.info("  2. Verify your account has sufficient KDA");
      ctx.logger.info("  3. Ensure the contract syntax is valid");
      ctx.logger.info("  4. Check network connectivity");
    },
  },
});