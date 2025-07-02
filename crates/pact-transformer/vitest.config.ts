import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.spec.?(c|m)[jt]s?(x)", "**/node_modules/**"],
    // Increase timeouts for QEMU emulated environments
    testTimeout: 30000,
    hookTimeout: 30000,
    // Use single thread to avoid concurrency issues in emulated environments
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Disable coverage which can cause issues with native modules
    coverage: {
      enabled: false,
    },
  },
});
