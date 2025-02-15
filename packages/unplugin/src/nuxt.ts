import { addVitePlugin, addWebpackPlugin, defineNuxtModule } from "@nuxt/kit";

import "@nuxt/schema";

import type { NuxtModule } from "@nuxt/schema";

import type { PluginOptions } from "./plugin/types";
import vite from "./vite";
import webpack from "./webpack";

export interface ModuleOptions extends PluginOptions {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxt-unplugin-starter",
    configKey: "unpluginStarter",
  },
  defaults: {
    // ...default options
  },
  setup(options, _nuxt) {
    //@ts-ignore
    addVitePlugin(() => vite(options));
    addWebpackPlugin(() => webpack(options));

    // ...
  },
}) as NuxtModule<ModuleOptions>;
