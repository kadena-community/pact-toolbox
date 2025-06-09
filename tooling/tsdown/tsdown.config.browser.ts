import type { UserConfig } from "tsdown";

import { getBaseConfig } from "./base-config.js";

const config: UserConfig[] = getBaseConfig("browser", ["cjs", "esm"], {} as any);
export default config;
