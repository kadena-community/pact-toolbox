import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["**/src/**.{test,spec}.{ts,tsx}"],
      thresholds: {
        functions: 95,
        branches: 70,
        perFile: true,
        autoUpdate: true,
      },
    },
  },
});
