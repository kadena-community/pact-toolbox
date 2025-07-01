import type { DeploymentOptions, PactDeployer } from "@pact-toolbox/deployer";
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
 * @param deployer - The PactDeployer instance.
 * @param params - Deployment options.
 */
export async function deployPactDependency(
  dep: PactDependency,
  preludeDir: string,
  deployer: PactDeployer,
  params: DeploymentOptions = {},
): Promise<void> {
  const { group, requires, name } = dep;
  const contractPath = join(preludeDir, group || "root", name);
  if (Array.isArray(requires)) {
    for (const req of requires) {
      await deployPactDependency(req, preludeDir, deployer, params);
    }
  }
  await deployer.deploy(contractPath, params);
}

/**
 * Resolves and deploys all specified preludes.
 *
 * @param config - Configuration options for deploying preludes.
 * @param downloadIfMissing - Flag indicating whether to download missing preludes.
 * @throws If a prelude is not found and downloadIfMissing is false.
 */
export async function deployPreludes(config: CommonPreludeOptions, downloadIfMissing = true): Promise<void> {
  const { preludes: resolvedPreludes, preludesDir } = await resolvePreludes(config);
  const sorted = sortPreludes(resolvedPreludes);

  // make sure all preludes are downloaded
  await Promise.all(
    sorted.map(async (p) => {
      if (!isPreludeDownloaded(p, preludesDir)) {
        if (downloadIfMissing) {
          await downloadPrelude(p, preludesDir, config.deployer, sorted);
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
  await Promise.all(
    sorted.map(async (p) => {
      console.log("Considering deployment of prelude:", p.name);
      if (await shouldDeployPrelude(p, config.deployer)) {
        console.log("Deployment conditions met for prelude:", p.name);
        await deployPreludeDefinition(p, config.deployer);
        logger.success(`Deployed prelude: ${p.name}`);
      }
    }),
  );
}
