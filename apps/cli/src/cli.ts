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
import packageJson from "../package.json" with { type: "json" };

/**
 * Main CLI command definition with all subcommands
 *
 * The CLI provides the following commands:
 * - doctor: System health check and dependency verification
 * - init: Initialize a new Pact project
 * - start: Start local development network
 * - prelude: Generate TypeScript types from Pact contracts
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

runMain(main);
