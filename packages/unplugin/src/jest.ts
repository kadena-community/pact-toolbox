import type { AsyncTransformer, TransformedSource } from "@jest/transform";
import { createPactToJSTransformer } from "./transform";

interface JestTransformerOptions {
  generateTypes?: boolean;
  debug?: boolean;
}

/**
 * Jest async transformer for Pact files
 *
 * Usage in jest.config.js:
 * ```javascript
 * module.exports = {
 *   transform: {
 *     "\\.pact$": ["@pact-toolbox/unplugin/jest", { generateTypes: true }]
 *   },
 *   extensionsToTreatAsEsm: [".pact"],
 * };
 * ```
 */
export default class PactJestTransformer implements AsyncTransformer<JestTransformerOptions> {
  private transformer: ReturnType<typeof createPactToJSTransformer>;
  private options: JestTransformerOptions;

  constructor(options: JestTransformerOptions = {}) {
    this.options = options;
    this.transformer = createPactToJSTransformer({
      generateTypes: options.generateTypes ?? true,
      debug: options.debug ?? false,
    });
  }

  /**
   * Indicates whether this transformer can instrument code
   */
  canInstrument = false;

  /**
   * Gets the cache key for the transformation
   */
  getCacheKey(sourceText: string, sourcePath: string, options: { configString: string }): string {
    // Create a cache key based on source content, path, and options
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");
    hash.update(sourceText);
    hash.update(sourcePath);
    hash.update(options.configString);
    hash.update(JSON.stringify(this.options));
    return hash.digest("hex");
  }

  /**
   * Gets the cache key asynchronously (required for async transformer)
   */
  async getCacheKeyAsync(sourceText: string, sourcePath: string, options: { configString: string }): Promise<string> {
    return this.getCacheKey(sourceText, sourcePath, options);
  }

  /**
   * Processes the source file asynchronously
   */
  async processAsync(
    sourceText: string,
    sourcePath: string,
    options: {
      configString: string;
      config: any;
      instrument: boolean;
      supportsDynamicImport?: boolean;
      supportsExportNamespaceFrom?: boolean;
      supportsStaticESM?: boolean;
      supportsTopLevelAwait?: boolean;
    },
  ): Promise<TransformedSource> {
    try {
      // Transform the Pact code to JavaScript
      const result = await this.transformer(sourceText, sourcePath);

      // Create source map comment if available
      const sourceMapComment = result.sourceMap
        ? `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(result.sourceMap).toString("base64")}`
        : "";

      // Add CommonJS wrapper if not using ESM
      const isESM = options.supportsStaticESM ?? false;
      let code = result.code;

      if (!isESM) {
        // Wrap in CommonJS exports
        code = this.wrapInCommonJS(code);
      }

      return {
        code: code + sourceMapComment,
        map: result.sourceMap ? JSON.parse(result.sourceMap) : null,
      };
    } catch (error) {
      // Re-throw with Jest-friendly error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to transform ${sourcePath}: ${errorMessage}`);
    }
  }

  /**
   * Synchronous process method (required by interface but we throw since we're async)
   */
  process(): never {
    throw new Error("Pact transformer requires async processing. Please use Jest with async transformer support.");
  }

  /**
   * Wraps ES module code in CommonJS exports
   */
  private wrapInCommonJS(code: string): string {
    // Simple wrapper - in a real implementation you might want to use a proper ES->CJS transformer
    return `
"use strict";

${code}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
}
`;
  }
}

// Export transformer factory for Jest
export function createTransformer(options: JestTransformerOptions = {}): PactJestTransformer {
  return new PactJestTransformer(options);
}
