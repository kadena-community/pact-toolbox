import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import type { StartLocalNetworkOptions } from "@pact-toolbox/network";
import defu from "defu";
import { createJiti } from "jiti";
import { fileURLToPath } from "mlly";
import { resolve } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { startLocalNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

export interface ToolboxScriptContext<Args = Record<string, unknown>> {
  client: PactToolboxClient;
  args: Args;
  logger: typeof logger;
  network: string;
  config: PactToolboxConfigObj;
}

export interface ToolboxScriptOptions {
  autoStartNetwork?: boolean;
  persist?: boolean;
  startNetworkOptions?: Partial<StartLocalNetworkOptions>;
  configOverrides?: Partial<PactToolboxConfigObj>;
  network?: string;
}
export interface ToolboxScript<Args = Record<string, unknown>> extends ToolboxScriptOptions {
  run: (ctx: ToolboxScriptContext<Args>) => Promise<void>;
}

export function createScript<Args = Record<string, unknown>>(options: ToolboxScript<Args>): ToolboxScript<Args> {
  return options;
}

const SUPPORTED_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".json"];
// https://github.com/dword-design/package-name-regex
const NPM_PACKAGE_RE = /^(@[\da-z~-][\d._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*($|\/.*)/;
export interface RunScriptOptions {
  cwd?: string;
  network?: string;
  args?: Record<string, unknown>;
  config?: PactToolboxConfigObj;
  client?: PactToolboxClient;
  scriptOptions?: ToolboxScriptOptions;
}
export async function runScript(source: string, options: RunScriptOptions): Promise<void> {
  // normalize options
  options.cwd = resolve(process.cwd(), options.cwd || ".");
  options.scriptOptions = options.scriptOptions || {};
  if (!options.config) {
    options.config = await resolveConfig();
  }
  const scriptsDir = options.config.scriptsDir ?? "scripts";

  const jiti = createJiti(resolve(options.cwd, scriptsDir), {
    interopDefault: true,
    moduleCache: false,
    extensions: [...SUPPORTED_EXTENSIONS],
  });
  const tryResolve = (id: string) => {
    const resolved = jiti.esmResolve(id, { try: true });
    return resolved ? fileURLToPath(resolved) : undefined;
  };
  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    source = tryResolve(source) || source;
  }
  // // Import from local fs
  // const ext = extname(source);
  // const isDir = !ext || ext === basename(source); /* #71 */
  // const cwd = resolve(options.cwd!, isDir ? source : dirname(source));
  // if (isDir) {
  //   source = options.!;
  // }

  const scriptPath =
    tryResolve(resolve(options.cwd, scriptsDir, source)) ||
    tryResolve(resolve(options.cwd, source)) ||
    tryResolve(resolve(options.cwd, ".scripts", source));
  source;
  if (!scriptPath) {
    throw new Error(`Script ${source} not found`);
  }

  const scriptObject = await jiti.import(scriptPath);
  if (typeof scriptObject !== "object") {
    throw new Error(`Script ${source} should export an object with run method`);
  }
  const scriptInstance = defu(options.scriptOptions, scriptObject) as ToolboxScript;
  if (scriptInstance.configOverrides) {
    options.config = defu(scriptInstance.configOverrides, options.config) as Required<PactToolboxConfigObj>;
  }
  options.network = options.network ?? scriptInstance.network ?? options.config.defaultNetwork;
  if (!options.client) {
    options.client = new PactToolboxClient(options.config, options.network);
  }
  options.client.setConfig(options.config);
  try {
    let n;
    if (scriptInstance.autoStartNetwork) {
      n = await startLocalNetwork(options.config, {
        ...scriptInstance.startNetworkOptions,
        network: options.network,
        client: options.client,
      });
    }
    const context = {
      logger,
      client: options.client!,
      args: options.args!,
      network: options.network!,
      config: options.config!,
    };
    await scriptInstance.run(context);
    if (!scriptInstance.persist) {
      if (n) {
        await n.stop();
      }
    }
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
