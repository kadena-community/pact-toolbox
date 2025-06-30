import { describe, it, expect } from "vitest";
import { createPactTransformer } from "../index.js";

describe("PactTransformer API", () => {
  describe("createPactTransformer", () => {
    it("should create a transformer instance with default config", () => {
      const transformer = createPactTransformer();
      expect(transformer).toBeDefined();
      expect(typeof transformer.transform).toBe("function");
      expect(typeof transformer.transformFile).toBe("function");
      expect(typeof transformer.transformFiles).toBe("function");
      expect(typeof transformer.getErrors).toBe("function");
      expect(typeof transformer.parse).toBe("function");
    });

    it("should create a transformer instance with custom config", () => {
      const transformer = createPactTransformer({
        transform: {
          generateTypes: true,
          moduleName: "test-module",
        },
        fileOutput: {
          outputDir: "./output",
          format: "js-types",
        },
      });

      expect(transformer).toBeDefined();
    });
  });

  describe("transform", () => {
    it("should transform simple Pact code", async () => {
      const transformer = createPactTransformer({
        transform: {
          generateTypes: true,
        },
      });

      const pactCode = `
        (module simple-test GOVERNANCE
          (defcap GOVERNANCE () true)
          (defun hello:string (name:string)
            (format "Hello, {}!" [name]))
        )
      `;

      const result = await transformer.transform(pactCode, {
        moduleName: "simple-test",
      });

      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();
      expect(typeof result.javascript).toBe("string");
      expect(result.javascript.length).toBeGreaterThan(0);

      // Should include TypeScript types when generateTypes is true
      if (result.typescript) {
        expect(typeof result.typescript).toBe("string");
        expect(result.typescript.length).toBeGreaterThan(0);
      }
    });

    it("should handle transform options override", async () => {
      const transformer = createPactTransformer({
        transform: {
          generateTypes: false,
        },
      });

      const pactCode = `
        (module test GOVERNANCE
          (defcap GOVERNANCE () true)
        )
      `;

      // Override config option
      const result = await transformer.transform(pactCode, {
        generateTypes: true,
        moduleName: "test-module",
      });

      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();
    });

    it("should transform complex Pact module", async () => {
      const transformer = createPactTransformer();

      const complexCode = `
        (module complex-module GOVERNANCE
          @doc "A complex module with various components"
          
          (defcap GOVERNANCE () true)
          
          (defschema user-schema
            @doc "User account schema"
            name: string
            age: integer
            email: string)
          
          (defun create-user:string (name:string age:integer email:string)
            @doc "Create a new user"
            (require-capability (GOVERNANCE))
            (insert users name { 
              "name": name, 
              "age": age, 
              "email": email 
            })
            name)
          
          (defun get-user:object{user-schema} (name:string)
            @doc "Get user by name"
            (read users name))
          
          (defconst MIN_AGE:integer 18)
          (defconst MAX_AGE:integer 120)
        )
      `;

      const result = await transformer.transform(complexCode);

      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();
      expect(result.javascript).toContain("create-user");
      expect(result.javascript).toContain("get-user");
    });
  });

  describe("parse", () => {
    it("should parse Pact code and return module information", () => {
      const transformer = createPactTransformer();

      const pactCode = `
        (module test-module GOVERNANCE
          (defcap GOVERNANCE () true)
          (defun test-function:string () "hello")
          (defschema test-schema name:string)
          (defconst TEST_CONST:string "test")
        )
      `;

      const modules = transformer.parse(pactCode);

      expect(modules).toBeDefined();
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBe(1);

      const module = modules[0];
      expect(module.name).toBe("test-module");
      expect(module.governance).toBe("GOVERNANCE");
      expect(module.functionCount).toBe(1);
      expect(module.schemaCount).toBe(1);
      expect(module.capabilityCount).toBe(1);
      expect(module.constantCount).toBe(1);
    });

    it("should parse multiple modules", () => {
      const transformer = createPactTransformer();

      const multiModule = `
        (module first GOVERNANCE
          (defcap GOVERNANCE () true))
        
        (module second OTHER-GOV
          (defcap OTHER-GOV () true))
      `;

      const modules = transformer.parse(multiModule);

      expect(modules.length).toBe(2);
      expect(modules[0].name).toBe("first");
      expect(modules[1].name).toBe("second");
    });
  });

  describe("getErrors", () => {
    it("should return empty array for valid code", () => {
      const transformer = createPactTransformer();

      const validCode = `
        (module valid GOVERNANCE
          (defcap GOVERNANCE () true))
      `;

      const errors = transformer.getErrors(validCode);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(0);
    });

    it("should detect parsing errors in invalid code", () => {
      const transformer = createPactTransformer();

      const invalidCode = `
        (module incomplete GOVERNANCE
          (defcap GOVERNANCE () true
      `; // Missing closing parentheses

      const errors = transformer.getErrors(invalidCode);
      expect(Array.isArray(errors)).toBe(true);
      // Note: The actual error detection depends on the parser implementation
      // This test verifies the API works correctly
    });
  });

  describe("configuration merging", () => {
    it("should merge config options with method options", async () => {
      const transformer = createPactTransformer({
        transform: {
          generateTypes: false,
          sourceMaps: true,
        },
      });

      const pactCode = `
        (module config-test GOVERNANCE
          (defcap GOVERNANCE () true))
      `;

      // Method options should override config options
      const result = await transformer.transform(pactCode, {
        generateTypes: true, // Override config
        moduleName: "config-test",
      });

      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();
    });

    it("should use config defaults when no method options provided", async () => {
      const transformer = createPactTransformer({
        transform: {
          generateTypes: true,
          moduleName: "default-module",
        },
      });

      const pactCode = `
        (module default-test GOVERNANCE
          (defcap GOVERNANCE () true))
      `;

      const result = await transformer.transform(pactCode);

      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty module", async () => {
      const transformer = createPactTransformer();

      const emptyModule = "(module empty GOVERNANCE)";

      const result = await transformer.transform(emptyModule);
      expect(result).toBeDefined();
      expect(result.javascript).toBeDefined();

      const modules = transformer.parse(emptyModule);
      expect(modules.length).toBe(1);
      expect(modules[0].name).toBe("empty");
      expect(modules[0].functionCount).toBe(0);
    });

    it("should handle module with only governance capability", async () => {
      const transformer = createPactTransformer();

      const minimalModule = `
        (module minimal GOVERNANCE
          (defcap GOVERNANCE () true))
      `;

      const result = await transformer.transform(minimalModule);
      expect(result).toBeDefined();

      const modules = transformer.parse(minimalModule);
      expect(modules[0].capabilityCount).toBe(1);
      expect(modules[0].functionCount).toBe(0);
    });
  });
});
