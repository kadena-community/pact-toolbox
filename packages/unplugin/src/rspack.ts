import type { RspackPluginInstance } from "unplugin";
import { createRspackPlugin } from "unplugin";

import type { Options } from "./core/options";
import { unpluginFactory } from ".";

export default createRspackPlugin(unpluginFactory) as (options?: Options) => RspackPluginInstance;
