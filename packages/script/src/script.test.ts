import { describe, expect, test } from "vitest";
import { createScript } from "./index";

describe("@pact-toolbox/script", () => {
  describe("createScript", () => {
    test("creates script definition with minimal options", () => {
      const script = createScript({
        run: async (context) => {
          context.logger.info("Running script");
        },
      });

      expect(script).toBeDefined();
      expect(script.run).toBeInstanceOf(Function);
    });

    test("creates script with full options", () => {
      const script = createScript({
        network: "testnet",
        autoStartNetwork: true,
        run: async (context) => {
          context.logger.info("Deploying contracts");
        },
      });

      expect(script.network).toBe("testnet");
      expect(script.autoStartNetwork).toBe(true);
    });

    test("script preserves configuration", () => {
      const customConfig = {
        contractsDir: "./custom-contracts",
      };

      const script = createScript({
        configOverrides: customConfig,
        run: async (context) => {
          // This would be tested in an integration test
          return context;
        },
      });

      expect(script.configOverrides).toEqual(customConfig);
    });
  });

  describe("Script Options", () => {
    test("supports namespace handling options", () => {
      const script = createScript({
        namespaceHandling: {
          autoCreate: true,
          interactive: false,
        },
        run: async () => {},
      });

      expect(script.namespaceHandling?.autoCreate).toBe(true);
      expect(script.namespaceHandling?.interactive).toBe(false);
    });

    test("supports deployment hooks", () => {
      const preRun = async () => {};
      const postRun = async () => {};
      const onError = async () => {};

      const script = createScript({
        hooks: {
          preRun,
          postRun,
          onError,
        },
        run: async () => {},
      });

      expect(script.hooks?.preRun).toBe(preRun);
      expect(script.hooks?.postRun).toBe(postRun);
      expect(script.hooks?.onError).toBe(onError);
    });

    test("supports metadata", () => {
      const metadata = {
        name: "test-script",
        description: "A test script",
        version: "1.0.0",
        author: "test-author",
        tags: ["test", "example"],
      };

      const script = createScript({
        metadata,
        run: async () => {},
      });

      expect(script.metadata).toEqual(metadata);
    });
  });
});
