import type { DeployContractOptions, PactToolboxClient } from "@pact-toolbox/runtime";
import { join } from "pathe";

import { logger } from "@pact-toolbox/node-utils";

import type { CommonPreludeOptions, PactDependency } from "./types";
import { createReplTestTools, downloadPrelude, isPreludeDownloaded } from "./downloadPrelude";
import { resolvePreludes } from "./resolvePrelude";
import { sortPreludes } from "./utils";
import { deployPrelude as deployPreludeDefinition, shouldDeployPrelude } from "./processor";

/**
 * Deploys a specific Pact dependency, including its requirements.
 *
 * @param dep - The PactDependency object to deploy.
 * @param preludeDir - The directory where the dependency is located.
 * @param client - The PactToolboxClient instance.
 * @param params - Deployment options.
 */
export async function deployPactDependency(
  dep: PactDependency,
  preludeDir: string,
  client: PactToolboxClient,
  params: DeployContractOptions = {},
): Promise<void> {
  const { group, requires, name } = dep;
  const contractPath = join(preludeDir, group || "root", name);
  if (Array.isArray(requires)) {
    for (const req of requires) {
      await deployPactDependency(req, preludeDir, client, params);
    }
  }
  await client.deployContract(contractPath, params);
}

/**
 * Resolves and deploys all specified preludes.
 *
 * @param config - Configuration options for deploying preludes.
 * @param downloadIfMissing - Flag indicating whether to download missing preludes.
 * @throws If a prelude is not found and downloadIfMissing is false.
 */
export async function deployPreludes(config: CommonPreludeOptions, downloadIfMissing = true): Promise<void> {
  logger.info("Starting prelude deployment process...");
  logger.debug(`deployPreludes called with client host: ${config.client.getNetworkConfig().rpcUrl}`);
  const { preludes: resolvedPreludes, preludesDir } = await resolvePreludes(config);
  logger.info(`Resolved ${resolvedPreludes.length} preludes for deployment`);
  logger.debug(`Preludes directory: ${preludesDir}`);
  const sorted = sortPreludes(resolvedPreludes);

  // make sure all preludes are downloaded
  await Promise.all(
    sorted.map(async (p) => {
      if (!isPreludeDownloaded(p, preludesDir)) {
        if (downloadIfMissing) {
          logger.debug(`Downloading missing prelude: ${p.name}`);
          await downloadPrelude(p, preludesDir, config.client, sorted);
        } else {
          throw new Error(`Prelude ${p.name} not found, make sure to download it first`);
        }
      } else {
        logger.debug(`Prelude ${p.name} already downloaded`);
      }
    }),
  );

  // Create a test tools file for the pact repl tests
  await createReplTestTools(config);

  // deploy all preludes
  logger.info(`Starting deployment of ${sorted.length} preludes...`);
  
  // Deploy sequentially to avoid race conditions and provide better error reporting
  for (const p of sorted) {
    try {
      logger.debug(`Checking deployment conditions for prelude: ${p.name}`);
      if (await shouldDeployPrelude(p, config.client)) {
        logger.info(`Deploying prelude: ${p.name}`);
        await deployPreludeDefinition(p, config.client);
        logger.success(`✓ Successfully deployed prelude: ${p.name}`);
      } else {
        logger.info(`Skipping prelude ${p.name} - already deployed or conditions not met`);
      }
    } catch (error) {
      logger.error(`Failed to deploy prelude ${p.name}:`, error);
      throw error;
    }
  }
}
