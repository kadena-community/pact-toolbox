import baseConfig from "@pact-toolbox/vitest-config/react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'jsdom',
  },
});