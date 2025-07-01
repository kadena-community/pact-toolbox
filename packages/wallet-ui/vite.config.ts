import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    solid(),
    dts({
      include: ["src/**/*"],
      exclude: ["src/**/*.spec.*", "src/**/*.test.*", "src/**/*.stories.*"],
      outDir: "dist",
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "solid-js",
        "solid-js/web",
        "solid-js/store",
        "clsx",
        "goober",
        "@pact-toolbox/ui-shared",
        "@pact-toolbox/crypto",
        "@pact-toolbox/network-config",
        "@pact-toolbox/signers",
        "@pact-toolbox/types",
        "@pact-toolbox/utils",
        "@pact-toolbox/wallet-core"
      ],
      output: {
        preserveModules: false,
        exports: "named",
      },
    },
    target: "esnext",
    minify: false,
    sourcemap: true,
  },
  optimizeDeps: {
    include: ["solid-js", "solid-js/web"],
  },
});