#!/usr/bin/env tsx

/**
 * @fileoverview Main CLI entry point for Pact Toolbox
 *
 * This file defines the primary command structure for the Pact Toolbox CLI,
 * providing a comprehensive set of tools for Pact smart contract development,
 * testing, and deployment on the Kadena blockchain.
 *
 * @author Pact Toolbox Team
 * @version 0.3.0
 */

import { defineCommand, runMain } from "citty";
import { logger } from "@pact-toolbox/node-utils";
import packageJson from "../package.json" with { type: "json" };

// Add global error handler
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

/**
 * Main CLI command definition with all subcommands
 *
 * The CLI provides the following commands:
 * - doctor: System health check and dependency verification
 * - init: Initialize a new Pact project
 * - start: Start local development network
 * - prelude: Download and manage Pact preludes
 * - run: Execute Pact scripts and deployments
 * - test: Run Pact contract tests
 * - generate: Generate boilerplate code for contracts and modules
 */
const main = defineCommand({
  meta: {
    name: "pact-toolbox",
    description: "A comprehensive toolkit for Pact smart contract development on Kadena blockchain",
    version: packageJson.version,
  },
  args: {
    version: {
      type: "boolean",
      name: "version",
      alias: "v",
      description: "Show version information",
      required: false,
    },
    help: {
      type: "boolean",
      name: "help",
      alias: "h",
      description: "Show help information",
      required: false,
    },
  },
  run: async ({ args }) => {
    if (args.version) {
      console.log(`Pact Toolbox v${packageJson.version}`);
      process.exit(0);
    }

    // Show help by default if no subcommand
    logger.box(
      `Pact Toolbox v${packageJson.version}\n\n` +
      "Available commands:\n" +
      "  init       - Initialize a new Pact project\n" +
      "  doctor     - Check system requirements\n" +
      "  start      - Start local DevNet\n" +
      "  prelude    - Download Pact preludes\n" +
      "  run        - Execute Pact scripts\n" +
      "  test       - Run tests\n" +
      "  generate   - Generate code templates\n\n" +
      "Run 'pact-toolbox <command> --help' for more info"
    );
  },
  subCommands: {
    doctor: async () => (await import("./commands/doctor")).doctorCommand,
    init: async () => (await import("./commands/init")).initCommand,
    start: async () => (await import("./commands/start")).startCommand,
    prelude: async () => (await import("./commands/prelude")).preludeCommand,
    run: async () => (await import("./commands/run")).runCommand,
    test: async () => (await import("./commands/test")).testCommand,
    generate: async () => (await import("./commands/generate")).generateCommand,
  },
});

runMain(main).catch((error) => {
  logger.error("CLI Error:", error);
  process.exit(1);
});
