/**
 * Comprehensive cross-runtime environment detection utilities
 * Provides reliable detection across Node.js, Deno, Bun, browsers, and various test frameworks
 */

/**
 * Runtime type detection
 */
export type Runtime = "node" | "deno" | "bun" | "browser" | "webworker" | "unknown";
export type Environment = "production" | "development" | "test" | "staging" | "preview";
export type TestFramework = "vitest" | "jest" | "mocha" | "jasmine" | "playwright" | "cypress" | "none";

/**
 * Check if code is running in a browser environment
 * Reliable detection that works across all browsers and avoids false positives
 */
export function isBrowser(): boolean {
  try {
    // Most reliable: check for window and document objects with proper type checks
    return (
      typeof globalThis !== "undefined" &&
      typeof globalThis.window !== "undefined" &&
      globalThis.window === globalThis &&
      typeof globalThis.document !== "undefined" &&
      typeof globalThis.document.createElement === "function" &&
      typeof globalThis.navigator !== "undefined" &&
      typeof globalThis.navigator.userAgent === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Check if code is running in a Web Worker environment
 */
export function isWebWorker(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as any).WorkerGlobalScope !== "undefined" &&
      typeof (globalThis as any).importScripts === "function" &&
      (typeof globalThis.window === "undefined" || globalThis.window !== globalThis)
    );
  } catch {
    return false;
  }
}

/**
 * Check if code is running in Node.js
 * Detects actual Node.js runtime, not just process object presence
 */
export function isNode(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof globalThis.process !== "undefined" &&
      typeof globalThis.process.versions !== "undefined" &&
      typeof globalThis.process.versions.node === "string" &&
      typeof globalThis.process.release !== "undefined" &&
      globalThis.process.release.name === "node" &&
      !isBun() && // Bun also has process.versions.node
      !isDeno() // Deno can have process polyfill
    );
  } catch {
    return false;
  }
}

/**
 * Check if code is running in Deno
 */
export function isDeno(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as any).Deno !== "undefined" &&
      typeof (globalThis as any).Deno.version === "object" &&
      typeof (globalThis as any).Deno.version.deno === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Check if code is running in Bun
 */
export function isBun(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as any).Bun !== "undefined" &&
      typeof (globalThis as any).Bun.version === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Detect the current runtime
 */
export function getRuntime(): Runtime {
  if (isBrowser()) return "browser";
  if (isWebWorker()) return "webworker";
  if (isNode()) return "node";
  if (isDeno()) return "deno";
  if (isBun()) return "bun";
  return "unknown";
}

/**
 * Check if running on localhost or local network
 */
export function isLocalhost(): boolean {
  if (!isBrowser()) return false;

  try {
    const hostname = globalThis.location?.hostname || "";
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" || // IPv6 localhost
      hostname.startsWith("192.168.") || // Local network
      hostname.startsWith("10.") || // Local network
      hostname.startsWith("172.") || // Local network (172.16.0.0 - 172.31.255.255)
      hostname.endsWith(".local") || // mDNS local domain
      hostname === "" // file:// protocol
    );
  } catch {
    return false;
  }
}

/**
 * Get the current environment (production, development, test, etc.)
 */
export function getEnvironment(): Environment {
  // Check for explicit NODE_ENV
  if (typeof globalThis.process !== "undefined" && globalThis.process.env) {
    const nodeEnv = globalThis.process.env['NODE_ENV']?.toLowerCase();
    if (nodeEnv === "production" || nodeEnv === "prod") return "production";
    if (nodeEnv === "development" || nodeEnv === "dev") return "development";
    if (nodeEnv === "test") return "test";
    if (nodeEnv === "staging") return "staging";
    if (nodeEnv === "preview") return "preview";
  }

  // Check for Deno environment
  if (isDeno()) {
    const denoEnv = (globalThis as any).Deno?.env?.get?.("DENO_ENV");
    if (denoEnv === "production") return "production";
    if (denoEnv === "development") return "development";
    if (denoEnv === "test") return "test";
  }

  // Check for build-time flags
  if (typeof (globalThis as any).__DEV__ === "boolean") {
    return (globalThis as any).__DEV__ ? "development" : "production";
  }

  // Check for test environment indicators
  if (isTest()) return "test";

  // Browser environment checks
  if (isBrowser()) {
    // Check for localhost/development indicators
    if (isLocalhost()) return "development";

    // Check for common development ports
    const port = globalThis.location?.port;
    if (port && ["3000", "3001", "4000", "5000", "5173", "8000", "8080", "9000"].includes(port)) {
      return "development";
    }

    // Check for development domains
    const hostname = globalThis.location?.hostname || "";
    if (
      hostname.includes("dev.") ||
      hostname.includes("development.") ||
      hostname.includes("staging.") ||
      hostname.includes("preview.")
    ) {
      if (hostname.includes("staging.")) return "staging";
      if (hostname.includes("preview.")) return "preview";
      return "development";
    }

    // Default to production for browser
    return "production";
  }

  // Default to development for non-browser environments
  return "development";
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironment() === "development";
}

/**
 * Alias for isDevelopment for backward compatibility
 */
export const isDev = isDevelopment;

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getEnvironment() === "production";
}

/**
 * Check if running in staging mode
 */
export function isStaging(): boolean {
  return getEnvironment() === "staging";
}

/**
 * Check if running in preview mode
 */
export function isPreview(): boolean {
  return getEnvironment() === "preview";
}

/**
 * Detect which test framework is being used
 */
export function getTestFramework(): TestFramework {
  // Vitest detection
  if (
    typeof globalThis.process !== "undefined" &&
    (globalThis.process.env?.['VITEST'] === "true" ||
      typeof (globalThis as any).__vitest_worker__ !== "undefined" ||
      typeof (globalThis as any).__vitest__ !== "undefined")
  ) {
    return "vitest";
  }

  // Jest detection
  if (
    typeof globalThis.process !== "undefined" &&
    (globalThis.process.env?.['JEST_WORKER_ID'] !== undefined ||
      typeof (globalThis as any).jest !== "undefined" ||
      (typeof (globalThis as any).expect !== "undefined" &&
        typeof (globalThis as any).expect.getState === "function"))
  ) {
    return "jest";
  }

  // Playwright detection
  if (
    typeof globalThis.process !== "undefined" &&
    (globalThis.process.env?.['PLAYWRIGHT_TEST_BASE_URL'] !== undefined ||
      typeof (globalThis as any).__playwright !== "undefined")
  ) {
    return "playwright";
  }

  // Cypress detection
  if (typeof (globalThis as any).cy !== "undefined" || typeof (globalThis as any).Cypress !== "undefined") {
    return "cypress";
  }

  // Mocha detection
  if (
    typeof (globalThis as any).mocha !== "undefined" ||
    (typeof (globalThis as any).describe === "function" && typeof (globalThis as any).it === "function")
  ) {
    return "mocha";
  }

  // Jasmine detection
  if (typeof (globalThis as any).jasmine !== "undefined") {
    return "jasmine";
  }

  return "none";
}

/**
 * Check if running in any test environment
 */
export function isTest(): boolean {
  // Check NODE_ENV directly to avoid circular dependency with getEnvironment()
  if (typeof globalThis.process !== "undefined" && globalThis.process.env?.['NODE_ENV'] === "test") {
    return true;
  }

  // Check for test framework indicators
  return getTestFramework() !== "none";
}

/**
 * Alias for isTest for backward compatibility
 */
export const isTestEnvironment = isTest;

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  if (typeof globalThis.process === "undefined" || !globalThis.process.env) {
    return false;
  }

  const env = globalThis.process.env;
  return (
    env['CI'] === "true" ||
    env['CI'] === "1" ||
    env['CONTINUOUS_INTEGRATION'] === "true" ||
    env['GITHUB_ACTIONS'] === "true" ||
    env['GITLAB_CI'] === "true" ||
    env['CIRCLECI'] === "true" ||
    env['TRAVIS'] === "true" ||
    env['JENKINS_URL'] !== undefined ||
    env['BUILDKITE'] === "true" ||
    env['DRONE'] === "true" ||
    env['BITBUCKET_BUILD_NUMBER'] !== undefined ||
    false
  );
}

/**
 * Check if running in Docker container
 */
export function isDocker(): boolean {
  if (!isNode()) return false;

  try {
    const fs = require("fs");
    // Check for .dockerenv file
    if (fs.existsSync("/.dockerenv")) return true;

    // Check for Docker in cgroup
    if (fs.existsSync("/proc/self/cgroup")) {
      const cgroup = fs.readFileSync("/proc/self/cgroup", "utf8");
      return cgroup.includes("docker") || cgroup.includes("/lxc/");
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Check if debugging is enabled
 */
export function isDebug(): boolean {
  if (typeof globalThis.process !== "undefined" && globalThis.process.env) {
    return (
      globalThis.process.env['DEBUG'] === "true" ||
      globalThis.process.env['DEBUG'] === "1" ||
      globalThis.process.env['DEBUG'] === "*" ||
      globalThis.process.env['NODE_ENV'] === "debug"
    );
  }

  // Check for debug flag in browser
  if (isBrowser()) {
    try {
      return (
        globalThis.localStorage?.getItem("debug") === "true" ||
        new URLSearchParams(globalThis.location?.search).has("debug")
      );
    } catch {
      // Ignore localStorage errors
    }
  }

  return false;
}

/**
 * Get the current runtime environment summary
 * Backward compatibility function
 */
export function getRuntimeEnvironment(): "browser" | "node" | "test" {
  if (isTest()) return "test";
  if (isBrowser()) return "browser";
  return "node";
}

/**
 * Comprehensive environment info object
 */
export interface EnvironmentInfo {
  runtime: Runtime;
  environment: Environment;
  testFramework: TestFramework;
  isLocalhost: boolean;
  isCI: boolean;
  isDocker: boolean;
  isDebug: boolean;
  isBrowser: boolean;
  isNode: boolean;
  isDeno: boolean;
  isBun: boolean;
  isWebWorker: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

/**
 * Get comprehensive environment information
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    runtime: getRuntime(),
    environment: getEnvironment(),
    testFramework: getTestFramework(),
    isLocalhost: isLocalhost(),
    isCI: isCI(),
    isDocker: isDocker(),
    isDebug: isDebug(),
    isBrowser: isBrowser(),
    isNode: isNode(),
    isDeno: isDeno(),
    isBun: isBun(),
    isWebWorker: isWebWorker(),
    isDevelopment: isDevelopment(),
    isProduction: isProduction(),
    isTest: isTest(),
  };
}
