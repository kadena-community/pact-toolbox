import { defineConfig } from "tsdown";
import type { Options } from "tsdown";

import { getBaseConfig } from "./base-config.js";
import packageConfigOrConfigsOrPromiseGetterForSame from "./tsdown.config.package.js";

const config: ReturnType<typeof defineConfig> = defineConfig(async (options): Promise<Options[]> => {
  const packageConfigOptionOrOptions =
    typeof packageConfigOrConfigsOrPromiseGetterForSame === "function"
      ? await packageConfigOrConfigsOrPromiseGetterForSame(options)
      : packageConfigOrConfigsOrPromiseGetterForSame;
  const packageConfigOptions = Array.isArray(packageConfigOptionOrOptions)
    ? packageConfigOptionOrOptions
    : [packageConfigOptionOrOptions];
  return [...packageConfigOptions, ...getBaseConfig("browser", ["iife"], options as any)] as Options[];
});

export default config;
