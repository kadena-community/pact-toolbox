import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

import { isLocalNetwork, getNetworkPort } from "@pact-toolbox/config";
import {
  PactToolboxNetwork,
  createPactToolboxNetwork as createPactToolboxNetworkInstance,
} from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger, isPortTaken } from "@pact-toolbox/utils";

import type { PluginOptions } from "./types";

interface StartOptions {
  isTest: boolean;
  isServe: boolean;
  client: PactToolboxClient;
  networkConfig: NetworkConfig;
}

// Global registry to track running networks
const RUNNING_NETWORKS_KEY = Symbol.for("__PACT_TOOLBOX_RUNNING_NETWORKS__");

interface RunningNetworkInfo {
  networkName: string;
  port: number | string;
  startTime: number;
  client: PactToolboxClient;
  network: PactToolboxNetwork | null;
}

function getRunningNetworksRegistry(): Map<string, RunningNetworkInfo> {
  if (!(globalThis as any)[RUNNING_NETWORKS_KEY]) {
    (globalThis as any)[RUNNING_NETWORKS_KEY] = new Map<string, RunningNetworkInfo>();
  }
  return (globalThis as any)[RUNNING_NETWORKS_KEY];
}

async function isNetworkRunning(networkConfig: NetworkConfig): Promise<boolean> {
  const registry = getRunningNetworksRegistry();
  const registryKey = `${networkConfig.name || "unknown"}-${networkConfig.type}`;

  // Check if network is in our registry
  const registeredNetwork = registry.get(registryKey);
  if (registeredNetwork) {
    // Double-check by testing the port
    const portInUse = await isPortTaken(registeredNetwork.port);
    if (portInUse) {
      return true;
    } else {
      // Clean up stale registry entry
      registry.delete(registryKey);
      return false;
    }
  }

  // Use the proper utility to get network port
  try {
    const port = getNetworkPort(networkConfig);
    return await isPortTaken(port);
  } catch {
    return false;
  }
}

function registerRunningNetwork(
  networkConfig: NetworkConfig,
  client: PactToolboxClient,
  network: PactToolboxNetwork | null,
): void {
  const registry = getRunningNetworksRegistry();
  const registryKey = `${networkConfig.name || "unknown"}-${networkConfig.type}`;

  // Use the proper utility to get network port
  const port = getNetworkPort(networkConfig);

  registry.set(registryKey, {
    networkName: networkConfig.name || "unknown",
    port,
    startTime: Date.now(),
    client,
    network,
  });
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

  // Check if network is already running
  const isRunning = await isNetworkRunning(networkConfig);
  if (isRunning) {
    if (onReady) {
      await onReady(client);
    }
    return {
      network: null,
      client,
    };
  }
  let network: PactToolboxNetwork;
  try {
    network = await createPactToolboxNetworkInstance(toolboxConfig, {
      client,
      logAccounts: true,
      conflictStrategy: "ignore",
      isDetached: true,
      autoStart: startNetwork,
      cleanup: false,
    });

    // Register the network as running
    registerRunningNetwork(networkConfig, client, network);
  } catch (error) {
    // Check if the error is about network already running
    if (error instanceof Error && error.message.includes("already running")) {
      registerRunningNetwork(networkConfig, client, null);
    } else {
      logger.error(`[startToolboxNetwork] Failed to start network ${networkConfig.name}:`, error);
      throw error;
    }
  }

  // Call onReady callback if provided
  if (onReady) {
    try {
      await onReady(client);
    } catch (error) {
      logger.error(`[startToolboxNetwork] onReady callback failed for ${networkConfig.name}:`, error);
    }
  }

  return {
    // @ts-ignore
    network,
    client,
  };
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
