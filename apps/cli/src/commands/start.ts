import { defineCommand } from "citty";

import { resolveConfig } from "@pact-toolbox/config";
import { createNetwork } from "@pact-toolbox/network";
import { clear, boxMessage, log } from "@pact-toolbox/node-utils";

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
    const { network, quiet, tunnel } = args;
    
    // Show startup message if not in quiet mode
    if (!quiet && !tunnel) {
      clear();
      boxMessage("Pact Toolbox DevNet", ["Starting development network..."]);
      log("info", "cli", "Starting Pact Toolbox DevNet...");
    }
    
    const networkInstance = await createNetwork(config, {
      detached: !quiet && !tunnel,
      logAccounts: true,
      autoStart: true,
      network,
    });
    
    // Setup cleanup handlers
    const cleanup = async () => {
      log("info", "cli", "Shutting down network...");
      try {
        await networkInstance.stop();
        log("success", "cli", "Network stopped successfully");
      } catch (error) {
        log("error", "cli", "Error stopping network:", error);
      }
      process.exit(0);
    };

    // Register signal handlers for graceful shutdown
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("exit", () => {
      // Synchronous cleanup if needed
    });
    
    if (!quiet && !tunnel) {
      log("info", "cli", "DevNet started successfully");
      // Display network information
      boxMessage("Network Started", [
        `DevNet is running at: http://localhost:${networkInstance.getPort()}`,
        `Network ID: ${networkInstance.getNetworkName()}`,
        "Status: running",
        "",
        "Press Ctrl+C to stop"
      ]);
    }
    
    if (quiet || tunnel) {
      process.exit(0);
    } else {
      await new Promise(() => {
        // keep the process alive
      });
    }
  },
});
