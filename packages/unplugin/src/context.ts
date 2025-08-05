/**
 * @fileoverview Plugin context management without global state
 * 
 * Provides a way to share context between plugin instances without
 * polluting the global namespace.
 */

import type { ChainwebClient } from "@pact-toolbox/chainweb-client";
import type { NetworkConfig } from "@pact-toolbox/types";

/**
 * Plugin context interface
 */
export interface PluginContext {
  getClient: () => ChainwebClient;
  multiNetworkConfig: Record<string, NetworkConfig>;
}

/**
 * Context store using WeakMap for memory safety
 */
const contextStore = new WeakMap<object, PluginContext>();

/**
 * Context key for plugin instances
 */
const CONTEXT_KEY = Symbol("pact-toolbox-plugin-context");

/**
 * Create a new plugin context
 */
export function createPluginContext(context: PluginContext): object {
  const key = { [CONTEXT_KEY]: true };
  contextStore.set(key, context);
  return key;
}

/**
 * Get plugin context by key
 */
export function getPluginContext(key: object): PluginContext | undefined {
  return contextStore.get(key);
}

/**
 * Check if an object is a context key
 */
export function isContextKey(obj: unknown): obj is object {
  return typeof obj === "object" && obj !== null && CONTEXT_KEY in obj;
}

/**
 * Plugin context manager for bundler integration
 */
export class PluginContextManager {
  private contexts = new Map<string, PluginContext>();

  /**
   * Register a context for a build
   */
  register(buildId: string, context: PluginContext): void {
    this.contexts.set(buildId, context);
  }

  /**
   * Get context for a build
   */
  get(buildId: string): PluginContext | undefined {
    return this.contexts.get(buildId);
  }

  /**
   * Remove context for a build
   */
  remove(buildId: string): boolean {
    return this.contexts.delete(buildId);
  }

  /**
   * Clear all contexts
   */
  clear(): void {
    this.contexts.clear();
  }

  /**
   * Get all build IDs
   */
  getBuildIds(): string[] {
    return Array.from(this.contexts.keys());
  }
}

/**
 * Shared context manager instance
 */
export const pluginContextManager: PluginContextManager = new PluginContextManager();

/**
 * Generate a unique build ID
 */
export function generateBuildId(): string {
  return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Inject context into module code
 */
export function injectContext(code: string, buildId: string): string {
  const contextVar = `__pactToolboxContext_${buildId.replace(/-/g, "_")}__`;
  
  return `
// Injected Pact Toolbox context
const ${contextVar} = (() => {
  if (typeof __PACT_TOOLBOX_BUILD_ID__ !== 'undefined') {
    // Build-time context injection
    return __PACT_TOOLBOX_BUILD_ID__;
  }
  // Runtime fallback
  return "${buildId}";
})();

${code}

// Export context for other modules
export const __pactToolboxBuildId = ${contextVar};
`;
}

/**
 * Extract context from module
 */
export function extractContext(moduleExports: any): string | undefined {
  return moduleExports?.__pactToolboxBuildId;
}