import { isAbsolute, join } from "pathe";

import type { CommonPreludeOptions, PactPrelude } from "./types";

interface ResolvePreludesOptions {
  preludesDir: string;
  preludes: PactPrelude[];
}
interface PreludesCache extends ResolvePreludesOptions {
  resolved: boolean;
}
const __PRELUDES_CACHE__: PreludesCache = {
  preludes: [],
  preludesDir: "",
  resolved: false,
};

export async function resolvePreludes({
  contractsDir,
  preludes = [],
}: CommonPreludeOptions): Promise<ResolvePreludesOptions> {
  if (__PRELUDES_CACHE__.resolved) {
    return __PRELUDES_CACHE__;
  }
  const preludesDir = isAbsolute(contractsDir)
    ? join(contractsDir as string, "prelude")
    : join(process.cwd(), contractsDir as string, "prelude");
  __PRELUDES_CACHE__.preludesDir = preludesDir;
  const uniquePreludes = [...new Set(preludes)];
  __PRELUDES_CACHE__.preludes = await Promise.all(
    uniquePreludes?.map((prelude) => {
      if (typeof prelude === "string") {
        switch (prelude) {
          case "kadena/chainweb":
            return import("./preludes/kadena/chainweb").then((m) => m.default);
          case "kadena/marmalade":
            return import("./preludes/kadena/marmalade").then((m) => m.default);
          default:
            throw new Error(`Prelude ${prelude} not found`);
        }
      }
      return prelude;
    }) ?? [],
  );

  return __PRELUDES_CACHE__;
}
