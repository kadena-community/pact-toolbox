import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/playground.ts"],
  outDir: "dist",
  minify: false,
  format: ["cjs", "esm"],
  dts: {
    sourcemap: true,
  },
  target: "es2022",
  platform: "node",
  external: [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies),
    // Explicitly externalize problematic native modules
    "ssh2",
    "cpu-features",
    "tree-sitter",
    "tree-sitter-pact",
  ],
  clean: true,
  publint: true,
});
