import type { Plugin } from "rollup";
import { createRollupPlugin } from "unplugin";

import type { PluginOptions } from "./plugin/types";
import { unpluginFactory } from "./plugin/factory";

const unplugin: (options?: PluginOptions | undefined) => Plugin | Plugin[] = createRollupPlugin(unpluginFactory);
export default unplugin;
