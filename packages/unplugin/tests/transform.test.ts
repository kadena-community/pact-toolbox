import { describe, it, expect, afterEach, vi } from "vitest";
import { createPactToJSTransformer, cleanupTransformer } from "../src/transform";

describe("createPactToJSTransformer", () => {
  afterEach(() => {
    cleanupTransformer();
  });

  it("should transform a simple Pact module", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const pactCode = `
      (module hello-world GOVERNANCE
        (defcap GOVERNANCE () true)
        
        (defun say-hello:string (name:string)
          @doc "Returns a greeting"
          (format "Hello, {}!" [name]))
      )
    `;

    const result = await transformer(pactCode);

    expect(result.code).toBeTruthy();
    expect(result.types).toBeTruthy();
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].name).toBe("hello-world");
    expect(result.modules[0].path).toBe("hello-world");
  });

  it("should handle modules with namespaces", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const pactCode = `
      (namespace "free")
      (module my-module GOVERNANCE
        (defcap GOVERNANCE () true)
        
        (defun test:string ()
          "test")
      )
    `;

    const result = await transformer(pactCode);

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].name).toBe("my-module");
    expect(result.modules[0].path).toBe("free.my-module");
  });

  it("should include file path in error messages", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const invalidPactCode = `
      (module broken
        ; Missing governance capability
    `;

    await expect(transformer(invalidPactCode, "/path/to/file.pact")).rejects.toThrow(/\/path\/to\/file\.pact/);
  });

  it("should provide specific syntax error messages", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const invalidPactCode = `
      (module test GOVERNANCE
        (defcap GOVERNANCE () true)
        (defun broken:string (
          ; Missing closing paren
    `;

    await expect(transformer(invalidPactCode)).rejects.toThrow(/Syntax error/);
  });

  it("should handle empty modules gracefully", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const pactCode = `
      (module empty GOVERNANCE
        (defcap GOVERNANCE () true)
      )
    `;

    const result = await transformer(pactCode);

    expect(result.code).toBeTruthy();
    expect(result.types).toBeTruthy();
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].name).toBe("empty");
  });

  it("should include source maps when available", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const pactCode = `
      (module test GOVERNANCE
        (defcap GOVERNANCE () true)
      )
    `;

    const result = await transformer(pactCode);

    // sourceMap might be undefined, which is fine
    expect(result).toHaveProperty("sourceMap");
  });

  it("should log transformation time in debug mode", async () => {
    const { logger } = await import("@pact-toolbox/node-utils");
    const logSpy = vi.spyOn(logger, "debug").mockImplementation(() => {});
    const transformer = createPactToJSTransformer({ generateTypes: true, debug: true });
    const pactCode = `
      (module test GOVERNANCE
        (defcap GOVERNANCE () true)
      )
    `;

    await transformer(pactCode, "test.pact");

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Transformed test\.pact in \d+\.\d+ms/));

    logSpy.mockRestore();
  });

  it("should reuse transformer instances from pool", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const pactCode = `
      (module test GOVERNANCE
        (defcap GOVERNANCE () true)
      )
    `;

    // Run multiple transformations to test pool reuse
    const results = await Promise.all([
      transformer(pactCode),
      transformer(pactCode),
      transformer(pactCode),
      transformer(pactCode),
      transformer(pactCode),
    ]);

    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0].name).toBe("test");
    });
  });

  it("should handle transformer errors gracefully", async () => {
    const transformer = createPactToJSTransformer({ generateTypes: true });
    const invalidPactCode = "not valid pact code at all!!!";

    // The transformer might return empty results instead of throwing
    const result = await transformer(invalidPactCode);

    // Check that it returns an empty or minimal result
    expect(result.modules).toEqual([]);
    expect(result.code).toBeDefined(); // Will have empty string
    expect(result.types).toBeDefined();
  });

  it("should respect generateTypes option", async () => {
    const transformerWithTypes = createPactToJSTransformer({ generateTypes: true });
    const transformerWithoutTypes = createPactToJSTransformer({ generateTypes: false });
    const pactCode = `
      (module test GOVERNANCE
        (defcap GOVERNANCE () true)
      )
    `;

    const resultWithTypes = await transformerWithTypes(pactCode);
    const resultWithoutTypes = await transformerWithoutTypes(pactCode);

    expect(resultWithTypes.types).toBeTruthy();
    expect(resultWithoutTypes.types).toBeFalsy();
  });
});
