import type { Plugin, PluginOption } from "vite";
import { createVitePlugin } from "unplugin";

import { unpluginFactory } from "./plugin/factory";

export default createVitePlugin(unpluginFactory) as (options?: PluginOption) => Plugin | Plugin[];
