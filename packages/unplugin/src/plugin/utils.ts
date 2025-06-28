import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

import { isLocalNetwork, getNetworkPort } from "@pact-toolbox/config";
import { PactToolboxNetwork, createNetwork as createPactToolboxNetworkInstance } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger, isPortTaken } from "@pact-toolbox/node-utils";

import type { PluginOptions } from "./types";

interface StartOptions {
  isTest: boolean;
  isServe: boolean;
  client: PactToolboxClient;
  networkConfig: NetworkConfig;
}

// Simple network tracking
let runningNetwork: PactToolboxNetwork | null = null;

export async function stopRunningNetwork(): Promise<void> {
  if (runningNetwork) {
    try {
      await runningNetwork.stop();
      runningNetwork = null;
    } catch (error) {
      logger.error("Error stopping network:", error);
    }
  }
}

interface StartToolboxNetworkResult {
  network: PactToolboxNetwork | null;
  client: PactToolboxClient;
}

export async function createPactToolboxNetwork(
  { isServe, isTest, client, networkConfig }: StartOptions,
  toolboxConfig: PactToolboxConfigObj,
  { startNetwork = true, onReady }: PluginOptions = {},
): Promise<StartToolboxNetworkResult> {
  // Skip network startup if not serving, in test mode, not a local network, or startNetwork is false
  if (!isServe || isTest || !isLocalNetwork(networkConfig) || !startNetwork) {
    if (isServe && !isTest && onReady) {
      await onReady(client);
    }
    return {
      network: null,
      client,
    };
  }

  // Check if we already have a running network
  if (runningNetwork) {
    logger.info("Network already running, reusing existing instance");
    if (onReady) {
      await onReady(client);
    }
    return {
      network: runningNetwork,
      client,
    };
  }

  // Check if port is already in use
  try {
    const port = getNetworkPort(networkConfig);
    const portInUse = await isPortTaken(port);

    if (portInUse) {
      logger.info(`Port ${port} is already in use, assuming network is running`);
      if (onReady) {
        await onReady(client);
      }
      return {
        network: null,
        client,
      };
    }
  } catch (error) {
    logger.debug("Error checking port availability:", error);
  }

  // Try to start the network
  try {
    logger.info(`Starting network ${networkConfig.name || "local"}...`);

    const network = await createPactToolboxNetworkInstance(toolboxConfig, {
      client,
      logAccounts: true,
      detached: true,
      autoStart: true,
    });

    runningNetwork = network;

    logger.success(`Network ${networkConfig.name || "local"} started successfully`);

    // Call onReady callback if provided
    if (onReady) {
      try {
        await onReady(client);
      } catch (error) {
        logger.error("onReady callback failed:", error);
      }
    }

    return {
      network,
      client,
    };
  } catch (error) {
    logger.error(`Failed to start network:`, error);

    // If network startup failed but not because it's already running, throw the error
    if (error instanceof Error && !error.message.includes("already running")) {
      throw error;
    }

    // Network is already running, continue without error
    if (onReady) {
      await onReady(client);
    }

    return {
      network: null,
      client,
    };
  }
}

// export async function createDtsFiles(contractsDir: string = "pact"): Promise<void> {
//   logger.start("Creating d.ts files for contracts...", contractsDir);
//   const aborter = new AbortController();
//   const result = await readdir(`**/*.pact`, {
//     cwd: contractsDir,
//     depth: 20,
//     limit: 1_000_000,
//     followSymlinks: true,
//     ignore: ["prelude/**"],
//     signal: aborter.signal,
//   });
//   for (const file of result.files) {
//     const pactCode = readFileSync(file, "utf-8");
//     const { types } = pactToJS(pactCode);
//     await writeFile(`${file}.d.ts`, types);
//   }
//   logger.success("d.ts files created");
// }

export const PLUGIN_NAME = "pact-toolbox";

// const configSchema = z.object({
//   contractsDir: z.string(),
//   // Add other required fields...
// });

// const validateConfig = (config: any) => {
//   const result = configSchema.safeParse(config);
//   if (!result.success) {
//     throw new Error('Invalid Pact Toolbox configuration');
//   }
//   return result.data;
// };

export function isAggregateError(e: unknown): e is AggregateError {
  return e instanceof AggregateError;
}

export function prettyPrintError(label: string, error: unknown): void {
  console.error(`\n\x1b[31m[${label}]\x1b[0m`);
  if (isAggregateError(error)) {
    console.error("\x1b[31mMultiple errors occurred:\x1b[0m");
    error.errors.forEach((err, index) => {
      console.error(`\x1b[31m[${index + 1}]\x1b[0m ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) {
        console.error(`\x1b[90m${err.stack.split("\n").slice(1).join("\n")}\x1b[0m`);
      }
    });
  } else if (error instanceof Error) {
    console.error(`\x1b[31m${error.message}\x1b[0m`);
    if (error.stack) {
      console.error(`\x1b[90m${error.stack.split("\n").slice(1).join("\n")}\x1b[0m`);
    }
  } else {
    console.error(`\x1b[31m${String(error)}\x1b[0m`);
  }
}
