import type { RspackPluginInstance } from "unplugin";
import { createRspackPlugin } from "unplugin";

import type { PluginOptions } from "./plugin/types";
import { unpluginFactory } from "./plugin/factory";

export default createRspackPlugin(unpluginFactory) as (options?: PluginOptions) => RspackPluginInstance;
