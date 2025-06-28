import { createScript } from "@pact-toolbox/script";

export default createScript({
  metadata: {
    name: "deploy-todos",
    description: "Deploy the todos contract to testnet",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["deployment", "todos", "testnet"],
  },

  autoStartNetwork: false,
  persist: false,
  profile: true,
  timeout: 300000, // 5 minutes

  async run(ctx) {
    const { logger, deployments, network, chainId, config, client } = ctx;

    logger.info(`🚀 Deploying todos contract to ${network} on chain ${chainId}`);

    // Debug network configuration
    const networkConfig = config.networks?.[network];
    logger.info(`Network config:`, {
      network,
      networkId: networkConfig?.networkId,
      rpcUrl: networkConfig?.rpcUrl,
      chainId: networkConfig?.meta?.chainId,
      hasKeyPairs: !!networkConfig?.keyPairs?.length,
    });

    // Log the resolved RPC URL
    if (networkConfig?.rpcUrl) {
      const resolvedUrl = (networkConfig.rpcUrl as string)
        .replace("{networkId}", networkConfig.networkId)
        .replace("{chainId}", networkConfig.meta?.chainId || "0");
      logger.info(`Resolved RPC URL: ${resolvedUrl}`);
    }

    // Debug client network config
    try {
      const clientNetworkConfig = client.getNetworkConfig();
      logger.info(`Client network config:`, {
        networkId: clientNetworkConfig?.networkId,
        rpcUrl: clientNetworkConfig?.rpcUrl,
        type: clientNetworkConfig?.type,
      });
    } catch (error) {
      logger.debug(`Client network config access error:`, error.message);
    }

    try {
      // Deploy the todos contract to testnet
      const result = await deployments.deploy("todos", {
        // Basic deployment options
        gasLimit: 100000,
        gasPrice: 0.00001,
        skipIfAlreadyDeployed: true,

        // Validation and verification
        validate: true,
        verify: false,

        // Namespace handling
        namespaceHandling: {
          autoCreate: false, // todos uses 'free namespace which should exist
          skipNamespaceHandling: false,
          chainId: chainId,
        },

        // Contract initialization data
        data: {
          upgrade: false, // First deployment
        },

        // Deployment hooks
        hooks: {
          preDeploy: async (contractName, source) => {
            logger.info(`📋 Pre-deploy validation for ${contractName}`);

            // 'free namespace should exist on testnet
            logger.info("Assuming 'free namespace exists on testnet");
          },

          postDeploy: async (contractName, deployResult) => {
            logger.success(`✅ ${contractName} deployed successfully!`);
            logger.info(`Transaction Hash: ${deployResult.transactionHash}`);
            logger.info(`Chain ID: ${deployResult.chainId}`);

            // On testnet, skip post-deployment testing as it requires proper signing
            if (network === "testnet") {
              logger.info("ℹ️ Skipping post-deployment test on testnet");
              logger.info("💡 You can test the contract manually using:");
              logger.info(`   - Kadena Explorer: https://explorer.chainweb.com/testnet`);
              logger.info(`   - Or use the Pact CLI with proper signing`);
            }
          },

          onError: async (contractName, error) => {
            logger.error(`❌ Deployment failed for ${contractName}:`, error);

            // Provide helpful error context
            if (error.message.includes("namespace")) {
              logger.info("💡 Tip: Ensure the 'free namespace exists on the target network");
            }

            if (error.message.includes("keyset")) {
              logger.info("💡 Tip: Check that your signer has the required capabilities");
            }
          },
        },
      });

      // Log final deployment summary
      logger.box(`
🎉 Deployment Summary

Contract: todos
Network: ${network}
Chain ID: ${chainId}
Status: ${result.transactionHash ? "SUCCESS" : "SKIPPED"}
${result.transactionHash ? `Transaction: ${result.transactionHash}` : ""}
${result.namespaceOperation ? `Namespace: ${result.namespaceOperation.namespaceName}` : ""}

🔗 Explorer: https://explorer.chainweb.com/testnet/tx/${result.transactionHash}
    `);

      return result;
    } catch (error) {
      logger.error("💥 Deployment failed:", error);
      throw error;
    }
  },
});
