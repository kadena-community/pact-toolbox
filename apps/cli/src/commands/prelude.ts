import { defineCommand } from "citty";
import { join } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { downloadAllPreludes } from "@pact-toolbox/prelude";
import { createPactDeployer } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";

export const preludeCommand = defineCommand({
  meta: {
    name: "download",
    description: "Download configured preludes",
  },
  args: {
    network: {
      type: "string",
      name: "network",
      alias: "n",
      description: "Network to use for prelude deployment",
      required: false,
    },
    force: {
      type: "boolean",
      name: "force",
      alias: "f",
      description: "Force re-download even if preludes are cached",
      required: false,
      default: false,
    },
    clean: {
      type: "boolean",
      name: "clean",
      alias: "c",
      description: "Clean cache before downloading",
      required: false,
      default: false,
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();
    const deployer = createPactDeployer(config, args.network);

    logger.start("Downloading preludes...");

    const start = performance.now();

    try {
      await downloadAllPreludes(
        {
          deployer,
          contractsDir: config.contractsDir ?? "pact",
          preludes: config.preludes ?? [],
        },
        {
          forceDownload: args.force,
          cleanCache: args.clean,
          validateChecksums: true,
        },
      );

      const end = performance.now();
      const duration = Math.round(end - start) / 1000;

      logger.success(`✅ All preludes downloaded successfully in ${duration}s`);
      logger.box(
        `Preludes are ready! 🎉\n\n` +
          `📁 Location: ${join(process.cwd(), config.contractsDir ?? "pact", "prelude")}\n` +
          `📝 Load in REPL: ${join(config.contractsDir ?? "pact", "prelude", "init.repl")}\n\n` +
          `Next steps:\n` +
          `• Run 'pact-toolbox test' to test your contracts\n` +
          `• Run 'pact-toolbox run' to run scripts`,
      );
    } catch (error) {
      const end = performance.now();
      const duration = Math.round(end - start) / 1000;

      logger.error(`Failed to download preludes after ${duration}s`);
      logger.error(error);

      process.exit(1);
    }
  },
});
