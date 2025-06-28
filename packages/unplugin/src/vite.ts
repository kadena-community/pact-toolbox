import type { Plugin } from "vite";
import { createVitePlugin } from "unplugin";

import { unpluginFactory } from "./plugin/factory";
import type { PluginOptions } from "./plugin/types";

export default createVitePlugin(unpluginFactory) as (options?: PluginOptions) => Plugin | Plugin[];
