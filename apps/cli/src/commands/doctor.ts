/**
 * @fileoverview Doctor command for system health checks
 *
 * The doctor command performs comprehensive system health checks to ensure
 * all required dependencies and tools are properly installed and configured
 * for Pact development.
 *
 * Checks performed:
 * - Pact compiler installation and version
 * - Docker daemon availability
 * - Node.js version compatibility
 * - pnpm package manager
 *
 * @author Pact Toolbox Team
 */

import { defineCommand } from "citty";
import { installPact, isAnyPactInstalled, logger } from "@pact-toolbox/node-utils";
import { execSync } from "child_process";

/**
 * Interface for system check results
 */
interface SystemCheck {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  fixable?: boolean;
}

/**
 * Checks if Docker is installed and running
 * @returns {boolean} True if Docker is available, false otherwise
 */
function isDockerInstalled(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if Node.js version meets minimum requirements
 * @returns {SystemCheck} Check result with status and message
 */
function checkNodeVersion(): SystemCheck {
  const currentVersion = process.version;
  const versionPart = currentVersion.substring(1).split(".")[0];
  if (!versionPart) {
    return {
      name: "Node.js",
      status: "error",
      message: "Unable to determine Node.js version",
    };
  }
  const majorVersion = parseInt(versionPart);
  const minVersion = 22;

  if (majorVersion >= minVersion) {
    return {
      name: "Node.js",
      status: "ok",
      message: `Node.js ${currentVersion} (✓ >= ${minVersion}.0.0)`,
    };
  }

  return {
    name: "Node.js",
    status: "warning",
    message: `Node.js ${currentVersion} (requires >= ${minVersion}.0.0)`,
    fixable: true,
  };
}

/**
 * Checks if pnpm is installed
 * @returns {SystemCheck} Check result with status and message
 */
function checkPnpm(): SystemCheck {
  try {
    const version = execSync("pnpm --version", { encoding: "utf8", stdio: "pipe" }).trim();
    return {
      name: "pnpm",
      status: "ok",
      message: `pnpm ${version} ✓`,
    };
  } catch {
    return {
      name: "pnpm",
      status: "warning",
      message: "pnpm not found (recommended for monorepo development)",
      fixable: true,
    };
  }
}

/**
 * Doctor command definition
 *
 * Performs comprehensive system health checks and provides
 * actionable feedback for any issues found.
 */
export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Check system dependencies and configuration for Pact development",
  },
  run: async () => {
    logger.info("🔍 Running Pact Toolbox system diagnostics...");
    logger.info("");

    const checks: SystemCheck[] = [];

    // Check Node.js version
    checks.push(checkNodeVersion());

    // Check pnpm
    checks.push(checkPnpm());

    // Check Pact installation
    const isInstalled = await isAnyPactInstalled();
    if (isInstalled) {
      checks.push({
        name: "Pact",
        status: "ok",
        message: "Pact compiler ✓",
      });
    } else {
      checks.push({
        name: "Pact",
        status: "error",
        message: "Pact compiler not found",
        fixable: true,
      });
    }

    // Check Docker
    const isDockerOk = isDockerInstalled();
    if (isDockerOk) {
      checks.push({
        name: "Docker",
        status: "ok",
        message: "Docker ✓",
      });
    } else {
      checks.push({
        name: "Docker",
        status: "warning",
        message: "Docker not found (required for local development networks)",
        fixable: true,
      });
    }

    // Display results
    for (const check of checks) {
      const icon = check.status === "ok" ? "✅" : check.status === "warning" ? "⚠️" : "❌";
      logger.info(`${icon} ${check.name}: ${check.message}`);
    }

    // Handle fixable issues
    const hasErrors = checks.some((c) => c.status === "error");
    const hasWarnings = checks.some((c) => c.status === "warning");

    if (hasErrors || hasWarnings) {
      logger.info("");
      logger.warn("Issues found that may affect development:");

      // Offer to install Pact if missing
      if (!isInstalled) {
        const answer = await logger.prompt("Would you like to install the latest Pact version?", {
          type: "confirm",
          default: true,
        });
        if (answer === true) {
          await installPact();
          logger.success("Pact installed successfully!");
        }
      }

      // Provide recommendations
      logger.info("");
      logger.info("💡 Recommendations:");
      if (!isDockerOk) {
        logger.info("• Install Docker to enable local development networks");
        logger.info("  https://docs.docker.com/get-docker/");
      }

      const pnpmCheck = checks.find((c) => c.name === "pnpm");
      if (pnpmCheck?.status === "warning") {
        logger.info("• Install pnpm for better monorepo support:");
        logger.info("  npm install -g pnpm");
      }

      const nodeCheck = checks.find((c) => c.name === "Node.js");
      if (nodeCheck?.status === "warning") {
        logger.info("• Update Node.js to version 22 or higher:");
        logger.info("  https://nodejs.org/");
      }
    }

    logger.info("");
    if (!hasErrors) {
      logger.box("🎉 Your system is ready for Pact development!");
    } else {
      logger.box("⚠️  Please address the errors above before continuing.");
    }
  },
});
