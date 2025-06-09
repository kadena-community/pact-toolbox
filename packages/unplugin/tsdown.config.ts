import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

const config: ReturnType<typeof defineConfig> = defineConfig({
  entry: ["src/*.ts"],
  clean: true,
  format: ["cjs", "esm"],
  outDir: "dist",
  minify: false,
  dts: {
    sourcemap: true,
  },
  target: "es2022",
  platform: "node",
  external: Object.keys(packageJson.devDependencies),
  publint: true,
});

export default config;
