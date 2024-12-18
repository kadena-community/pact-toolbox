import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";

// import { z } from 'zod';

import { isLocalNetwork } from "@pact-toolbox/config";
import { startLocalNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

import type { PluginOptions } from "./types";

interface StartOptions {
  isTest: boolean;
  isServe: boolean;
  client: PactToolboxClient;
  network: NetworkConfig;
}
export async function startToolboxNetwork(
  { isServe, isTest, client, network }: StartOptions,
  toolboxConfig: PactToolboxConfigObj,
  { startNetwork = true, onReady }: PluginOptions = {},
): Promise<PactToolboxClient> {
  if (isServe && !isTest && isLocalNetwork(network) && startNetwork) {
    logger.start(`Starting ${network.name} network...`);
    await startLocalNetwork(toolboxConfig, {
      client,
      isStateless: false,
      logAccounts: true,
    });
  }

  if (isServe && !isTest && onReady) {
    await onReady(client);
  }
  return client;
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
//     await writeFileAtPath(`${file}.d.ts`, types);
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
