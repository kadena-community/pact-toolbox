import baseConfig from "@pact-toolbox/vitest-config/node";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["**/*.test.ts", "**/*.spec.ts"],
  },
});
