import { env } from "node:process";

import browsersListToEsBuild from "browserslist-to-esbuild";
import type { Options } from "tsdown";

import { DevFlagPlugin } from "./dev-flag";

type Platform =
  | "browser"
  // React Native
  | "native"
  | "node";

const BROWSERSLIST_TARGETS = browsersListToEsBuild();

export function getBaseConfig(platform: Platform, formats: Options["format"][], _options: Options): Options[] {
  const defaultDefine = {
    __BROWSER__: `${platform === "browser"}`,
    __NODEJS__: `${platform === "node"}`,
    __REACTNATIVE__: `${platform === "native"}`,
    __VERSION__: `"${env.npm_package_version}"`,
  };
  return [true, false]
    .flatMap<Options | null>((isDebugBuild) =>
      formats.map((format) =>
        format !== "iife" && isDebugBuild
          ? null // We don't build debug builds for packages; only for the iife bundle.
          : ({
              target: BROWSERSLIST_TARGETS,
              dts: {
                sourcemap: true,
              },
              define:
                format === "iife"
                  ? {
                      ...defaultDefine,
                      __DEV__: `${isDebugBuild}`,
                    }
                  : {
                      ...defaultDefine,
                      "process.env.NODE_ENV": "process.env.NODE_ENV",
                    },
              entry: [`./src/index.ts`],
              minify: format === "iife" && !isDebugBuild,
              plugins: [DevFlagPlugin],
              external: ["ws"],
              format,
              globalName: "globalThis.pactToolbox",
              name: platform,
              noExternal: [...(format === "cjs" ? ["@noble/ed25519"] : []), "uncrypto"],
              outExtensions({ format }) {
                return {
                  js:
                    format === "iife"
                      ? `.${isDebugBuild ? "development" : "production.min"}.js`
                      : `.${platform}.${format === "cjs" ? "cjs" : "mjs"}`,
                  dts: `.d.${format === "cjs" ? "cts" : "mts"}`,
                };
              },
              platform: platform === "node" ? "node" : "browser",
              // pure: ["process"],
              publint: true,
              sourcemap: format !== "iife" || isDebugBuild,
              treeshake: true,
            } satisfies Options),
      ),
    )
    .filter(Boolean) as Options[];
}
