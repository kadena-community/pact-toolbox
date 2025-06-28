import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "dev-wallet",
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    setupFiles: ["./src/test-utils/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test-utils/", "**/*.d.ts", "**/*.config.ts"],
    },
  },
});
