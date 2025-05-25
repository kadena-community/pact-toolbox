import { resolveConfig } from "@pact-toolbox/config";
import { createPactToolboxNetwork, PactToolboxNetwork } from "@pact-toolbox/network";
import { logger } from "@pact-toolbox/utils";

async function startNetwork() {
  let isCleaningUp = false;
  let network: PactToolboxNetwork | undefined;
  try {
    const resolvedConfig = await resolveConfig();
    network = await createPactToolboxNetwork(resolvedConfig, {
      autoStart: false,
      cleanup: false,
    });
    function handleShutdown(signal: string) {
      if (isCleaningUp) {
        return;
      }
      isCleaningUp = true;
      logger.info(`\n${signal} received. Shutting down network...`);
      network
        ?.stop()
        .catch((error) => {
          logger.error(`Error during cleanup after failed start:`, error);
        })
        .finally(() => {
          process.exit(0);
        });
    }

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("exit", () => {
      logger.info("Pact network stopped successfully in a separate process.");
    });

    await network.start();
    logger.info("Pact network started successfully in a separate process.");
  } catch (error) {
    logger.error(`Failed to start network ${network?.id}:`, error);
    if (!isCleaningUp && network) {
      network
        .stop()
        .catch((cleanupError) => {
          logger.error(`Error during cleanup after failed start:`, cleanupError);
        })
        .finally(() => {
          process.exit(1);
        });
    }
  }
}

startNetwork().catch((error) => {
  logger.error(`Error during cleanup after failed start:`, error);
  process.exit(1);
});
