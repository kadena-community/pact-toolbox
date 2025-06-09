import { createFarmPlugin } from "unplugin";
import type { JsPlugin } from "@farmfe/core";
import { unpluginFactory } from "./plugin/factory";
import type { PluginOptions } from "./plugin/types";

type Factory = (options?: PluginOptions | undefined) => JsPlugin;

const factory: Factory = createFarmPlugin(unpluginFactory);
export default factory;
