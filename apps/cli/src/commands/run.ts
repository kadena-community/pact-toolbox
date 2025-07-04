import { defineCommand } from "citty";

import { runScript } from "@pact-toolbox/script";
import { logger } from "@pact-toolbox/node-utils";

export const runCommand = defineCommand({
  meta: {
    name: "run",
    description: "Run a script with the toolbox runtime",
  },
  args: {
    script: {
      type: "positional",
      name: "script",
      description: "Script to run",
      required: true,
    },
    start: {
      type: "boolean",
      name: "start",
      alias: "s",
      description: "Start the network before running the script",
      required: false,
      default: true,
    },
    network: {
      type: "string",
      name: "network",
      alias: "n",
      description: "Network to use",
      required: false,
    },
    "private-key": {
      type: "string",
      name: "private-key",
      description: "Private key for signing (hex string)",
      required: false,
    },
    account: {
      type: "string",
      name: "account",
      description: "Account name to use for transactions",
      required: false,
    },
    interactive: {
      type: "boolean",
      name: "interactive",
      alias: "i",
      description: "Use interactive TUI for signing",
      required: false,
      default: false,
    },
  },
  run: async ({ args }) => {
    const { script, network, start, "private-key": privateKey, account, interactive, ...rest } = args;
    logger.start(`Running script ${script} ${network ? `on network ${network}` : ""}`);
    try {
      await runScript(script, {
        network,
        args: rest,
        signing: {
          privateKey,
          account,
          interactive,
        },
        scriptOptions: {
          autoStartNetwork: start,
        },
      });
    } catch (error) {
      logger.error(`Error running script ${script}:`, error);
      process.exit(1);
    }
    logger.success(`Script ${script} finished`);
    process.exit(0);
  },
});
