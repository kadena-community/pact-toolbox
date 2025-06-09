import { defineConfig } from "tsdown";

import { getBaseConfig } from "./base-config";

const config: ReturnType<typeof defineConfig> = defineConfig((options) => [
  ...getBaseConfig("node", ["cjs", "esm"], options),
  ...getBaseConfig("browser", ["cjs", "esm"], options),
  ...getBaseConfig("native", ["esm"], options),
]);

export default config;
