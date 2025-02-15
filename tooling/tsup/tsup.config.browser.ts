import { defineConfig } from "tsup";

import { getBaseConfig } from "./base-config.js";

export default defineConfig((options) => [...getBaseConfig("browser", ["cjs", "esm"], options)]);
