import type { Plugin } from "esbuild";
import { createEsbuildPlugin } from "unplugin";

import type { PluginOptions } from "./plugin/types";
import { unpluginFactory } from "./plugin/factory";

type Factory = (options?: PluginOptions | undefined) => Plugin;
const factory: Factory = createEsbuildPlugin(unpluginFactory);
export default factory;
