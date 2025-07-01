import { defineCommand } from "citty";
import { initToolbox } from "@pact-toolbox/init";
import { logger } from "@pact-toolbox/node-utils";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize Pact Toolbox in your current project",
  },
  args: {
    cwd: {
      type: "string",
      name: "cwd",
      description: "Working directory path",
      required: false,
      default: process.cwd(),
    },
    contractsDir: {
      type: "string",
      name: "contractsDir",
      description: "Path to contracts directory",
      required: false,
      default: "pact",
    },
  },
  run: async ({ args }) => {
    logger.start("🚀 Initializing Pact Toolbox...");

    try {
      await initToolbox(args);

      logger.success("✅ Pact Toolbox initialized successfully!");
      logger.box(
        "Next steps:\n\n" +
        "1. Run 'pact-toolbox start' to start the local DevNet\n" +
        "2. Run 'pact-toolbox prelude' to download preludes\n" +
        "3. Run 'pact-toolbox test' to run tests\n" +
        "4. Run 'pact-toolbox doctor' to check your environment"
      );
    } catch (error) {
      logger.error("❌ Failed to initialize Pact Toolbox:", error);
      process.exit(1);
    }
  },
});
