import { describe, it, expect, vi, beforeEach } from "vitest";
import PactJestTransformer, { createTransformer } from "../src/jest";

// Mock the transform module
vi.mock("../src/transform", () => ({
  createPactToJSTransformer: vi.fn(() => {
    return vi.fn().mockImplementation(async (source: string, _path: string) => {
      // Mock transformation based on source content
      if (source.includes("invalid")) {
        throw new Error("Invalid Pact code");
      }
      return {
        code: `export const mockModule = { transformed: true };`,
        types: `export interface MockModule { transformed: boolean; }`,
        modules: [{ name: "mock-module", path: "mock-module" }],
        sourceMap: '{"version":3,"sources":["test.pact"],"mappings":""}',
      };
    });
  }),
}));

describe("PactJestTransformer", () => {
  let transformer: PactJestTransformer;

  beforeEach(() => {
    vi.clearAllMocks();
    transformer = new PactJestTransformer({ generateTypes: true });
  });

  describe("constructor", () => {
    it("should create transformer with default options", () => {
      const defaultTransformer = new PactJestTransformer();
      expect(defaultTransformer).toBeDefined();
      expect(defaultTransformer.canInstrument).toBe(false);
    });

    it("should create transformer with custom options", () => {
      const customTransformer = new PactJestTransformer({
        generateTypes: false,
        debug: true,
      });
      expect(customTransformer).toBeDefined();
    });
  });

  describe("getCacheKey", () => {
    it("should generate consistent cache key for same inputs", () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";
      const options = { configString: '{"rootDir":"/project"}' };

      const key1 = transformer.getCacheKey(sourceText, sourcePath, options);
      const key2 = transformer.getCacheKey(sourceText, sourcePath, options);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex string
    });

    it("should generate different cache keys for different inputs", () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";
      const options = { configString: '{"rootDir":"/project"}' };

      const key1 = transformer.getCacheKey(sourceText, sourcePath, options);
      const key2 = transformer.getCacheKey(sourceText + " ", sourcePath, options);
      const key3 = transformer.getCacheKey(sourceText, sourcePath + "2", options);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe("getCacheKeyAsync", () => {
    it("should return the same key as getCacheKey", async () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";
      const options = { configString: '{"rootDir":"/project"}' };

      const syncKey = transformer.getCacheKey(sourceText, sourcePath, options);
      const asyncKey = await transformer.getCacheKeyAsync(sourceText, sourcePath, options);

      expect(asyncKey).toBe(syncKey);
    });
  });

  describe("processAsync", () => {
    const mockOptions = {
      configString: '{"rootDir":"/project"}',
      config: { rootDir: "/project" },
      instrument: false,
      supportsStaticESM: false,
    };

    it("should transform valid Pact code", async () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";

      const result = await transformer.processAsync(sourceText, sourcePath, mockOptions);

      expect(result).toBeDefined();
      expect(result.code).toContain("export const mockModule");
      expect(result.code).toContain("module.exports = exports"); // CommonJS wrapper
      expect(result.map).toBeDefined();
    });

    it("should include source map comment when available", async () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";

      const result = await transformer.processAsync(sourceText, sourcePath, mockOptions);

      expect(result.code).toContain("//# sourceMappingURL=data:application/json;base64,");
    });

    it("should not wrap in CommonJS when ESM is supported", async () => {
      const sourceText = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const sourcePath = "/path/to/test.pact";
      const esmOptions = { ...mockOptions, supportsStaticESM: true };

      const result = await transformer.processAsync(sourceText, sourcePath, esmOptions);

      expect(result.code).not.toContain("module.exports = exports");
    });

    it("should handle transformation errors", async () => {
      const sourceText = "invalid pact code";
      const sourcePath = "/path/to/invalid.pact";

      await expect(transformer.processAsync(sourceText, sourcePath, mockOptions)).rejects.toThrow(
        "Failed to transform /path/to/invalid.pact: Invalid Pact code",
      );
    });
  });

  describe("process", () => {
    it("should throw error indicating async processing is required", () => {
      expect(() => transformer.process("", "")).toThrow("Pact transformer requires async processing");
    });
  });

  describe("createTransformer", () => {
    it("should create transformer with default options", () => {
      const transformer = createTransformer();
      expect(transformer).toBeInstanceOf(PactJestTransformer);
    });

    it("should create transformer with custom options", () => {
      const transformer = createTransformer({ generateTypes: false, debug: true });
      expect(transformer).toBeInstanceOf(PactJestTransformer);
    });
  });
});
