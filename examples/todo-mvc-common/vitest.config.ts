import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import pactVitePlugin from "@pact-toolbox/unplugin/vite";

export default defineConfig({
  plugins: [react(), tsconfigPaths(), pactVitePlugin()],
  test: {
    environment: "happy-dom",
    testTimeout: 1000000,
    hookTimeout: 1000000,
    setupFiles: ["vitest.setup.ts"],
  },
});
