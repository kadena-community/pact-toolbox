import type { PactToolboxConfigObj } from '@pact-toolbox/config';
import { resolveConfig } from '@pact-toolbox/config';
import type { StartLocalNetworkOptions } from '@pact-toolbox/network';
import { startLocalNetwork } from '@pact-toolbox/network';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import defu from 'defu';
import createJiti from 'jiti';
import { join } from 'pathe';

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

export function createScript<Args = Record<string, unknown>>(options: ToolboxScript<Args>) {
  return options;
}

export interface RunScriptOptions {
  network?: string;
  args?: Record<string, unknown>;
  config?: PactToolboxConfigObj;
  client?: PactToolboxClient;
  scriptOptions?: ToolboxScriptOptions;
}
export async function runScript(
  script: string,
  { network, args = {}, config, client, scriptOptions }: RunScriptOptions,
): Promise<void> {
  if (!config) {
    config = await resolveConfig();
  }
  const scriptsDir = config.scriptsDir ?? 'scripts';
  const jiti = createJiti(undefined as unknown as string, {
    interopDefault: true,
    requireCache: false,
    esmResolve: true,
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  });
  const tryResolve = (id: string) => {
    try {
      return jiti.resolve(join(process.cwd(), scriptsDir, id), {
        paths: [process.cwd()],
      });
    } catch {}
  };
  const scriptPath = tryResolve(script);
  if (!scriptPath) {
    throw new Error(`Script ${script} not found`);
  }

  const scriptObject = jiti(scriptPath);
  if (typeof scriptObject !== 'object') {
    throw new Error(`Script ${script} should export an object with run method`);
  }
  const options = defu(scriptOptions, scriptObject) as ToolboxScript;
  if (options.configOverrides) {
    config = defu(options.configOverrides, config) as Required<PactToolboxConfigObj>;
  }
  network = network ?? options.network ?? config.defaultNetwork;
  if (!client) {
    client = new PactToolboxClient(config, network);
  }
  client.setConfig(config);
  try {
    let n;
    if (options.autoStartNetwork) {
      n = await startLocalNetwork(config, {
        ...options.startNetworkOptions,
        network,
        client,
      });
    }
    const context = {
      client,
      args,
      logger,
      network,
      config,
    };
    await options.run(context);
    if (!options.persist) {
      if (n) {
        await n.stop();
      }
      process.exit(0);
    }
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}
