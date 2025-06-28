import type { WebpackPluginInstance } from "unplugin";
import { createWebpackPlugin } from "unplugin";

import type { PluginOptions } from "./plugin/types";
import { unpluginFactory } from "./plugin/factory";

export default createWebpackPlugin(unpluginFactory) as (options?: PluginOptions) => WebpackPluginInstance;
