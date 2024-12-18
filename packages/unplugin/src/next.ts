import type { NextConfig } from "next";

import type { PluginOptions } from "./plugin/types";
import webpackPlugin from "./webpack";

function withPactToolbox(pluginOptions?: PluginOptions) {
  return (nextConfig: NextConfig = {}) => {
    return {
      ...nextConfig,
      webpack(config: any, options: any) {
        config.plugins.push(webpackPlugin(pluginOptions));
        if (typeof nextConfig.webpack === "function") {
          return nextConfig.webpack(config, options);
        }
        return config;
      },
    } as NextConfig;
  };
}

export default withPactToolbox;
