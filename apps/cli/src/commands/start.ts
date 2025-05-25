import { defineCommand } from "citty";

import { resolveConfig } from "@pact-toolbox/config";
import { startLocalNetwork } from "@pact-toolbox/network";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start a configured network locally",
  },
  args: {
    network: {
      type: "positional",
      name: "version",
      description: "Network to start",
      required: false,
      default: "local",
    },
    quiet: {
      type: "boolean",
      name: "quiet",
      alias: "q",
      description: "Silence logs",
      required: false,
    },
    tunnel: {
      type: "boolean",
      name: "tunnel",
      alias: "t",
      description: "Start a cloudflare tunnel to the network",
      required: false,
      default: false,
    },
    clipboard: {
      type: "boolean",
      name: "clipboard",
      alias: "c",
      description: "Copy the network url to the clipboard",
      required: false,
      default: true,
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();
    const { network, quiet, tunnel, clipboard } = args;
    await startLocalNetwork(config, {
      isDetached: !quiet && !tunnel,
      logAccounts: true,
      network,
      conflictStrategy: "replace",
      devProxyOptions: {
        showURL: true,
        isProd: false,
        tunnel,
        clipboard,
      },
    });
    if (quiet || tunnel) {
      process.exit(0);
    } else {
      await new Promise(() => {
        // keep the process alive
      });
    }
  },
});
