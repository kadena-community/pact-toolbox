import type { PluginOptions } from "./plugin/types";
import unplugin from "./plugin/factory";

export default (options: PluginOptions) => ({
  name: "unplugin-starter",
  hooks: {
    "astro:config:setup": async (astro: any): Promise<void> => {
      astro.config.vite.plugins ||= [];
      astro.config.vite.plugins.push(unplugin.vite(options));
    },
  },
});
