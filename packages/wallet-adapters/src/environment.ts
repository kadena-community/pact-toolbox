/**
 * Environment detection utilities
 */

/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return typeof process !== "undefined" && 
    process.versions != null && 
    process.versions.node != null;
}

/**
 * Check if running in a test environment
 */
export function isTestEnvironment(): boolean {
  // Check common test environment variables and globals
  return (
    process.env["NODE_ENV"] === "test" ||
    process.env["JEST_WORKER_ID"] !== undefined ||
    process.env["VITEST"] === "true" ||
    // Check for test globals
    (typeof global !== "undefined" && (
      (global as any).__vitest_worker__ !== undefined ||
      (global as any).expect !== undefined ||
      (global as any).jest !== undefined
    ))
  );
}

/**
 * Get the current runtime environment
 */
export function getRuntimeEnvironment(): "browser" | "node" | "test" {
  if (isTestEnvironment()) return "test";
  if (isBrowser()) return "browser";
  return "node";
}