import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@pact-toolbox/kda",
    exclude: ["**/*.spec.?(c|m)[jt]s?(x)", "**/node_modules/**"],
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
  },
});
