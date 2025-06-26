import baseConfig from "@pact-toolbox/vitest-config/node";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.spec.ts"],
  },
  define: {
    __BROWSER__: false,
    __NODEJS__: true,
    __REACTNATIVE__: false,
    __DEV__: true,
    __VERSION__: '"test"',
  },
});
